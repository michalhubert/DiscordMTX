FROM bluenviron/mediamtx:1 AS mediamtx

FROM alpine:latest

RUN apk add --no-cache \
    curl \
    openssl \
    yq

COPY --from=mediamtx /mediamtx /mediamtx

COPY mediamtx.yml /mediamtx.yml

COPY paths.yml /opt/streams/paths.yml
# Built-in fallback
COPY paths.yml /opt/streams/paths.yml.default

COPY hooks/ /hooks/
RUN sed -i 's/\r$//' /hooks/*.sh && chmod +x /hooks/*.sh

COPY entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]