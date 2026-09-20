#!/bin/sh
set -eu

STREAM_PATH="${MTX_PATH:-desktop}"
DOMAIN="${PLAYER_DOMAIN:-localhost}"
TOKEN_FILE=/auth/viewer-token

# Resolve the webhook for this path from DISCORD_WEBHOOK_URLS
# (format: "path1:url1,path2:url2"), falling back to DISCORD_WEBHOOK_URL.
resolve_webhook_url() {
  old_ifs="$IFS"
  IFS=','
  for entry in ${DISCORD_WEBHOOK_URLS:-}; do
    IFS="$old_ifs"
    entry=$(echo "$entry" | xargs)
    entry_path="${entry%%:*}"
    entry_url="${entry#*:}"
    if [ "$entry_path" = "$STREAM_PATH" ] && [ "$entry_url" != "$entry" ]; then
      echo "$entry_url"
      return
    fi
    IFS=','
  done
  IFS="$old_ifs"

  echo "${DISCORD_WEBHOOK_URL:-}"
}

# 1. Safely read variables
WEBHOOK_URL="$(resolve_webhook_url)"

# 2. Generate per-stream viewer token, used by Next.js to validate viewer
# password logins (MediaMTX itself grants read access to "any" user since
# port 8889 is not exposed publicly; the Next.js session is the real gate).
CODE="$(openssl rand -hex 24)"
printf '%s' "$CODE" > "$TOKEN_FILE"

# 3. Construct the player URL (no credentials — auth is handled by Next.js)
URL="https://${DOMAIN}/${STREAM_PATH}/"

# 4. Decide where to output the URL
if [ -z "$WEBHOOK_URL" ]; then
    echo "========================================="
    echo "STREAM ONLINE! No Discord webhook found."
    echo "Stream: $STREAM_PATH"
    echo "Player URL: $URL"
    echo "Viewer password: $CODE"
    echo "========================================="
else
    echo "Stream is online. Firing Discord webhook..."
    if ! RESPONSE="$(curl -fsS \
      -H 'Content-Type: application/json' \
      -X POST \
      --data "{\"content\":\" :red_circle: **STREAM ONLINE**\\nStream: ${STREAM_PATH}\\n${URL}\"}" \
      "$WEBHOOK_URL" 2>&1)"; then
        echo "ERROR: Discord webhook failed: $RESPONSE" >&2
        echo "========================================="
        echo "STREAM ONLINE! (Discord webhook failed, falling back to console)"
        echo "Stream: $STREAM_PATH"
        echo "Player URL: $URL"
        echo "Viewer password: $CODE"
        echo "========================================="
    fi
fi
