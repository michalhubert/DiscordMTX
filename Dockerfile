FROM bluenviron/mediamtx:1 AS mediamtx

FROM alpine:latest

RUN apk add --no-cache \
    curl \
    openssl \
    gettext

COPY --from=mediamtx /mediamtx /mediamtx
COPY --from=mediamtx /mediamtx.yml /mediamtx.yml

COPY mediamtx.yml.template /mediamtx.yml.template

COPY hooks/ /hooks/
RUN chmod +x /hooks/*.sh

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]