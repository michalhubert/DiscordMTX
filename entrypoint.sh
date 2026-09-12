#!/bin/sh
set -eu

# Convert comma-separated string to YAML list format
csv_to_yaml() {
  # If the input is empty or unset, do nothing
  if [ -z "${1:-}" ]; then
    return
  fi

  echo "$1" | tr ',' '\n' | while read -r item; do
    # xargs trims any accidental whitespace (e.g., "host1, host2")
    trimmed=$(echo "$item" | xargs)
    if [ -n "$trimmed" ]; then
      echo "  - $trimmed"
    fi
  done
}

export WEBRTC_TRUSTED_PROXIES=$(csv_to_yaml "${WEBRTC_TRUSTED_PROXIES:-}")
export WEBRTC_ADDITIONAL_HOSTS=$(csv_to_yaml "${WEBRTC_ADDITIONAL_HOSTS:-}")

export STREAMER_PASSWORD="${STREAMER_PASSWORD:-}"
export HOOK_ONLINE="${HOOK_ONLINE:-/hooks/stream-online.sh}"
export HOOK_ONLINE_RESTART="${HOOK_ONLINE_RESTART:-false}"
export HOOK_OFFLINE="${HOOK_OFFLINE:-/hooks/stream-offline.sh}"

envsubst '$STREAMER_PASSWORD $HOOK_ONLINE $HOOK_ONLINE_RESTART $HOOK_OFFLINE $WEBRTC_TRUSTED_PROXIES $WEBRTC_ADDITIONAL_HOSTS' \
  < /mediamtx.yml.template \
  > /tmp/mediamtx.yml

exec /mediamtx /tmp/mediamtx.yml "$@"