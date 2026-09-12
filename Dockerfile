FROM bluenviron/mediamtx:1

RUN apk add --no-cache \
    curl \
    openssl \
    gettext

COPY mediamtx.yml.template /mediamtx.yml.template

COPY hooks/ /hooks/
RUN chmod +x /hooks/*.sh

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]