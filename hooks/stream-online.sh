#!/bin/sh
set -eu

# 1. Safely read variables
WEBHOOK_URL="${DISCORD_WEBHOOK_URL:-}"
DOMAIN="${PLAYER_DOMAIN:-localhost}"
AUTH=/auth/.htpasswd

# 2. Generate credentials (always runs)
CODE="$(openssl rand -hex 24)"
HASH="$(openssl passwd -6 "$CODE")"

printf 'viewer:%s\n' "$HASH" > "$AUTH"

# 3. Construct the viewer URL
URL="https://viewer:${CODE}@${DOMAIN}/desktop/"

# 4. Decide where to output the URL
if [ -z "$WEBHOOK_URL" ]; then
    # No webhook? Print directly to Docker logs
    echo "========================================="
    echo "STREAM ONLINE! No Discord webhook found."
    echo "Viewer URL: $URL"
    echo "========================================="
else
    # Webhook exists? Send it to Discord
    echo "Stream is online. Firing Discord webhook..."
    curl -fsS \
      -H 'Content-Type: application/json' \
      -X POST \
      --data "{\"content\":\" :red_circle: **STREAM ONLINE**\\n${URL}\"}" \
      "$WEBHOOK_URL"
fi