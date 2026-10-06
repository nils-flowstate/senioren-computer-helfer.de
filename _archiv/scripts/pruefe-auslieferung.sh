#!/usr/bin/env sh
# Prüft die ausgelieferte Website gegen die Regeln, die sich beim Bauen still
# verletzen lassen (GEO-LLM.txt §6, §10, §16).
#
# Voraussetzung: Der Container läuft.  docker compose up -d
# Aufruf:        ./scripts/pruefe-auslieferung.sh
set -eu

BASIS="${1:-http://127.0.0.1:3005}"
PROJEKT="$(cd "$(dirname "$0")/.." && pwd)"
SEITEN="/ /so-funktioniert-die-hilfe /datenschutz /impressum /404 /robots.txt"

fehler=0

melde_ok()     { printf '  OK     %s\n' "$1"; }
melde_fehler() { printf '  FEHLER %s\n' "$1"; fehler=$((fehler + 1)); }
melde_hinweis(){ printf '  ...    %s\n' "$1"; }

echo "Auslieferungsprüfung gegen $BASIS"
echo

# --- 1. Erreichbarkeit ------------------------------------------------------
echo "Erreichbarkeit"
if [ "$(curl -s "$BASIS/api/health")" = '{"status":"ok"}' ]; then
    melde_ok "/api/health antwortet"
else
    melde_fehler "/api/health antwortet nicht wie erwartet"
fi
echo

# --- 2. Keine Inline-Skripte ------------------------------------------------
# Die Richtlinie erlaubt nur "script-src 'self'". Bettet der Bau ein kleines
# Skript direkt ins HTML ein, blockiert der Browser es — der Chat bliebe stumm,
# und beim Bauen fiele nichts auf.
echo "Sicherheitsrichtlinie und Skripte"
for seite in $SEITEN; do
    treffer=$(curl -s "$BASIS$seite" | grep -c '<script type="module">' || true)
    if [ "$treffer" -eq 0 ]; then
        melde_ok "$seite ohne eingebettetes Skript"
    else
        melde_fehler "$seite enthält $treffer eingebettete(s) Skript(e) — von 'script-src self' blockiert"
    fi
done

for kopf in content-security-policy x-content-type-options x-frame-options referrer-policy permissions-policy; do
    if curl -s -o /dev/null -D - "$BASIS/" | grep -qi "^$kopf:"; then
        melde_ok "Kopfzeile $kopf gesetzt"
    else
        melde_fehler "Kopfzeile $kopf fehlt"
    fi
done
echo

# --- 3. Telefonnummer und WhatsApp ------------------------------------------
# Beide dürfen nie im ausgelieferten HTML oder in Client-Dateien stehen. Die
# Freigabe erfolgt ausschließlich serverseitig über /api/kontakt (§16).
echo "Telefonnummer und WhatsApp"
NUMMER=""
if [ -f "$PROJEKT/.env" ]; then
    NUMMER=$(grep -E '^SUPPORT_PHONE=' "$PROJEKT/.env" | cut -d= -f2- | tr -d ' +-' || true)
fi

if [ -z "$NUMMER" ]; then
    melde_hinweis "SUPPORT_PHONE ist leer — Prüfung übersprungen"
else
    for seite in $SEITEN; do
        treffer=$(curl -s "$BASIS$seite" | tr -d ' +-' | grep -c "$NUMMER" || true)
        if [ "$treffer" -eq 0 ]; then
            melde_ok "$seite ohne Telefonnummer"
        else
            melde_fehler "$seite enthält die Telefonnummer"
        fi
    done

    for datei in $(curl -s "$BASIS/" | grep -oE '/_astro/[^"]+\.(js|css)' | sort -u); do
        treffer=$(curl -s "$BASIS$datei" | tr -d ' +-' | grep -c "$NUMMER" || true)
        if [ "$treffer" -eq 0 ]; then
            melde_ok "$datei ohne Telefonnummer"
        else
            melde_fehler "$datei enthält die Telefonnummer"
        fi
    done

    # Der Angriff, auf den es ankommt: den letzten Schritt ohne den Ablauf davor.
    antwort=$(curl -s -X POST "$BASIS/api/kontakt" -H 'Content-Type: application/json' -d '{"schritt":"hilfe-ja"}')
    if printf '%s' "$antwort" | tr -d ' +-' | grep -q "$NUMMER"; then
        melde_fehler "/api/kontakt gibt die Nummer ohne den Ablauf aus §16 heraus"
    else
        melde_ok "/api/kontakt gibt ohne den vollständigen Ablauf nichts heraus"
    fi
fi
echo

# --- 4. Köln wird nicht beworben (§5, §16) ----------------------------------
echo "Vor-Ort-Hilfe wird nicht beworben"
for seite in $SEITEN; do
    treffer=$(curl -s "$BASIS$seite" | grep -ci 'köln\|koeln' || true)
    if [ "$treffer" -eq 0 ]; then
        melde_ok "$seite erwähnt die Stadt nicht"
    else
        melde_fehler "$seite erwähnt die Stadt — sie gehört nur in die Eskalation"
    fi
done
echo

if [ "$fehler" -eq 0 ]; then
    echo "Alle Prüfungen bestanden."
else
    echo "$fehler Prüfung(en) fehlgeschlagen."
    exit 1
fi
