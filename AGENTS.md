# Senioren-Computer-Helfer

## Vor jeder Planung und jeder Änderung

`GEO-LLM.txt` im Projektstamm ist die verbindliche Anforderung. Sie ist
**vollständig** zu lesen, bevor geplant oder Code geändert wird. Bei Widersprüchen
zwischen dieser Datei und `GEO-LLM.txt` gilt `GEO-LLM.txt`.

## Wofür diese Website gebaut wird

Zielgruppe sind ältere Menschen und Personen mit sehr geringen technischen
Kenntnissen. Jede Entscheidung — Text, Farbe, Schaltfläche, Fehlermeldung — wird an
dieser Zielgruppe gemessen, nicht an technischer Eleganz.

## Unverhandelbare Regeln

1. **Sprache:** ausschließlich Deutsch, durchgehend „Sie", kurze Sätze,
   Alltagssprache, erklärte Begriffe. Keine herablassenden Formulierungen.
   Keine Fehlercodes in der Oberfläche.
2. **Sicherheit im Gespräch:** Die KI fragt niemals nach Passwörtern, PINs oder TANs.
   Sie empfiehlt niemals Fernwartungssoftware (AnyDesk, TeamViewer und Ähnliches),
   niemals den Rückruf bei im Netz gefundenen „Support-Nummern" und niemals
   Optimierungs- oder Reinigungsprogramme. Das sind die typischen Betrugsmaschen
   gegen die Zielgruppe.
3. **Betrugsverdacht hat Vorrang** vor dem normalen Drei-Versuche-Ablauf.
4. **Datenschutz:** kein dauerhafter Gesprächsverlauf, keine Chattexte, Bilder,
   Audiodaten oder Klartext-IPs in Protokollen, keine Datei-Uploads auf die Platte.
5. **Köln wird nicht beworben.** Die Vor-Ort-Hilfe erscheint ausschließlich als
   Eskalation nach drei erfolglosen Versuchen — nicht auf der Startseite, nicht in
   den allgemeinen FAQ, nicht in strukturierten Daten.
6. **Telefonnummer und WhatsApp** dürfen nie im ausgelieferten HTML oder in
   Client-Dateien stehen. Freigabe erfolgt serverseitig nach dem Ablauf aus §16.
7. **Geheimnisse** kommen ausschließlich aus Umgebungsvariablen, niemals in `PUBLIC_`-
   Variablen, niemals ins Image, niemals nach Git.
8. **Barrierefreiheit:** WCAG 2.2 AA ist die Untergrenze. Grundschrift 20 px,
   Touch-Ziele ab 56 px, sichtbarer Tastaturfokus, `prefers-reduced-motion` beachten.
9. **Wenig Client-JavaScript.** Keine Frontend-Frameworks. Der Chat ist eine kleine
   Vanilla-Insel, die auch auf alten Tablets läuft.

## Code-Konventionen

- Bezeichner und Kommentare auf Deutsch (wie in den Nachbarprojekten).
- Kommentare erklären das *Warum*, nicht das *Was*.
- Kein Node auf dem Host: alle npm-Befehle laufen über `./scripts/npm.sh`.

## Nach jeder Änderung zu prüfen

```bash
./scripts/npm.sh run check      # TypeScript und Astro
./scripts/npm.sh run kontrast   # WCAG-Kontrast aller Farbpaare
./scripts/npm.sh test           # Vitest
docker compose build && docker compose up -d
curl -s http://127.0.0.1:3005/api/health
./scripts/pruefe-auslieferung.sh   # Inline-Skripte, Kopfzeilen, §16-Freigabe
```

Zusätzlich vor jeder Freigabe: getrennte SEO- und GEO-Prüfung über die Skills in
`.claude/skills/`, Bedienung nur mit der Tastatur, Darstellung bei 200 % Zoom und
auf schmalem Mobilgerät.
