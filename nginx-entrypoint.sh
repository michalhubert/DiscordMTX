#!/bin/sh
set -eu

export STREAM_UPSTREAM_HOST="${STREAM_UPSTREAM_HOST:-discordmtx}"

envsubst '$STREAM_UPSTREAM_HOST' \
  < /etc/nginx/conf.d/default.conf.template \
  > /etc/nginx/conf.d/default.conf

exec nginx -g 'daemon off;'
