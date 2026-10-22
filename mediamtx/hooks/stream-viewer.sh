#!/bin/sh
set -eu

# MediaMTX runOnRead/runOnUnread hook, with "read" or "unread".
STREAM_PATH="${MTX_PATH:-}"
ACTION="${1:-}"
if [ -z "$STREAM_PATH" ] || [ -z "$ACTION" ]; then
  exit 0
fi

curl -s -m 5 -X POST "${NEXTJS_URL:-http://mtxcord-web:3000}/api/streams/hook" \
  -H "Content-Type: application/json" \
  -H "X-Hook-Secret: ${HOOK_SECRET:-}" \
  -d "{\"path\":\"${STREAM_PATH}\",\"action\":\"${ACTION}\"}" >/dev/null 2>&1 || true
