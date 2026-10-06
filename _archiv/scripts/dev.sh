#!/usr/bin/env sh
# Entwicklungsserver im Container. Erreichbar nur lokal auf 127.0.0.1:4325 —
# 4321 belegt bereits ein Nachbarprojekt.
set -eu

PROJEKT="$(cd "$(dirname "$0")/.." && pwd)"

if [ -t 0 ] && [ -t 1 ]; then
    TTY_FLAGS="-it"
else
    TTY_FLAGS=""
fi

# shellcheck disable=SC2086
exec docker run --rm $TTY_FLAGS \
    --name senioren-computer-helfer-dev \
    -v "$PROJEKT:/app" \
    -v "$PROJEKT/.npm-cache:/npm-cache" \
    -w /app \
    -e npm_config_cache=/npm-cache \
    -e HOME=/tmp \
    -e ASTRO_TELEMETRY_DISABLED=1 \
    --env-file "$PROJEKT/.env" \
    --user "$(id -u):$(id -g)" \
    -p 127.0.0.1:4325:4325 \
    node:22-alpine \
    npm run dev
