# Projektstand

Stand: 7. Oktober 2026

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

- Seit 7. Oktober 2026: Knopf „Zugang anfragen“ (WhatsApp Business, #277523)
  unter dem Login-Knopf, mit Hinweis-Dialog und eigenem Botschutz. Die Nummer
  (`PHONE_NUMBER`) gibt das Gate erst nach gelöster Rechenaufgabe heraus.
  Geprüft mit dem Skill `zugangsschutz` (Außenprüfung + Browsertest).
- Seit 7. Oktober 2026, abends: Sicherheitsprüfung mit Ladekreis, der in einen
  Haken übergeht („Sicherheitsprüfung wird durchgeführt“ → „… abgeschlossen“),
  direkt unter dem Login-Knopf und im Dialog. Hinweis-Dialog auf einen Satz
  gekürzt (Vorgabe des Skills `zugangsschutz`).

- Seit 8. Oktober 2026 (Branch `aenderung/chat-mobil-upload`): Chat mobile
  first. Kopfzeile, Verlauf und Bedienfeld füllen den Bildschirm, die Knöpfe
  stehen immer sichtbar unten. Bei Bildschirmen unter 560 px Höhe scrollt die
  Seite normal. Themen als 2×2-Raster, darüber ein Plus „Foto oder Dokument
  hinzufügen“. Beim Schreiben sitzt das Plus links im Eingabefeld. Nils bittet
  an passenden Stellen um ein Foto oder ein Bildschirmfoto. „Nils merkt sich
  das“ und der Rahmen um den Chat sind entfernt, die Kopfzeile ist kompakter.
  Am Bedienfeld steht der Pflichthinweis „Bitte geben Sie keine Passwörter,
  PINs oder TANs ein.“ (GEO-LLM §3, §10).
  Dazu: Beim Tippen auf dem Handy bekommt der Chat die Höhe des sichtbaren
  Bereichs über der Tastatur, der Verlauf bleibt darüber scrollbar. Das
  Beispiel im Eingabefeld steht in einer Zeile. Bei langem Text erscheint über
  dem Plus ein Knopf, der das Feld groß und wieder klein macht. Unter jeder
  Auswahl steht „Lass es mich selbst beschreiben“ und öffnet das Eingabefeld.
  Mitten im Gespräch bedankt sich Nils dann und stellt die offene Frage noch
  einmal, weil er den Text ohne KI-Anbindung noch nicht auswerten kann. Unter
  „Schutz vor Betrug“ startet „Neuer Chat“ das Gespräch neu.

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
- WhatsApp-Kontakt im Lockscreen („Zugang anfragen“, 7. Oktober 2026, auf
  ausdrücklichen Wunsch): Die Nummer wird damit nicht nur im Kölner
  Eskalationsablauf (§16, AGENTS.md Regel 6) freigegeben, sondern jedem, der den
  Botschutz löst. Technisch gilt Regel 6 weiter: nie im HTML, Freigabe
  serverseitig.
- Keine Content-Security-Policy: `support.js` erzeugt Code zur Laufzeit
  (`new Function`) und nutzt Inline-Styles.
- Barrierefreiheit (Kontrast, Fokus, 200 % Zoom, Tastatur) ist für die neuen
  Seiten noch nicht geprüft. Für den Chat am 8. Oktober 2026 geprüft:
  Textkontraste ab 4,9:1, Fokusrahmen, Bedienung nur mit Tastatur, 200 % Zoom
  und Querformat ohne seitliches Scrollen. Offen: Die hellen Kachelränder
  (#DFDACE) haben nur 1,3:1 gegenüber dem Hintergrund.
- Schrift und Knöpfe im Chat kleiner als AGENTS.md Regel 8 (20 px, 56 px) und
  GEO-LLM §6 („große Schrift“), auf ausdrücklichen Wunsch des Betreibers vom
  8. Oktober 2026, damit auf dem Handy alle Knöpfe ohne Scrollen sichtbar sind.
  Nachrichten 16–18 px, Knöpfe mindestens 48 px (Plus-Kreis 40 px in einer 44 px
  hohen Zeile), Hinweise 13 px.
- Fotos und Dokumente: Die Vorschau bleibt im Browser. Erst nach „Ja, bitte
  ansehen“ gehen sie über `/api/ki/ansehen` (nur mit Anmeldung, Caddy fragt das
  Gate) an den Dienst `ki/` und von dort an Claude (Anthropic, Modell und
  Aufwand aus `.env`). Der Browser verkleinert Fotos auf 1568 px. Der Dienst
  prüft Typ und Signatur, nimmt höchstens 3 Dateien je 10 MB (Bilder, PDF, TXT)
  und hält sie nur im Arbeitsspeicher. Im Protokoll stehen nur Runde, Dauer und
  Tokenzahl (AGENTS.md Regel 4). Grenzen: `RATE_LIMIT_PRO_MINUTE` je Adresse,
  `MAX_NACHRICHTEN_PRO_SITZUNG` je Gate-Sitzung, `TAGESBUDGET_ANFRAGEN` gesamt.
  Word, ODT und RTF zeigt Nils nur als Kachel und bittet um ein Foto.
- Ablauf seit 8. Oktober 2026: Nils fragt, ob er das Bild ansehen soll, bietet
  an, etwas dazuzuschreiben, und gibt dann eine Einschätzung mit bis zu drei
  Rückfragen zum Antippen (immer mit „Ich weiß es nicht“). Danach höchstens zwei
  weitere Runden mit dem nächsten Schritt, am Ende „Hat Ihnen das
  weitergeholfen?“. „Nein, noch nicht“ zählt als erfolgloser Versuch (nach drei
  folgt die Vor-Ort-Hilfe). Warnungen bei Betrugsverdacht erscheinen in der
  Warnfarbe aus GEO-LLM §8. FAQ um „Werden meine Gespräche gespeichert?“
  (Text aus GEO-LLM §3) und „Kann ich Nils ein Foto zeigen?“ ergänzt.
- Offen vor dem Live-Gang: Auftragsverarbeitungsvertrag mit Anthropic und
  Datenschutzerklärung (Anbieter, Zweck, Aufbewahrung) nach GEO-LLM §10.
