FROM caddy:2-alpine

# Caddy schreibt nichts Dauerhaftes: keine Zertifikate (TLS macht der zentrale
# Caddy), keine gespeicherte Konfiguration. Was doch anfällt, landet im tmpfs.
ENV XDG_CONFIG_HOME=/tmp \
    XDG_DATA_HOME=/tmp

# Das offizielle Image gibt Caddy das Recht, Ports unter 1024 zu öffnen. Auf
# 3005 braucht es das nicht — und mit cap_drop: ALL würde der Start sonst
# scheitern.
RUN apk add --no-cache libcap \
 && setcap -r /usr/bin/caddy \
 && apk del libcap

COPY Caddyfile /etc/caddy/Caddyfile
COPY site/ /srv/

USER 65534:65534

EXPOSE 3005
