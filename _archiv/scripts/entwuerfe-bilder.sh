#!/usr/bin/env sh
# Bildschirmfotos der Design-Entwürfe in Handygröße.
#
# Wozu: Eine Layout-Entscheidung lässt sich nicht am Quelltext beurteilen. Ein
# Textbrowser im Terminal hilft dabei ebenfalls nicht — er zeigt Abstände,
# Flächen und Schaltflächengrößen gar nicht an, und genau darum geht es hier.
# Deshalb rendert ein echtes Chromium im Wegwerf-Container und legt PNG-Dateien
# ab, die im Terminal, in VS Code und am Mac betrachtet werden können.
#
# Kein Node und kein Browser auf dem Host nötig — wie bei npm.sh und dev.sh.
set -eu

PROJEKT="$(cd "$(dirname "$0")/.." && pwd)"
ZIEL="${1:-$PROJEKT/entwuerfe/bildschirmfotos}"

# iPhone-Breite in CSS-Pixeln. Bewusst schmal: Wenn ein Entwurf hier trägt,
# trägt er überall.
BREITE=390

mkdir -p "$ZIEL"

# Drei Zustände je Entwurf. Der Wartezustand ist der wichtigste und zugleich
# der, den eine Aufnahme sonst nie trifft — dafür gibt es die Haken in demo.js.
# Standardmäßig nur der gewählte Entwurf. Ein anderes Muster als zweites
# Argument nimmt die archivierten Entwürfe wieder mit auf, etwa "[1-6]-*".
MUSTER="${2:-1-*}"

for DATEI in "$PROJEKT"/entwuerfe/$MUSTER.html; do
    NAME="$(basename "$DATEI" .html)"

    # „fold“ zeigt, was ohne Scrollen zu sehen ist. „ganz“ zeigt die volle
    # Seitenhöhe — daran erkennt man, was unter den sichtbaren Rand rutscht.
    for ZUSTAND in start warten antwort antwort-ganz faq; do
        case "$ZUSTAND" in
            start)        HAKEN="" ;         HOEHE=844  ;;
            antwort-ganz) HAKEN="#antwort" ; HOEHE=1500 ;;
            faq)          HAKEN="#faq" ;     HOEHE=1200 ;;
            *)            HAKEN="#$ZUSTAND"; HOEHE=844  ;;

        esac

        docker run --rm \
            -v "$PROJEKT/entwuerfe:/entwuerfe:ro" \
            -v "$ZIEL:/aus" \
            --user "$(id -u):$(id -g)" \
            zenika/alpine-chrome \
            --no-sandbox --disable-gpu --hide-scrollbars \
            --window-size="$BREITE,$HOEHE" \
            --virtual-time-budget=3000 \
            --screenshot="/aus/$NAME-$ZUSTAND.png" \
            "file:///entwuerfe/$NAME.html$HAKEN" >/dev/null 2>&1

        echo "  $NAME-$ZUSTAND.png"
    done
done

echo
echo "Fertig: $ZIEL"
echo "Am Mac ansehen: in VS Code im Dateibaum anklicken — die Vorschau öffnet sich dort."
