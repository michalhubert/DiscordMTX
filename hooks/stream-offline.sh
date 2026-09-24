#!/bin/sh
set -eu

STREAM_PATH="${MTX_PATH:-desktop}"

# Notify Next.js app that the stream is offline so approvals and sessions are
# cleared, and so it can update the Discord "stream online" webhook message
# to reflect that the stream ended (Next.js owns the Discord webhook state,
# see lib/discordWebhook.ts).
curl -s -X POST "http://nextjs:3000/api/streams/hook" \
  -H "Content-Type: application/json" \
  -d "{\"path\":\"${STREAM_PATH}\",\"action\":\"notReady\"}" >/dev/null 2>&1 || true
