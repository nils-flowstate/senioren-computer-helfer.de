# Nils – Computerhilfe (senioren-computer-helfer.de)

Statische Website mit zwei Seiten (Chat und FAQ) hinter einem Lockscreen (Frühzugang für
Testerinnen und Tester). Die Inhalte stammen aus dem Neubau-Paket
`neubau/Nils Computerhilfe Farbkonzepte.zip`. Die frühere Astro-Anwendung liegt
unverändert in `_archiv/`.

Technische Einzelheiten zu Gate, Botschutz und Sperre: **CLAUDE-CODE.md**
(Übergabe aus dem Paket). Abweichend davon läuft die Website hier hinter dem
zentralen Caddy, siehe unten.

## Aufbau

```
Internet → Cloudflare → zentraler Caddy (/home/nils/caddy, TLS)
         → web  (Caddy, Container "senioren-computer-helfer", Port 3005)
         → gate (Node, Container "senioren-computer-helfer-gate", nur intern)
```

| Datei | Zweck |
| --- | --- |
| `Caddyfile` | Routing, `forward_auth` ans Gate, Sicherheitskopfzeilen, Besucher-IP |
| `Dockerfile` | `caddy:2-alpine` mit `site/`, ohne Root, ohne Zusatzrechte |
| `compose.yaml` | `web` + `gate`, Volume `gate_data`, Netz `proxy` |
| `gate/` | Passwortprüfung, Rechenaufgabe, Sperre nach 5 Fehlversuchen (48 h), WhatsApp-Link für „Zugang anfragen“ |
| `site/` | Seiten, Laufzeit `support.js`, React lokal, Schriften lokal |

**Besucher-IP:** Der zentrale Caddy vertraut Cloudflare nicht und reicht die
Cloudflare-Adresse weiter. Der `Caddyfile` übernimmt deshalb `CF-Connecting-IP`,
aber nur, wenn die Anfrage nachweislich aus einem Cloudflare-Adressbereich kam.
Sonst gilt der tatsächliche Absender. Ändert Cloudflare seine Bereiche
(https://www.cloudflare.com/ips-v4 und `ips-v6`), den Block `(cloudflare)` im
`Caddyfile` nachziehen.

## Befehle

```bash
cd /home/nils/apps/senioren-helfer

docker compose build                 # Images bauen
docker compose up -d                 # starten bzw. nach Änderungen neu starten
docker compose ps                    # Zustand (web muss "healthy" sein)
docker compose logs -f               # Protokolle
curl -s http://127.0.0.1:3005/health # lokale Funktionskontrolle → ok
```

**Update:** Dateien in `site/` oder `Caddyfile` ändern, dann
`docker compose up -d --build`.

**Passwort ändern:** `printf %s 'NEU' | sha256sum` → Wert als
`GATE_PASSWORD_SHA256` in `.env` → `docker compose up -d`. Alle offenen
Sitzungen enden damit sofort, weil der Passwort-Hash in die Sitzungssignatur
eingeht.

**Was ohne Passwort erreichbar ist:** nur der Lockscreen (unter jeder Adresse),
was er zum Anzeigen braucht (`/lock.html`, `/support.js`, `/nils.webp`,
`/fonts/*`, `/vendor/*`), die Gate-Schnittstelle `/gate/challenge`,
`/gate/login` und `/gate/whatsapp`, `/robots.txt` (verbietet alles) und `/health`. Fällt das Gate
aus, bleibt die Website zu (404 statt Inhalt). Cloudflare speichert nur diese
öffentlichen Dateien bis zu 4 Stunden zwischen; Inhaltsseiten tragen
`Cache-Control: no-store`.

**IP entsperren:**

```bash
docker compose stop gate
docker run --rm -v senioren-helfer_gate_data:/data alpine \
  sh -c 'printf "{\"fails\":{},\"bans\":{}}" > /data/gate.json && chown 1000:1000 /data/gate.json'
docker compose start gate
```

(Das löscht alle Fehlversuche und Sperren. Einzelne Einträge: Datei vorher mit
`cat` ansehen und gezielt bearbeiten.)

**Zugang anfragen (WhatsApp):** grüner Knopf (#277523) unter dem Login-Knopf.
Er öffnet einen Hinweis-Dialog („Wenn Sie weiterklicken, erklären Sie sich
einverstanden, an WhatsApp Business weitergeleitet zu werden.“). Der
Dialog löst eine eigene Rechenaufgabe (`/gate/challenge?fuer=anfrage`, auch für
gesperrte Adressen), erst dann gibt `/gate/whatsapp` den `wa.me`-Link heraus.
Die Nummer steht nie im HTML. Nummer ändern: `PHONE_NUMBER` in `.env`, dann
`docker compose up -d`.

**Login-Dialog bleibt:** Wird ein neuer Export (Claude Design) eingespielt,
bleibt `site/lock.html` samt Botschutz und WhatsApp-Knopf erhalten, außer es ist
ausdrücklich ein neuer Login-Dialog gewünscht. Danach Skill `zugangsschutz`.

## Geheimnisse

`.env` enthält `GATE_PASSWORD_SHA256` (Passwort nur als Hash), `GATE_SECRET`
und `PHONE_NUMBER`. Sie gehört nicht nach
Git und nicht ins Image (`.dockerignore` lässt nur `Caddyfile` und `site/` in
den Build-Kontext). Die übrigen Variablen in `.env` stammen von der alten
Anwendung und werden von der neuen nicht gelesen. Sie bleiben für die spätere
Chat-Anbindung erhalten. `GATE_SECRET` zu ändern beendet alle offenen Sitzungen.

## Rückweg zur alten Website

Das alte Image `senioren-computer-helfer:aktuell` ist noch vorhanden.

```bash
cd /home/nils/apps/senioren-helfer
docker compose down                                    # neue Website stoppen
cd _archiv && docker compose -p senioren-alt up -d     # alte Anwendung starten
```

Die alte Anwendung bringt keine Anmeldung mit. Wer die Sperre zurück will, setzt
im zentralen Caddy den `basic_auth`-Block wieder ein (Sicherung:
`/home/nils/caddy/Caddyfile.sicherung-20261006-205024`).

## Zentraler Caddy

`/home/nils/caddy/Caddyfile` ist als einzelne Datei in den Container
eingebunden. Editoren ersetzen beim Speichern oft die Datei, und der Container
sieht dann weiter die alte. Nach einer Änderung deshalb:

```bash
docker exec -i caddy sh -c 'cat > /etc/caddyfile' < /home/nils/caddy/Caddyfile
docker exec caddy caddy reload --config /etc/caddyfile --adapter caddyfile
```
