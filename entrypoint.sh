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

# Dynamically set an environment variable, given its name and value.
mtx_export() {
  eval "$1=\"\$2\""
  eval "export $1"
}

HOOK_ONLINE="${HOOK_ONLINE:-/hooks/stream-online.sh}"
HOOK_ONLINE_RESTART="${HOOK_ONLINE_RESTART:-false}"
HOOK_OFFLINE="${HOOK_OFFLINE:-/hooks/stream-offline.sh}"
export DISCORD_WEBHOOK_URL="${DISCORD_WEBHOOK_URL:-}"
export DISCORD_WEBHOOK_URLS="${DISCORD_WEBHOOK_URLS:-}"

# The "streamer" password below is used for two things:
#  - MediaMTX's "streamer" internal user (WHIP publish, from OBS)
#  - The Next.js /dock (OBS HUD) login, checked directly against this env var
STREAMER_PASSWORD="${STREAMER_PASSWORD:-discordmtx_streamer_pass}"

# MediaMTX natively supports configuration through MTX_<PARAMNAME> environment
# variables (see https://mediamtx.org/docs/features/configuration), so the
# configuration is built by exporting these variables instead of rendering a
# whole mediamtx.yml file.
export MTX_AUTHINTERNALUSERS_0_USER="streamer"
export MTX_AUTHINTERNALUSERS_0_PASS="$STREAMER_PASSWORD"

# Grant streamer API and metrics permissions at index 0 and 1
mtx_export "MTX_AUTHINTERNALUSERS_0_PERMISSIONS_0_ACTION" "api"
mtx_export "MTX_AUTHINTERNALUSERS_0_PERMISSIONS_1_ACTION" "metrics"

# Grant anonymous/viewer user API and metrics permissions
export MTX_AUTHINTERNALUSERS_1_USER="any"
mtx_export "MTX_AUTHINTERNALUSERS_1_PERMISSIONS_0_ACTION" "api"
mtx_export "MTX_AUTHINTERNALUSERS_1_PERMISSIONS_1_ACTION" "metrics"

# Arrays are overridden with a plain comma-separated list, no YAML needed.
export MTX_WEBRTCTRUSTEDPROXIES="${WEBRTC_TRUSTED_PROXIES:-0.0.0.0/0,::/0}"
export MTX_APITRUSTEDPROXIES="${API_TRUSTED_PROXIES:-0.0.0.0/0,::/0}"
export MTX_WEBRTCADDITIONALHOSTS="${WEBRTC_ADDITIONAL_HOSTS:-}"

# Add publish/read permissions and hooks for every path defined in $PATHS_FILE.
COUNT=$(yq eval '.paths | length' "$PATHS_FILE")

i=0
while [ "$i" -lt "$COUNT" ]; do
  NAME=$(yq eval ".paths[$i].name" "$PATHS_FILE")
  HOOK_ON=$(yq eval ".paths[$i].hook_online // \"${HOOK_ONLINE}\"" "$PATHS_FILE")
  HOOK_OFF=$(yq eval ".paths[$i].hook_offline // \"${HOOK_OFFLINE}\"" "$PATHS_FILE")
  HOOK_RESTART=$(yq eval ".paths[$i].hook_online_restart // \"${HOOK_ONLINE_RESTART}\"" "$PATHS_FILE")

  # MediaMTX maps map keys to uppercase env var segments, e.g. "desktop" -> "DESKTOP".
  # Path names with "-" or "_" are ambiguous for MediaMTX's env var parser and are not supported.
  ENV_NAME=$(echo "$NAME" | tr '[:lower:]' '[:upper:]')

  PERM_INDEX=$((i + 2))
  mtx_export "MTX_AUTHINTERNALUSERS_0_PERMISSIONS_${PERM_INDEX}_ACTION" "publish"
  mtx_export "MTX_AUTHINTERNALUSERS_0_PERMISSIONS_${PERM_INDEX}_PATH" "$NAME"

  mtx_export "MTX_AUTHINTERNALUSERS_1_PERMISSIONS_${PERM_INDEX}_ACTION" "read"
  mtx_export "MTX_AUTHINTERNALUSERS_1_PERMISSIONS_${PERM_INDEX}_PATH" "$NAME"

  mtx_export "MTX_PATHS_${ENV_NAME}_RUNONREADY" "$HOOK_ON"
  mtx_export "MTX_PATHS_${ENV_NAME}_RUNONNOTREADY" "$HOOK_OFF"
  mtx_export "MTX_PATHS_${ENV_NAME}_RUNONONLINE" "$HOOK_ON"
  mtx_export "MTX_PATHS_${ENV_NAME}_RUNONOFFLINE" "$HOOK_OFF"
  mtx_export "MTX_PATHS_${ENV_NAME}_RUNONONLINERESTART" "$HOOK_RESTART"

  i=$((i + 1))
done

exec /mediamtx "$@"
