# DiscordMTX

[![Docker](https://img.shields.io/badge/Docker-required-blue?logo=docker)](https://www.docker.com/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

Made for personal streaming with whatever quality and framerate you want - no need to pay for Nitro just to get readable text and bearable stream quality.

A small Docker Compose setup built around [MediaMTX](https://github.com/bluenviron/mediamtx) for direct, no-transcode WebRTC streaming. Bitrate, resolution, and framerate are fully controlled by the streaming application (e.g. OBS), with NGINX viewer authentication and Discord webhook hooks.

FFmpeg transcoding may be added in the future.

## Features

* [MediaMTX](https://github.com/bluenviron/mediamtx) for streaming
* WebRTC playback
* NGINX reverse proxy with Basic Auth
* Discord webhooks on stream online/offline events
* Private streamer HUD / OBS Custom Browser Dock
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

STREAMER_PASSWORD=change-me

WEBRTC_TRUSTED_PROXIES=0.0.0.0
WEBRTC_ADDITIONAL_HOSTS=192.168.1.100,203.0.113.10

NGINX_PORT=8080
STREAM_UPSTREAM_HOST=discordmtx
```

Start the stack:

```bash
docker compose up -d
```

Credentials are generated automatically when the stream starts. No manual `htpasswd` setup is required.

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
| `STREAMER_PASSWORD`       | Password for the MediaMTX `streamer` user          |
| `WEBRTC_TRUSTED_PROXIES`  | Proxies trusted by MediaMTX for WebRTC             |
| `WEBRTC_ADDITIONAL_HOSTS` | Addresses advertised to the WebRTC player          |
| `NGINX_PORT`              | Host port exposed by NGINX                         |
| `STREAM_UPSTREAM_HOST`    | Hostname/IP of the discordmtx service NGINX proxies to |

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

|   Port | Protocol | Description   |
| -----: | :------: | ------------- |
| `8889` |    TCP   | WebRTC / WHIP |
| `8189` |    UDP   | WebRTC media  |
| `8080` |    TCP   | NGINX         |

The NGINX port can be changed with `NGINX_PORT`.

NGINX proxies to the `discordmtx` container on port `8889` over plain HTTP. The upstream hostname/IP can be changed with `STREAM_UPSTREAM_HOST` (defaults to `discordmtx`); the port and protocol are fixed.

## MediaMTX

The default stream path is:

```text
default
```

The `streamer` user can publish to this path.

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
```

Each path can have:
- **name**: The path name (e.g., `desktop`, `gaming`, `music`)
- **hook_online**: Optional custom online hook script path
- **hook_offline**: Optional custom offline hook script path
- **hook_online_restart**: Optional boolean for hook restart behavior

Per-path Discord webhooks are configured separately via the `DISCORD_WEBHOOK_URLS` environment variable (see [Configuration](#configuration)), not in `paths.yml`.

If no `paths.yml` is mounted, or the mounted file is empty/invalid, `entrypoint.sh` automatically falls back to a built-in default that only defines the single `default` path — the stack still starts instead of crashing.

Because path names are mapped to MediaMTX's `MTX_PATHS_<NAME>_*` environment variables (see [MediaMTX configuration](#mediamtx) below), use single-word, alphanumeric path names (e.g. `desktop`, `gaming`). Names containing `-` or `_` are ambiguous for MediaMTX's environment variable parser and are not supported.

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

The hooks are also responsible for generating the temporary stream credentials used by the player.

The hook scripts resolve the Discord webhook to use for the current path from the `DISCORD_WEBHOOK_URLS`/`DISCORD_WEBHOOK_URL` environment variables, which they inherit directly from the container.

## Streamer HUD / OBS Custom Browser Dock

A private streamer dashboard is available under `/streamer/dock` (protected by Basic Auth using username `streamer` and your `STREAMER_PASSWORD`).

Features:
* Real-time viewer count and stream status (Live / Offline)
* Connected viewer IP addresses, stream paths, session durations, and transferred data
* Live activity log showing recent viewer connections and disconnections
* Optional audio chime synthesized via Web Audio API on viewer join

### Adding to OBS Studio
1. In OBS Studio, open **Docks** > **Custom Browser Docks...**
2. Set **Dock Name** to `Stream HUD` (or any name you prefer).
3. Set **URL** to `https://stream.example.com/streamer/dock` (or `http://localhost:8080/streamer/dock`).
4. Enter `streamer` and your `STREAMER_PASSWORD` when prompted for credentials.
5. Dock the window anywhere in your OBS workspace.

## Development

For local development/testing, use the compose file in `dev/`, which builds the images from source instead of pulling the published ones:

```bash
cd dev
docker compose up -d --build
```

It reads the same environment variables described in [Configuration](#configuration) via a `.env` file placed in the `dev/` directory.

## HTTPS

The included NGINX configuration handles authentication and proxying, but not TLS.

For a public deployment, put it behind a TLS-enabled reverse proxy such as Caddy, Traefik, or Cloudflare.

Keep in mind that HTTPS proxying and WebRTC are separate connections. Cloudflare can proxy the HTTP/HTTPS side normally, while WebRTC still needs its UDP path to be reachable.

## Project structure

```text
.
├── .github/
├── dev/
├── hooks/
├── Dockerfile
├── docker-compose.yaml
├── entrypoint.sh
├── mediamtx.yml
├── nginx.Dockerfile
├── nginx.conf.template
├── nginx-entrypoint.sh
├── paths.yml
└── paths.yml.example
```

## License

[MIT](LICENSE)

## Note

Some parts of this project were written with help from AI tools (not go-stupid-vibe-coded).
