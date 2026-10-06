# Projektstand

Stand: 6. Oktober 2026

Wiedereinstiegspunkt. Der Stand der alten Astro-Anwendung (bis 24. August 2026)
steht in `_archiv/PROJEKTSTAND.md`.

## 1. Was läuft

- Die Website ist durch das Neubau-Paket ersetzt (`neubau/Nils Computerhilfe
  Farbkonzepte.zip`): zwei statische Seiten (Chat-Prototyp, FAQ) hinter einem
  Lockscreen. Preisseite, Vor-Ort-Hilfe-Seite und die Platzhalter-
  Telefonnummer sind am 6. Oktober 2026 entfernt worden.
- Container `senioren-computer-helfer` (Caddy, `healthy`, 127.0.0.1:3005, Netz
  `proxy`) und `senioren-computer-helfer-gate` (Node, nur intern).
- Die Basic-Auth im zentralen Caddy ist entfernt. Einziges Schloss ist der
  Lockscreen. `noindex` bleibt (setzt der zentrale Caddy).
- Die alte Anwendung liegt in `_archiv/`, ihr Image ist noch vorhanden
  (Rückweg in der README).

## 2. Geprüft am 6. Oktober 2026 (über https://senioren-computer-helfer.de)

| Prüfung | Ergebnis |
| --- | --- |
| Ohne Sitzung `/`, `/faq.html` | Lockscreen, Sicherheitsprüfung wird grün |
| `/gate/check` von außen | 404 |
| Login ohne Rechenaufgabe / mit Honeypot | 400, kein Fehlversuch gezählt |
| Falsches Passwort | 401, „noch 4 Versuche“ |
| Gespeicherte Adresse | echte Besucheradresse, nicht Cloudflare |
| Direkter Aufruf am Cloudflare-Schutz vorbei mit gefälschtem `CF-Connecting-IP` | gefälschter Wert ignoriert |
| Login (mit befristetem Testpasswort) | Cookie `HttpOnly; SameSite=Strict; Secure`, alle Seiten 200 |
| Über 100 Umgehungsversuche (Pfad-Tricks, Kodierung, Methoden, gefälschte Köpfe und Cookies), öffentlich und direkt | kein Inhalt außer Lockscreen |
| Gate gestoppt | 404, kein Inhalt |
| Passwort geändert | alte Sitzungen sofort ungültig |
| Chromium bei 390 px | kein seitliches Scrollen, keine fremden Domains, keine Skriptfehler |

Der Login mit dem echten Passwort ist ebenfalls geprüft (siehe unten).

## 3. Änderungen gegenüber dem Paket

- Betrieb hinter dem zentralen Caddy statt eigener TLS (Port 3005, Netz `proxy`).
- Besucher-IP aus `CF-Connecting-IP`, nur bei Anfragen aus Cloudflare-Bereichen.
- Kein Caddy-Zugriffsprotokoll; das Gate protokolliert gesperrte Adressen nicht
  mehr im Klartext.
- Container gehärtet (ohne Root, schreibgeschützt, `cap_drop: ALL`, Grenzen).
- Gate auf `node:22-alpine` (Node 20 wird seit April 2026 nicht mehr gepflegt).
- `lock.html`: Weiterleitung nach Login bei direktem Aufruf von `/lock.html`
  auf `/` statt auf die Entwurfsdatei.
- `index.html`: fehlender `<title>` ergänzt.

## 4. Offen

### Vor einem öffentlichen Start

1. Impressum und Datenschutzerklärung anlegen und ohne Passwort erreichbar
   machen (`@public` im `Caddyfile`). Die IP-Speicherung des Gates dort nennen.
2. Der Chat ist ein Prototyp ohne KI-Anbindung. Später über
   `handle /api/* { reverse_proxy … }` im `Caddyfile`.

### Abweichungen von GEO-LLM.txt und AGENTS.md

Das Paket wurde auf ausdrücklichen Wunsch unverändert übernommen. Es weicht
von den bisherigen Vorgaben ab. Diese Punkte müssen bewusst entschieden werden:

- Köln und der Hausbesuch erscheinen im Chat-Prototyp (Stadtfrage,
  Buchungsdialog) und in der FAQ. Ob nur als Eskalation nach drei
  Fehlversuchen (Regel 5, §16), ist nicht geprüft.
- React im Browser statt „wenig Client-JavaScript, keine Frameworks“ (Regel 9).
- Anmeldung vor der Nutzung (§6 „Keine Anmeldung“) — für den Frühzugang gewollt.
- Keine Content-Security-Policy: `support.js` erzeugt Code zur Laufzeit
  (`new Function`) und nutzt Inline-Styles.
- Barrierefreiheit (Kontrast, Fokus, 200 % Zoom, Tastatur) ist für die neuen
  Seiten noch nicht geprüft.
