#!/usr/bin/env sh
# Auf diesem Server ist kein Node installiert. Alle npm-Befehle laufen deshalb in
# einem Wegwerf-Container mit demselben Node wie das spätere Laufzeit-Image.
# Der npm-Cache liegt im Projekt, damit wiederholte Installationen schnell bleiben.
set -eu

PROJEKT="$(cd "$(dirname "$0")/.." && pwd)"

# Ein Terminal nur anfordern, wenn auch eines da ist — sonst schlägt der Aufruf
# in Skripten und in Werkzeugen ohne TTY fehl.
if [ -t 0 ] && [ -t 1 ]; then
    TTY_FLAGS="-it"
else
    TTY_FLAGS=""
fi

# shellcheck disable=SC2086
exec docker run --rm $TTY_FLAGS \
    -v "$PROJEKT:/app" \
    -v "$PROJEKT/.npm-cache:/npm-cache" \
    -w /app \
    -e npm_config_cache=/npm-cache \
    -e HOME=/tmp \
    -e ASTRO_TELEMETRY_DISABLED=1 \
    --user "$(id -u):$(id -g)" \
    node:22-alpine \
    npm "$@"
