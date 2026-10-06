# Übergabe an Claude Code: Nils-Website auf dem VPS (Docker + Caddy)

## Ziel
Statische Website (3 Seiten) hinter einem Lockscreen. Caddy liefert aus und macht HTTPS. Ein kleiner Node-Dienst (`gate`) prüft Passwort, Botschutz und sperrt IPs nach 5 Fehlversuchen für 48 h.

## Struktur
```
export/
├─ Caddyfile            Routing, forward_auth ans Gate, Security-Header
├─ Dockerfile           caddy:2-alpine + site/
├─ docker-compose.yml   web (Caddy) + gate (Node), Volumes
├─ .env.example         SITE_DOMAIN, GATE_PASSWORD_SHA256, GATE_SECRET → nach .env kopieren
├─ gate/
│  ├─ server.js         Gate-Dienst, ohne npm-Abhängigkeiten
│  └─ Dockerfile        node:20-alpine, läuft als User node
└─ site/
   ├─ lock.html         Lockscreen (Passwort + „Weiter zum Onboarding“)
   ├─ index.html        Computerhilfe / Chat mit Nils (= Onboarding-Ziel)
   ├─ faq.html, vor-ort-hilfe.html
   ├─ support.js        Laufzeit der Seiten (rendert die Templates im Browser)
   ├─ vendor/           React 18.3.1 lokal
   ├─ fonts/            Nunito + Source Sans 3 lokal
   └─ nils.webp
```
Keine Anfragen an Drittanbieter (keine Google Fonts, kein CDN, kein externer Captcha-Dienst).

## Deployment
1. `export/` auf den VPS kopieren, z. B. `/opt/nils-web`.
2. `cp .env.example .env`, dann:
   - `SITE_DOMAIN` setzen (DNS A/AAAA → VPS, Ports 80 + 443 TCP/UDP offen)
   - `GATE_SECRET` mit `openssl rand -hex 32` erzeugen (Pflicht, sonst startet das Gate nicht)
3. `docker compose up -d --build`
4. `docker compose logs -f` – Caddy holt das Zertifikat, Gate meldet „nils-gate läuft auf :3000“.
5. Läuft schon ein Reverse Proxy auf 80/443: Ports in compose entfernen, `web` ins Proxy-Netz hängen, im Caddyfile `{$SITE_DOMAIN}` → `:80`. Dann am vorderen Proxy die echte Client-IP durchreichen und in Caddy `servers { trusted_proxies static <proxy-ip> }` setzen – sonst sperrt das Gate den Proxy statt der Besucher.

## Ablauf Lockscreen
1. Aufruf einer beliebigen Seite → Caddy fragt `gate:3000/gate/check`. Kein gültiges Cookie → 401 → Caddy liefert `lock.html` unter derselben URL.
2. `lock.html` holt beim Laden sofort `GET /gate/challenge` und löst die Rechenaufgabe im Hintergrund (Proof-of-Work, SHA-256, Standard bis 50 000 Versuche, typ. < 1 s). Senioren sehen nur „Sicherheitsprüfung läuft automatisch …“ – kein Bilderrätsel.
3. Absenden → `POST /gate/login` mit Passwort, Lösung und Honeypot-Feld `website` (unsichtbar; Bots füllen es aus).
4. Gate prüft: IP gesperrt? → Signatur, Ablauf (10 min) und Einmaligkeit der Aufgabe → Passwort (SHA-256, zeitkonstanter Vergleich).
5. Richtig → Cookie `nils_session` (HttpOnly, SameSite=Strict, Secure, **ohne Ablaufdatum = Session-Cookie**, serverseitig max. 12 h gültig) → Seite lädt neu.
6. Falsch → 401 mit `left` (Restversuche). Beim 5. Fehlversuch innerhalb von 48 h → 429, IP für 48 h gesperrt. Lockscreen zeigt „Zugang vorübergehend gesperrt … wieder möglich ab …“.

## Botschutz und Sperre – Details
- Fehlversuche zählen nur mit gültig gelöster Rechenaufgabe. Bots ohne Lösung werden mit 400 abgewiesen, ohne Zähler.
- Bei Sperre liefert auch `/gate/challenge` 429, d. h. der Lockscreen zeigt sofort den Sperrhinweis.
- Gespeichert in Volume `gate_data` (`/data/gate.json`): nur IP → Zeitstempel der Fehlversuche/Sperre. Wird nach Ablauf automatisch gelöscht (DSGVO: Zweckbindung Missbrauchsschutz, Art. 6 Abs. 1 lit. f – in der Datenschutzerklärung erwähnen).
- Im Browser wird nichts dauerhaft gespeichert: kein localStorage, kein sessionStorage, nur das Session-Cookie. Browser schließen = wieder gesperrt.
- Schwierigkeit anpassen: Umgebungsvariable `GATE_POW_MAX` am `gate`-Service (Standard 50000; höher = langsamer für Bots und alte Handys).
- IP manuell entsperren: `docker compose exec gate sh`, dann `/data/gate.json` bearbeiten, `docker compose restart gate`.
- Passwort ändern: `printf %s 'NEU' | sha256sum` → `GATE_PASSWORD_SHA256` in `.env` → `docker compose up -d`.
- `GATE_SECRET` ändern macht alle offenen Sitzungen ungültig.
- Hinweis: Eine IP kann mehrere Kunden betreffen (Mobilfunk/CGNAT). Für die Testphase akzeptabel.

## Technische Hinweise
- Alle Pfade sind absolut (`/support.js`, `/fonts/…`), weil `lock.html` unter jeder URL ausgeliefert wird. Betrieb in einem Unterpfad erfordert Anpassung.
- `support.js` lädt die eigene Seite einmal per `fetch(location.href)` nach – funktioniert, weil das Cookie mitgeschickt wird.
- Prüfen, dass `handle_response` innerhalb von `forward_auth` mit der eingesetzten Caddy-Version greift (getestet konzipiert für Caddy 2.7+). Fallback: `@denied status 401` durch `@denied status 4xx` ersetzen.
- Echte Client-IP: Caddy setzt `X-Forwarded-For` selbst; das Gate nimmt den ersten Eintrag. Im Access-Log `remote_ip` prüfen – `172.x.x.x` (Docker-Gateway) bedeutet, die echte IP geht verloren (dann `"userland-proxy": false` in `/etc/docker/daemon.json`).
- `X-Robots-Tag: noindex` für den Frühzugang. Für den öffentlichen Start entfernen.

## Test-Checkliste
- [ ] `/`, `/faq`, `/vor-ort-hilfe.html` ohne Cookie → Lockscreen; Punkt wird grün („Sicherheitsprüfung abgeschlossen“).
- [ ] `curl -s https://DOMAIN/gate/check` → 404 (nicht öffentlich).
- [ ] Falsches Passwort → „noch 4 Versuche“ usw.
- [ ] Richtiges Passwort → Chat mit Nils; Navigation zu FAQ und Vor-Ort-Hilfe.
- [ ] Browser komplett schließen → wieder Lockscreen.
- [ ] 5× falsch → Sperrhinweis mit Datum; Neuladen zeigt weiter die Sperre. `/data/gate.json` enthält die IP. Danach entsperren.
- [ ] `curl -X POST https://DOMAIN/gate/login -d '{"password":"x"}'` → 400 (ohne Rechenaufgabe kein Versuch).
- [ ] DevTools → Network: keine fremden Domains.
- [ ] Mobil (375 px): kein seitliches Scrollen.
- [ ] `curl -I https://DOMAIN/` zeigt die Security-Header.

## Offen vor öffentlichem Start
- Impressum + Datenschutzerklärung anlegen und in `@public` aufnehmen (müssen ohne Passwort erreichbar sein). Gate-Speicherung der IP dort erwähnen.
- Die Seite Vor-Ort-Hilfe ist noch eine interne Fassung.
- Chat ist ein Prototyp; Anbindung an n8n (W1–W9) später über `handle /api/* { reverse_proxy n8n:5678 }`.
