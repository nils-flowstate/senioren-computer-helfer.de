#!/usr/bin/env sh
# Vorschau-Server für die Design-Entwürfe.
#
# Bindet ausschließlich an 127.0.0.1 — genau wie die Anwendung selbst (§11).
# Nach außen ist damit nichts offen. Sichtbar wird die Vorschau über die
# Portweiterleitung, die VS Code über die bestehende SSH-Verbindung aufbaut:
# Der Mac erreicht sie unter derselben Adresse, ohne dass am VPS oder an der
# Firewall etwas geändert wird.
#
# 4321 belegt ein Nachbarprojekt, 4325 der Entwicklungsserver aus dev.sh.
set -eu

PROJEKT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${1:-4326}"

echo "Entwürfe auf http://127.0.0.1:$PORT/"
echo "In VS Code unter „Ports“ weiterleiten, dann am Mac im Browser öffnen."
echo "Beenden mit Strg+C."

exec python3 -m http.server "$PORT" \
    --bind 127.0.0.1 \
    --directory "$PROJEKT/entwuerfe"
