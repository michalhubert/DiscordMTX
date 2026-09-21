# DiscordMTX

[![Docker](https://img.shields.io/badge/Docker-required-blue?logo=docker)](https://www.docker.com/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

Made for personal streaming with whatever quality and framerate you want - no need to pay for Nitro just to get readable text and bearable stream quality.

A small Docker Compose setup built around [MediaMTX](https://github.com/bluenviron/mediamtx) for direct, no-transcode WebRTC streaming. Bitrate, resolution, and framerate are fully controlled by the streaming application (e.g. OBS), with a Next.js viewer/auth frontend and Discord webhook hooks.

FFmpeg transcoding may be added in the future.

## Features

* [MediaMTX](https://github.com/bluenviron/mediamtx) for streaming
* WebRTC (WHIP ingest / WHEP playback) for low-latency streaming
* Next.js frontend with a built-in WebRTC player and login gate
* "Sign in with Discord" (real Discord OAuth2) for viewers
* Per-stream, auto-generated viewer password for non-Discord viewers
* Discord webhooks on stream online/offline events
* Private streamer HUD / OBS Custom Browser Dock (`/dock`), gated by its own password
* In-browser desktop/app streaming panel (`/stream`) using WHIP + `getDisplayMedia`, no OBS required
* Per-stream bitrate/codec/resolution/audio settings, saved to a small SQLite database
* Automatic credential generation
* Docker Compose deployment

## Requirements

* Docker
* Docker Compose
* A domain pointing to the server
* A Discord webhook if you want Discord notifications

## Setup

Clone the repository:

```bash
git clone https://github.com/michalhubert/DiscordMTX.git
cd DiscordMTX
```

Create a `.env` file:

```env
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
PLAYER_DOMAIN=stream.example.com

# Also gates access to the /dock OBS HUD
STREAMER_PASSWORD=change-me

WEBRTC_TRUSTED_PROXIES=0.0.0.0
WEBRTC_ADDITIONAL_HOSTS=192.168.1.100,203.0.113.10

NEXTJS_PORT=8080
MEDIAMTX_HOST=discordmtx
NEXTAUTH_SECRET=change-me-to-a-random-secret
NEXTAUTH_URL=https://stream.example.com

# Discord OAuth app (https://discord.com/developers/applications), lets viewers
# sign in with their Discord account instead of the generated stream password
#DISCORD_CLIENT_ID=
#DISCORD_CLIENT_SECRET=
#NEXT_PUBLIC_DISCORD_ENABLED=false
```

Start the stack:

```bash
docker compose up -d
```

A viewer password is generated automatically each time the stream starts, and is validated by the Next.js login page. No manual `htpasswd` setup is required. Viewers can instead sign in with their Discord account if `DISCORD_CLIENT_ID`/`DISCORD_CLIENT_SECRET` are configured.

Check the logs:

```bash
docker compose logs -f
```

Stop the stack:

```bash
docker compose down
```

## Configuration

| Variable                  | Description                                       |
| ------------------------- | -------------------------------------------------- |
| `DISCORD_WEBHOOK_URL`     | Default Discord webhook used by the stream hooks   |
| `DISCORD_WEBHOOK_URLS`    | Optional per-path webhook overrides (see below)    |
| `PLAYER_DOMAIN`           | Domain used for the generated player URL           |
| `STREAMER_PASSWORD`       | Password for the MediaMTX `streamer` user, and for the `/dock` OBS HUD |
| `WEBRTC_TRUSTED_PROXIES`  | Proxies trusted by MediaMTX for WebRTC             |
| `WEBRTC_ADDITIONAL_HOSTS` | Addresses advertised to the WebRTC player          |
| `NEXTJS_PORT`             | Host port exposed by the Next.js frontend          |
| `MEDIAMTX_HOST`           | Hostname/IP of the discordmtx service the Next.js WHEP/API proxy talks to |
| `MEDIAMTX_PORT`           | Port of the discordmtx service the Next.js WHEP proxy talks to (default `8889`) |
| `MEDIAMTX_API_PORT`       | Port of the discordmtx MediaMTX control API used by `/dock` (default `9997`) |
| `NEXTAUTH_SECRET`         | Random secret used to sign Next.js session cookies |
| `NEXTAUTH_URL`            | Public URL of the Next.js frontend                 |
| `DISCORD_CLIENT_ID`       | Discord OAuth application client ID                |
| `DISCORD_CLIENT_SECRET`   | Discord OAuth application client secret            |
| `NEXT_PUBLIC_DISCORD_ENABLED` | Set to `true` to show the "Sign in with Discord" button on the login page |
| `DISABLE_DOCK_AUTH`       | Set to `true` to skip authentication on `/dock` and `/stream` (useful when the frontend is only reachable from a trusted/local network) |

### `DISCORD_WEBHOOK_URLS`

By default, every path notifies the same `DISCORD_WEBHOOK_URL`. To send some paths to a different Discord channel, list `path:url` pairs, separated by commas:

```env
DISCORD_WEBHOOK_URLS=desktop:https://discord.com/api/webhooks/...,gaming:https://discord.com/api/webhooks/...
```

A path not listed here falls back to `DISCORD_WEBHOOK_URL`. This is resolved by `hooks/stream-online.sh` at runtime, based on the path name (`MTX_PATH`) provided by MediaMTX.

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

## Ports

|   Port | Protocol | Description                                  |
| -----: | :------: | --------------------------------------------- |
| `8889` |    TCP   | WebRTC signaling - OBS's WHIP publish, MediaMTX's own WHEP playback |
| `8189` |    UDP   | WebRTC media (RTP), direct browser ↔ MediaMTX |
| `8080` |    TCP   | Next.js frontend (player, login, WHEP signaling proxy) |

The Next.js port can be changed with `NEXTJS_PORT`.

MediaMTX's WebRTC signaling port `8889` (used for both OBS's WHIP ingest and the player's WHEP playback) is exposed to the host so OBS (running on the streamer's own machine, outside this stack's Docker network) can reach MediaMTX directly for WHIP publishing - see [Publishing with OBS Studio](#publishing-with-obs-studio) below. Browsers reach it indirectly instead: the Next.js frontend proxies the WHEP SDP signaling request (tiny, low-frequency) to `discordmtx:8889` after checking the viewer's session, while the actual RTP media always flows directly between the browser and MediaMTX over UDP `8189`, so no extra latency is added to the stream itself. The upstream hostname/port used by the proxy can be changed with `MEDIAMTX_HOST`/`MEDIAMTX_PORT` (defaults to `discordmtx:8889`).

## MediaMTX

The default stream path is:

```text
default
```

The `streamer` user can publish to this path.

### Publishing with OBS Studio

OBS Studio (≥ 30) can publish directly to MediaMTX using the built-in WHIP output. Open **Settings > Stream** and set:

1. **Service**: `WHIP`
2. **Server**: `http://<server-address>:8889/<path>/whip` (e.g. `http://localhost:8889/default/whip` if OBS runs on the same machine as Docker). Note this uses MediaMTX's port `8889` directly, not the Next.js port `8080` - WHIP is currently published straight to MediaMTX rather than through the Next.js proxy.
3. **Bearer Token**: `streamer:<STREAMER_PASSWORD>` - OBS only exposes a single "Bearer Token" field, so MediaMTX's username/password pair must be concatenated with a colon (`user:pass`) and passed there; MediaMTX accepts this as an equivalent of HTTP Basic auth. For example, with `STREAMER_PASSWORD=change-me`, the Bearer Token is `streamer:change-me`.

Replace `<server-address>` with the address the server is reachable at (e.g. `localhost` if OBS runs on the same machine as Docker, the LAN IP, or a public domain), and `default` with the path name you want to publish to (see [Dynamic Path Configuration](#dynamic-path-configuration)).

If OBS reports "Could not access the specified channel or stream key" (or similar generic WHIP failures), it usually means either:
* Port `8889` isn't reachable from the machine running OBS (check firewalls/port forwarding if OBS is remote), or
* The Bearer Token doesn't match `streamer:<STREAMER_PASSWORD>` exactly (it's case-sensitive, and there is no space around the colon).

### Dynamic Path Configuration

You can configure multiple paths by creating a `paths.yml` file in the project root. Copy the example:

```bash
cp paths.yml.example paths.yml
```

Edit `paths.yml` to define your paths:

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

Per-path Discord webhooks are configured separately via the `DISCORD_WEBHOOK_URLS` environment variable (see [Configuration](#configuration)), not in `paths.yml`.

If no `paths.yml` is mounted, or the mounted file is empty/invalid, `entrypoint.sh` automatically falls back to a built-in default that only defines the single `default` path - the stack still starts instead of crashing.

Because path names are mapped to MediaMTX's `MTX_PATHS_<NAME>_*` environment variables (see [MediaMTX configuration](#mediamtx) below), use single-word, alphanumeric path names (e.g. `desktop`, `gaming`). Names containing `-` or `_` are ambiguous for MediaMTX's environment variable parser and are not supported.

The `streamer` user can only publish (and the `any`/anonymous user can only read) paths that are explicitly listed in `paths.yml` - `entrypoint.sh` grants publish/read permissions and hook overrides per path, one by one. There is no wildcard/"any path" access: a path not declared in `paths.yml` has no permissions at all, so both OBS and the `/stream` browser-capture panel (see [Browser Streaming Panel](#browser-streaming-panel)) can only publish to a path that's already configured there.

MediaMTX configuration:

```text
mediamtx.yml
```

MediaMTX natively supports configuration through [environment variables](https://mediamtx.org/docs/features/configuration) in the format `MTX_PARAMNAME`. Instead of rendering a full configuration file, `entrypoint.sh` exports the required `MTX_*` variables (derived from the environment and `paths.yml`, if present) and lets MediaMTX apply them on top of `mediamtx.yml` at startup.

## Hooks

Stream hooks are located in:

```text
hooks/
```

Default configuration:

```env
HOOK_ONLINE=/hooks/stream-online.sh
HOOK_ONLINE_RESTART=false
HOOK_OFFLINE=/hooks/stream-offline.sh
```

MediaMTX runs the online hook when the stream starts and the offline hook when it stops.

Viewer passwords are stored per-path in the SQLite database and can be rotated via the streamer dock (/dock). When a password is rotated, all existing viewer sessions are invalidated and viewers must re-login with the new password. The player URL posted to Discord never contains credentials - viewers enter the password on the Next.js login page.

The hook scripts resolve the Discord webhook to use for the current path from the `DISCORD_WEBHOOK_URLS`/`DISCORD_WEBHOOK_URL` environment variables, which they inherit directly from the container.

## Streamer HUD / OBS Custom Browser Dock

A private streamer dashboard is available at `/dock` in the Next.js frontend, gated by its own login (`STREAMER_PASSWORD`) - separate from both the Discord login and the per-stream viewer password, so viewers can never reach it.

It talks to MediaMTX's control API through `/api/mediamtx/*`, a same-origin proxy in the Next.js app (equivalent to the old `/streamer/api/` NGINX proxy to `discordmtx:9997/v3/`).

Features:
* Real-time viewer count and stream status (Live / Offline)
* Connected viewer IP addresses, stream paths, session durations, and transferred data
* Live activity log showing recent viewer connections and disconnections
* Optional audio chime synthesized via Web Audio API on viewer join

### Adding to OBS Studio
1. In OBS Studio, open **Docks** > **Custom Browser Docks...**
2. Set **Dock Name** to `Stream HUD` (or any name you prefer).
3. Set **URL** to `https://stream.example.com/dock` (or `http://localhost:8080/dock`).
4. Enter your `STREAMER_PASSWORD` on the login page that appears.
5. Dock the window anywhere in your OBS workspace.

## Browser Streaming Panel

For streaming without OBS (e.g. to avoid being locked into a single resolution/framerate for everything you capture), a self-contained streaming panel is available at `/stream`, gated the same way as `/dock` (`STREAMER_PASSWORD`, or bypassed entirely when `DISABLE_DOCK_AUTH=true`).

It uses the browser's native [`getDisplayMedia`](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia) screen/window/tab picker to capture a source, then publishes it directly to MediaMTX over WebRTC using [WHIP](https://mediamtx.org/docs/features/webrtc), proxied through `/api/whip/<path>` the same way `/api/whep` proxies playback. The MediaMTX path it publishes to must be one already declared in `paths.yml` (see [Dynamic Path Configuration](#dynamic-path-configuration)); the built-in `paths.yml` ships with a `browser` path for this purpose, independent from whatever OBS publishes to `default`/`desktop`.

Available settings, adjustable per-stream and optionally saved for next time:
* **Path** - the MediaMTX path name to publish to, picked from a dropdown listing paths declared in `paths.yml` (or currently active); custom/undeclared path names cannot be selected or published to, since MediaMTX only grants publish/read permissions to paths configured there; viewers watch it at that same path
* **Preferred source** - desktop, application window, or browser tab (only pre-selects the browser's share picker; the final choice is still made there); when "Application window" + audio is picked, a Chrome-only `windowAudio: "window"` hint asks the browser to scope captured audio to that window alone instead of the whole desktop - support varies by browser/OS, so a warning is shown and "Entire desktop"/"Browser tab" remain the more reliable fallbacks
* **Fixed resolution** - optionally pin capture to a specific width/height instead of following the source's native resolution
* **Framerate**
* **Video bitrate and codec** (VP8/VP9/H.264/AV1, subject to browser support; defaults to H.264) - if H.264 ends up being negotiated (explicitly chosen, or picked automatically), the panel always prefers its Baseline profile, which cannot use B-frames, reducing encode/decode latency. There is no web API to request a specific hardware encoder (e.g. NVENC) directly - the browser always decides - but Chrome only hardware-accelerates H.264 broadly (VP8 has no hardware encoder path at all, VP9/AV1 support is limited and GPU/OS-dependent), so H.264 is the closest equivalent to OBS+NVENC at high bitrates; make sure hardware acceleration is enabled in your browser's settings too
* **Content hint** - hints the encoder to favor motion smoothness, per-frame detail, or text sharpness (`motion`/`detail`/`text`), or leave it to the browser's default
* **Degradation preference** - when bandwidth/CPU can't keep up, whether the encoder should drop resolution to keep the framerate smooth (`maintain-framerate`, the default - usually fixes stutter), drop framerate to keep resolution sharp (`maintain-resolution`), or balance both
* **Audio** - whether to include system/tab audio, and its target bitrate; if the browser/OS can't provide audio for the chosen source, the stream automatically falls back to video-only instead of failing to start. If audio capture fails with a "Could not start audio source" error, a virtual surround sound effect on your headphones/audio device is a common cause - try disabling it.

Saved settings are stored in a small SQLite database inside the Next.js container, always at the fixed path `/data/sqlite/discordmtx.db`; mount `/data/sqlite` as a volume (already done in the provided `docker-compose.yaml`, mapped to `./config`) to persist them across restarts.

Because everything runs in the browser, resolution and framerate are no longer forced to a single global setting like they are in OBS - the browser panel captures at whatever the source natively provides (or a fixed size you choose), independently from anything else running on the machine.

Under the hood, the panel also applies a few other WebRTC tuning options: `bundlePolicy: "max-bundle"` and a small ICE candidate pool for a faster initial connection, `maxFramerate`/`priority`/`networkPriority` on the video encoding, and disabled Opus DTX with in-band FEC enabled on the audio track.

## Development

For local development/testing, use the compose file in `dev/`, which builds the images from source instead of pulling the published ones:

```bash
cd dev
docker compose up -d --build
```

It reads the same environment variables described in [Configuration](#configuration) via a `.env` file placed in the `dev/` directory.

## HTTPS

The Next.js frontend handles authentication (Discord OAuth + per-stream viewer password) and the WHEP signaling proxy, but not TLS.

For a public deployment, put it behind a TLS-enabled reverse proxy such as Caddy, Traefik, or Cloudflare.

Keep in mind that HTTPS proxying and WebRTC are separate connections. Cloudflare can proxy the HTTP/HTTPS side normally, while WebRTC still needs its UDP path to be reachable.

## Project structure

```text
.
├── .github/
├── dev/
├── hooks/
├── nextjs/
├── Dockerfile
├── docker-compose.yaml
├── entrypoint.sh
├── mediamtx.yml
├── paths.yml
└── paths.yml.example
```

## License

[MIT](LICENSE)

## Note

Next.js part of the project was done using AI tools, the frontend part will be refactored manually in the future.
