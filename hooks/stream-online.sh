#!/bin/sh
set -eu

STREAM_PATH="${MTX_PATH:-desktop}"
DOMAIN="${PLAYER_DOMAIN:-localhost}"
URL="https://${DOMAIN}/${STREAM_PATH}/"

# Notify Next.js app that the stream is online so it can initialize access
# sessions cleanly and post/update the Discord "stream online" webhook
# message (Next.js owns the Discord webhook state, see lib/discordWebhook.ts).
curl -s -X POST "http://nextjs:3000/api/streams/hook" \
  -H "Content-Type: application/json" \
  -d "{\"path\":\"${STREAM_PATH}\",\"action\":\"ready\"}" >/dev/null 2>&1 || true

echo "========================================="
echo "STREAM ONLINE!"
echo "Stream: $STREAM_PATH"
echo "Player URL: $URL"
echo "========================================="
