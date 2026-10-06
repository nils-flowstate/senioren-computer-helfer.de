# Senioren-Computer-Helfer

Technik-Hilfe in einfacher Sprache für Computer, Handy, Tablet, Internet,
Drucker, E-Mail und Apps. Die Website richtet sich an ältere Menschen und an
Personen mit sehr geringen technischen Kenntnissen.

Verbindliche Anforderung ist `GEO-LLM.txt` im Projektstamm. Sie ist vor jeder
Planung und jeder Änderung vollständig zu lesen. Bei Widersprüchen zwischen
dieser README und `GEO-LLM.txt` gilt `GEO-LLM.txt`.

- Kanonische Adresse: <https://senioren-computer-helfer.de>
- Interner Anwendungsport: 3005, gebunden ausschließlich an 127.0.0.1
- Betriebsweg: Docker Compose hinter einem Reverse Proxy

---

## 1. Voraussetzungen auf dem VPS

- Linux mit Docker und Docker Compose (Plugin `docker compose`, nicht das alte
  `docker-compose`)
- Ein Reverse Proxy, der TLS abschließt: Caddy oder Nginx
- DNS-A-Eintrag (und gegebenenfalls AAAA) auf die IP des VPS
- Öffentlich offen sind nur Port 80 und 443. **Port 3005 wird nicht
  freigegeben.**

Node muss auf dem Host nicht installiert sein. Alle npm-Befehle laufen über
`./scripts/npm.sh` in einem Wegwerf-Container.

## 2. Installation

```bash
git clone <repository-adresse> /srv/senioren-computer-helfer
cd /srv/senioren-computer-helfer

cp .env.example .env
```

Danach `.env` ausfüllen. Zwingend erforderlich sind:

| Variable | Bedeutung |
| --- | --- |
| `SESSION_SECRET` | Signiert das Sitzungs-Cookie. Ohne diesen Wert startet die Anwendung in der Produktion nicht. Erzeugen mit `openssl rand -hex 32`. |
| `OPENAI_API_KEY` bzw. `ANTHROPIC_API_KEY` | Zugang zum KI-Dienst, passend zu `KI_ANBIETER`. |
| `SUPPORT_EMAIL` | Der Kontaktweg, der nach erfolgloser Hilfe immer angeboten wird. |

Rechte einschränken, damit die Datei nur dem Dienstbenutzer gehört:

```bash
chmod 600 .env
```

## 3. Bauen und starten

```bash
docker compose build
docker compose up -d
```

Zustand ansehen:

```bash
docker compose ps
```

In der Spalte `STATUS` muss nach etwa 15 Sekunden `(healthy)` stehen.

## 4. Funktionskontrolle

```bash
curl -s http://127.0.0.1:3005/api/health
```

Erwartete Ausgabe:

```json
{"status":"ok"}
```

Die Route gibt bewusst keine Versionen, Pfade oder Anbieternamen aus (§11).

Von außen darf Port 3005 **nicht** erreichbar sein. Gegenprobe von einem
anderen Rechner aus:

```bash
curl --max-time 5 http://<ip-des-vps>:3005/api/health   # muss scheitern
```

## 5. Protokolle

```bash
docker compose logs -f app          # laufend mitlesen
docker compose logs --tail=100 app  # die letzten 100 Zeilen
```

Im Protokoll stehen ausschließlich Zeitpunkt, Route, Statuscode, Dauer und im
Fehlerfall die Fehlerklasse. Chattexte, Fotos, Audiodaten und Klartext-IPs
kommen dort nicht vor (§10). Die einzige erlaubte Ausgabestelle ist
`src/lib/schutz/protokoll.ts`.

Die Rotation ist in `compose.yaml` festgelegt: höchstens fünf Dateien zu je
10 MB, also maximal 50 MB je Container.

## 6. Aktualisieren

```bash
cd /srv/senioren-computer-helfer
git pull
docker compose build
docker compose up -d
docker compose ps
curl -s http://127.0.0.1:3005/api/health
```

`docker compose up -d` tauscht den Container nur aus, wenn sich das Image
geändert hat. Ein laufendes Gespräch bricht dabei ab — die Sitzung steckt im
Cookie, das Gespräch selbst im Browser der Person.

## 7. Kontrollierter Neustart

```bash
docker compose restart app     # Container neu starten, Image bleibt
docker compose down            # anhalten und entfernen
docker compose up -d           # wieder starten
```

Nach jedem Neustart sind die Zähler für die Anfragebegrenzung leer. Das ist
beabsichtigt: Sie hängen an personenbezogenen Merkmalen und gehören nicht auf
die Platte.

## 8. Rücksetzen (Rollback)

**Weg A — auf einen früheren Git-Stand:**

```bash
git log --oneline -10        # den letzten funktionierenden Stand heraussuchen
git checkout <commit>
docker compose build
docker compose up -d
```

**Weg B — auf ein früheres Image, ohne neu zu bauen:**

Vor jedem Update ein Sicherungsetikett vergeben:

```bash
docker tag senioren-computer-helfer:aktuell senioren-computer-helfer:vorher
```

Zurückgehen:

```bash
docker tag senioren-computer-helfer:vorher senioren-computer-helfer:aktuell
docker compose up -d --no-build
```

Weg B ist der schnellere und braucht keinen funktionierenden Bau.

## 9. Produktionsgeheimnisse

- Geheimnisse stehen ausschließlich in `.env` auf dem Server.
- `.env` ist in `.gitignore` und in `.dockerignore` ausgeschlossen. Sie landet
  weder in Git noch in einem Image.
- Keine Variable trägt das Präfix `PUBLIC_`. Damit erreicht kein Geheimnis den
  Browser.
- Im Repository wird ausschließlich `.env.example` gepflegt — ohne echte Werte.
- Nach einer Änderung an `.env` genügt `docker compose up -d`; die Werte werden
  beim Start des Containers gelesen.

## 10. Sicherheitseinstellungen des Containers

Festgelegt in `compose.yaml`, jeweils mit Begründung im Kommentar:

- Portbindung ausschließlich an `127.0.0.1:3005`
- Prozess ohne Root-Rechte, `no-new-privileges`, alle Capabilities entfernt
- Schreibgeschütztes Dateisystem; beschreibbar ist nur ein tmpfs unter `/tmp`
  im Arbeitsspeicher — Fotos und Sprachaufnahmen berühren die Platte nie
- Keine dauerhaften Volumes
- Der Docker-Socket wird nicht eingebunden
- Ressourcengrenzen: 1 CPU, 512 MB Arbeitsspeicher

## 11. Reverse Proxy

Beispiele liegen bereit:

- `docker/Caddyfile.beispiel`
- `docker/nginx.beispiel.conf`

Beide setzen **keine** Sicherheitskopfzeilen. Diese kommen ausschließlich aus
`src/middleware.ts`. Zwei Setzorte überschreiben einander still, und der Fehler
wird dann an der falschen Stelle gesucht.

Wichtig bei Nginx: `proxy_set_header X-Forwarded-Proto $scheme;` ist nicht
optional. Fehlt die Zeile, hält sich die Anwendung für unverschlüsselt
erreichbar, setzt `Secure` nicht auf das Sitzungs-Cookie und sendet keine
HSTS-Kopfzeile — ohne jede Fehlermeldung. Caddy setzt die Kopfzeile von selbst.

## 12. Entwicklung

```bash
./scripts/npm.sh install       # Abhängigkeiten
./scripts/dev.sh               # Entwicklungsserver auf 127.0.0.1:4325
```

Nach jeder Änderung zu prüfen:

```bash
./scripts/npm.sh run check      # TypeScript und Astro
./scripts/npm.sh run kontrast   # WCAG-Kontrast aller Farbpaare
./scripts/npm.sh test           # Vitest
docker compose build && docker compose up -d
curl -s http://127.0.0.1:3005/api/health
./scripts/pruefe-auslieferung.sh
```

`./scripts/pruefe-auslieferung.sh` prüft am laufenden Container das, was sich
beim Bauen still verletzen lässt: eingebettete Skripte, die von der
Sicherheitsrichtlinie blockiert würden, fehlende Sicherheitskopfzeilen, die
Telefonnummer im ausgelieferten HTML und die Freigabe über `/api/kontakt` ohne
den Ablauf aus §16.

Den Eskalationsweg mit Telefonnummer prüft das Skript nur, wenn `SUPPORT_PHONE`
gefüllt ist. Zum Testen vorübergehend `ENABLE_PHONE_SUPPORT=true` und eine
Platzhalternummer eintragen, `docker compose up -d` ausführen und danach wieder
auf `false` und leer zurücksetzen — so bleibt der Auslieferungszustand der, den
§16 vorschreibt.

Zusätzlich vor jeder Freigabe: getrennte SEO- und GEO-Prüfung über die Skills
in `.claude/skills/`, Bedienung nur mit der Tastatur, Darstellung bei 200 %
Zoom und auf einem schmalen Mobilgerät.
