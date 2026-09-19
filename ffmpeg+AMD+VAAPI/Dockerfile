FROM bluenviron/mediamtx:1-ffmpeg

USER root

RUN apk add --no-cache \
    # must-haves \
    curl \
    openssl \
    yq \
    # amd igpu support \
    mesa-va-gallium \
    libva \
    libva-utils
# Not really needed rn
#RUN mkdir -p /tmp/mediamtx \
#    && chown -R 1200:1200 /tmp/mediamtx

ENV LIBVA_DRIVER_NAME=radeonsi

COPY mediamtx.yml /mediamtx.yml

COPY paths.yml /opt/streams/paths.yml
# Built-in fallback
COPY paths.yml /opt/streams/paths.yml.default

COPY hooks/ /hooks/
RUN chmod +x /hooks/*.sh

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]