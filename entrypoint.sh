#!/bin/sh
set -eu

MOUNTED_PATHS_FILE="/opt/streams/paths.yml"
DEFAULT_PATHS_FILE="/opt/streams/paths.yml.default"

# Use the mounted paths.yml if it's a valid, non-empty file. Otherwise fall back to the built-in default.
if [ -f "$MOUNTED_PATHS_FILE" ] && [ -s "$MOUNTED_PATHS_FILE" ] \
  && yq eval '.paths | length' "$MOUNTED_PATHS_FILE" >/dev/null 2>&1 \
  && [ "$(yq eval '.paths | length' "$MOUNTED_PATHS_FILE")" -gt 0 ] 2>/dev/null; then
  PATHS_FILE="$MOUNTED_PATHS_FILE"
else
  echo "No valid paths.yml found at $MOUNTED_PATHS_FILE, using built-in default" >&2
  PATHS_FILE="$DEFAULT_PATHS_FILE"
fi

csv_to_yaml() {
  items=""

  if [ -n "${1:-}" ]; then
    old_ifs="$IFS"
    IFS=','
    for item in $1; do
      IFS="$old_ifs"
      trimmed=$(echo "$item" | xargs)
      if [ -n "$trimmed" ]; then
        items="${items:+$items, }$trimmed"
      fi
      IFS=','
    done
    IFS="$old_ifs"
  fi

  printf '[%s]' "$items"
}

# Generate path configurations using yq.
generate_paths_config() {
  COUNT=$(yq eval '.paths | length' "$PATHS_FILE")

  i=0
  while [ "$i" -lt "$COUNT" ]; do
    NAME=$(yq eval ".paths[$i].name" "$PATHS_FILE")
    HOOK_ON=$(yq eval ".paths[$i].hook_online // \"${HOOK_ONLINE}\"" "$PATHS_FILE")
    HOOK_OFF=$(yq eval ".paths[$i].hook_offline // \"${HOOK_OFFLINE}\"" "$PATHS_FILE")
    HOOK_RESTART=$(yq eval ".paths[$i].hook_online_restart // \"${HOOK_ONLINE_RESTART}\"" "$PATHS_FILE")

    cat <<EOF
  $NAME:
    runOnOnlineRestart: $HOOK_RESTART
    runOnOnline: $HOOK_ON
    runOnOffline: $HOOK_OFF
EOF
    i=$((i + 1))
  done
}

# Generate permissions using yq
generate_permissions() {
  ACTION=$1

  COUNT=$(yq eval '.paths | length' "$PATHS_FILE")
  i=0
  while [ "$i" -lt "$COUNT" ]; do
    NAME=$(yq eval ".paths[$i].name" "$PATHS_FILE")
    echo "      - action: $ACTION"
    echo "        path: $NAME"
    i=$((i + 1))
  done
}

WEBRTC_TRUSTED_PROXIES=$(csv_to_yaml "${WEBRTC_TRUSTED_PROXIES:-}")
export WEBRTC_TRUSTED_PROXIES
WEBRTC_ADDITIONAL_HOSTS=$(csv_to_yaml "${WEBRTC_ADDITIONAL_HOSTS:-}")
export WEBRTC_ADDITIONAL_HOSTS

export STREAMER_PASSWORD="${STREAMER_PASSWORD:-}"
export HOOK_ONLINE="${HOOK_ONLINE:-/hooks/stream-online.sh}"
export HOOK_ONLINE_RESTART="${HOOK_ONLINE_RESTART:-false}"
export HOOK_OFFLINE="${HOOK_OFFLINE:-/hooks/stream-offline.sh}"
export DISCORD_WEBHOOK_URL="${DISCORD_WEBHOOK_URL:-}"
export DISCORD_WEBHOOK_URLS="${DISCORD_WEBHOOK_URLS:-}"

PUBLISH_PERMISSIONS=$(generate_permissions "publish")
export PUBLISH_PERMISSIONS
READ_PERMISSIONS=$(generate_permissions "read")
export READ_PERMISSIONS
PATHS=$(generate_paths_config)
export PATHS

envsubst '$STREAMER_PASSWORD $HOOK_ONLINE $HOOK_ONLINE_RESTART $HOOK_OFFLINE $WEBRTC_TRUSTED_PROXIES $WEBRTC_ADDITIONAL_HOSTS $PUBLISH_PERMISSIONS $READ_PERMISSIONS $PATHS' \
  < /mediamtx.yml.template \
  > /tmp/mediamtx.yml

exec /mediamtx /tmp/mediamtx.yml "$@"
