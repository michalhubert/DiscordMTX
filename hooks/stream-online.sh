#!/bin/sh
set -eu

STREAM_PATH="${MTX_PATH:-desktop}"
DOMAIN="${PLAYER_DOMAIN:-localhost}"
AUTH=/auth/.htpasswd

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

# 2. Generate credentials (always runs)
CODE="$(openssl rand -hex 24)"
HASH="$(openssl passwd -6 "$CODE")"

printf 'viewer:%s\n' "$HASH" > "$AUTH"

# 3. Construct the viewer URL
URL="https://viewer:${CODE}@${DOMAIN}/${STREAM_PATH}/"

# 4. Decide where to output the URL
if [ -z "$WEBHOOK_URL" ]; then
    echo "========================================="
    echo "STREAM ONLINE! No Discord webhook found."
    echo "Stream: $STREAM_PATH"
    echo "Viewer URL: $URL"
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
        echo "Viewer URL: $URL"
        echo "========================================="
    fi
fi