# MTXcord media server

The `mtxcord-media` service: [MediaMTX](https://github.com/bluenviron/mediamtx) with a small entrypoint and stream hooks. It takes WHIP streams from OBS (or the `/stream` browser panel) and serves them to viewers over WebRTC. Viewers never reach it directly for signaling; the [web app](../nextjs/README.md) proxies that after checking their access.

Back to the [main README](../README.md).

## Configuration

Set these in the `.env` next to `docker-compose.yaml`. Variables shared with the web app (`STREAMER_PASSWORD`, `HOOK_SECRET`, `PLAYER_DOMAIN`) are described in the [main README](../README.md#shared-variables).

| Variable                  | Description                                       |
| ------------------------- | -------------------------------------------------- |
| `WEBRTC_ADDITIONAL_HOSTS` | Addresses advertised to the WebRTC player, see [below](#webrtc_additional_hosts) |
| `WEBRTC_TRUSTED_PROXIES`  | MediaMTX `webrtcTrustedProxies`, see [Trusted proxies](#trusted-proxies) |
| `API_TRUSTED_PROXIES`     | MediaMTX `apiTrustedProxies`, see [Trusted proxies](#trusted-proxies) |
| `UDP_READ_BUFFER_SIZE`    | MediaMTX UDP read buffer in bytes (default `1000000`), see [UDP buffer tuning](#udp-buffer-tuning-webrtc-packet-loss) |
| `HOOK_ONLINE` / `HOOK_OFFLINE` / `HOOK_ONLINE_RESTART` | Default stream hooks, see [Hooks](#hooks) |
| `HOOK_VIEWER`             | Hook run when a viewer starts/stops watching (default `/hooks/stream-viewer.sh`; set empty to turn off), see [Hooks](#hooks) |
| `NEXTJS_URL`              | Where the stream hooks reach the web app (default `http://mtxcord-web:3000`) |

### `WEBRTC_ADDITIONAL_HOSTS`

This is used by MediaMTX when advertising ICE candidates during the WebRTC handshake.

In a typical setup, provide both the server's LAN IP and the public IP that viewers can reach:

```env
WEBRTC_ADDITIONAL_HOSTS=192.168.1.100,203.0.113.10
```

The LAN address is useful for clients on the same network, while the public address is used by clients connecting from outside.

A domain can also be used:

```env
WEBRTC_ADDITIONAL_HOSTS=192.168.1.100,stream.example.com
```

This requires the domain to resolve directly to the server and UDP port `8189` to be reachable from the internet.

If the domain is behind Cloudflare proxy, regular HTTP proxying does not handle the WebRTC UDP traffic on port `8189`. In that case, either disable the Cloudflare proxy for the WebRTC hostname and forward UDP `8189` to the server, or use a Cloudflare service/plan that supports the required UDP proxying.

The web interface/player itself can still be served through the normal Cloudflare HTTP/HTTPS proxy. Only the WebRTC media connection needs direct UDP connectivity.

### Trusted proxies

`WEBRTC_TRUSTED_PROXIES` and `API_TRUSTED_PROXIES` are MediaMTX's own settings, not the web app's. They list the addresses MediaMTX lets set `X-Forwarded-For` on its WebRTC (`8889`) and control API (`9997`) ports. MediaMTX only uses that header to work out the client's IP for its logs and for IP-restricted users, and this stack has no IP-restricted users.

The web app doesn't send `X-Forwarded-For` to MediaMTX, so these settings don't change how the app behaves. The web app works out viewer IPs itself, see [Client IPs](../nextjs/README.md#client-ips).

The default, `0.0.0.0/0,::/0`, trusts everyone. That's harmless for the API, which isn't published outside the Docker network. Port `8889` is published for OBS, though, so anyone reaching it can fake their IP in MediaMTX's logs. Since nothing in the stack needs to set the header, the safest value is localhost only:

```env
WEBRTC_TRUSTED_PROXIES=127.0.0.1/32
API_TRUSTED_PROXIES=127.0.0.1/32
```

Don't use the Docker network's subnet instead: Docker's port proxy can make outside traffic look like it comes from the network's gateway, which is inside that subnet.

## Ports

|   Port | Protocol | Description                                  |
| -----: | :------: | --------------------------------------------- |
| `8889` |    TCP   | WebRTC signaling - OBS's WHIP publish, MediaMTX's own WHEP playback |
| `8189` |    UDP   | WebRTC media (RTP), direct browser ↔ MediaMTX |

Port `8889` is exposed to the host so OBS (running on the streamer's own machine, outside this stack's Docker network) can reach MediaMTX directly for WHIP publishing - see [Publishing with OBS Studio](#publishing-with-obs-studio). Browsers reach it indirectly instead: the web app proxies the WHEP SDP signaling request (tiny, low-frequency) to `mtxcord-media:8889` after checking the viewer's session, while the actual RTP media always flows directly between the browser and MediaMTX over UDP `8189`, so no extra latency is added to the stream itself.

## Publishing with OBS Studio

OBS Studio (≥ 30) can publish directly to MediaMTX using the built-in WHIP output. Open **Settings > Stream** and set:

1. **Service**: `WHIP`
2. **Server**: `http://<server-address>:8889/<path>/whip` (e.g. `http://localhost:8889/default/whip` if OBS runs on the same machine as Docker). Note this uses MediaMTX's port `8889` directly, not the web app's port `8080` - WHIP is published straight to MediaMTX rather than through the web app's proxy.
3. **Bearer Token**: `streamer:<STREAMER_PASSWORD>` - OBS only exposes a single "Bearer Token" field, so MediaMTX's username/password pair must be concatenated with a colon (`user:pass`) and passed there; MediaMTX accepts this as an equivalent of HTTP Basic auth. For example, with `STREAMER_PASSWORD=change-me`, the Bearer Token is `streamer:change-me`.

Replace `<server-address>` with the address the server is reachable at (e.g. `localhost` if OBS runs on the same machine as Docker, the LAN IP, or a public domain), and `default` with the path name you want to publish to (see [Paths](#paths)).

If OBS reports "Could not access the specified channel or stream key" (or similar generic WHIP failures), it usually means either:
* Port `8889` isn't reachable from the machine running OBS (check firewalls/port forwarding if OBS is remote), or
* The Bearer Token doesn't match `streamer:<STREAMER_PASSWORD>` exactly (it's case-sensitive, and there is no space around the colon).

## Paths

The default stream path is `default`.

You can configure multiple paths by creating a `paths.yml` file in this folder. Copy the example:

```bash
cp mediamtx/paths.yml.example mediamtx/paths.yml
```

Edit `mediamtx/paths.yml` to define your paths:

```yaml
paths:
  - name: desktop

  - name: gaming

  - name: music

  - name: browser
```

Each path can have:
- **name**: The path name (e.g., `desktop`, `gaming`, `music`)
- **hook_online**: Optional custom online hook script path
- **hook_offline**: Optional custom offline hook script path
- **hook_online_restart**: Optional boolean for hook restart behavior
- **hook_viewer**: Optional custom viewer hook script path

Per-path Discord webhooks are configured in the web app via `DISCORD_WEBHOOK_URLS` (see [Discord webhooks](../nextjs/README.md#discord-webhooks)), not in `paths.yml`.

If no `paths.yml` is mounted, or the mounted file is empty/invalid, `entrypoint.sh` automatically falls back to a built-in default that only defines the single `default` path - the stack still starts instead of crashing.

Because path names are mapped to MediaMTX's `MTX_PATHS_<NAME>_*` environment variables (see [MediaMTX configuration](#mediamtx-configuration)), use single-word, alphanumeric path names (e.g. `desktop`, `gaming`). Names containing `-` or `_` are ambiguous for MediaMTX's environment variable parser and are not supported.

`streamer` is MediaMTX's only user: nothing can be read or published without its password, so viewers can only watch through the web app, which checks their access. It can only publish to paths that are explicitly listed in `paths.yml` - `entrypoint.sh` grants publish permissions and hook overrides per path, one by one. A path not declared in `paths.yml` can't be published to, so both OBS and the [`/stream` browser panel](../nextjs/README.md#browser-streaming-panel) can only publish to a path that's already configured there.

## MediaMTX configuration

MediaMTX's base configuration is `mediamtx/mediamtx.yml`. Only WebRTC is enabled (WHIP for publishing, WHEP for playback); MediaMTX's RTSP, RTMP, HLS, SRT and MoQ servers are turned off.

MediaMTX natively supports configuration through [environment variables](https://mediamtx.org/docs/features/configuration) in the format `MTX_PARAMNAME`. Instead of rendering a full configuration file, `entrypoint.sh` exports the required `MTX_*` variables (derived from the environment and `paths.yml`, if present) and lets MediaMTX apply them on top of `mediamtx.yml` at startup.

### UDP buffer tuning (WebRTC packet loss)

MediaMTX's docs note that a too-small UDP receive buffer can cause dropped packets for RTP/WebRTC traffic, especially under load. This stack helps with one half of that automatically, but the other half needs a manual step on the Docker host:

- `entrypoint.sh` exports `MTX_UDPREADBUFFERSIZE` (MediaMTX's own buffer size, in bytes), controlled by the `UDP_READ_BUFFER_SIZE` environment variable (default `1000000`, i.e. MediaMTX's recommended value).
- For `MTX_UDPREADBUFFERSIZE` to actually take effect, the host's kernel-wide `net.core.rmem_max` sysctl - a separate, unrelated setting with its own default (`100000000`) - must also be raised at least as high. This is a host-wide (non-namespaced) setting, so it can't be set from inside the container - run this on the Docker host:

```bash
sudo sysctl -w net.core.rmem_max=100000000
```

To persist this across reboots, add `net.core.rmem_max=100000000` to `/etc/sysctl.conf` (or a file under `/etc/sysctl.d/`).

## Hooks

Stream hooks are located in `mediamtx/hooks/`. Default configuration:

```env
HOOK_ONLINE=/hooks/stream-online.sh
HOOK_ONLINE_RESTART=false
HOOK_OFFLINE=/hooks/stream-offline.sh
HOOK_VIEWER=/hooks/stream-viewer.sh
```

MediaMTX runs the online hook when the stream starts and the offline hook when it stops. It runs the viewer hook (with `read` or `unread`) whenever someone starts or stops watching, so the dock's viewer list updates at once.

All hooks call the web app's `/api/streams/hook` endpoint at `NEXTJS_URL` (default `http://mtxcord-web:3000`, the compose service name, so changing `container_name` doesn't break it; set it if you rename the service or run the web app elsewhere). They authenticate with `HOOK_SECRET`, which must be the same on both services. The web app uses them to track which streams are live, clearing a path's approvals whenever its stream starts or stops, and to post the [Discord webhook message](../nextjs/README.md#discord-webhooks).

The built-in scripts are baked into the image at `/hooks`. The provided `docker-compose.yaml` also mounts `mediamtx/hooks` at `/opt/hooks`, so to use your own scripts, put them there and point the `HOOK_*` variables (e.g. `HOOK_ONLINE=/opt/hooks/my-online.sh`), or a path's `hook_*` settings in `paths.yml`, at them.
