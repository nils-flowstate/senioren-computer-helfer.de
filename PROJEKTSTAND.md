# Projektstand

Stand: 22. August 2026

Diese Datei ist der Wiedereinstiegspunkt. Sie hält fest, was läuft, was geprüft
wurde und was vor der Freigabe noch fehlt. Verbindlich bleibt `GEO-LLM.txt` —
bei Widersprüchen gilt die Anforderung, nicht diese Datei.

Nach jedem größeren Arbeitsschritt wird sie mit aktualisiert. Ein Stand, der
nur im Kopf einer Person liegt, ist beim nächsten Mal verloren.

---

## 1. Betriebszustand

- Der Container läuft auf dem VPS: `senioren-computer-helfer`, `healthy`,
  gebunden ausschließlich an `127.0.0.1:3005`.
- Er hängt im externen Docker-Netz `proxy`. Der Reverse Proxy erreicht ihn dort
  unter seinem Dienstnamen, nicht über `127.0.0.1` — das wäre sein eigenes
  Loopback (siehe Kommentar in `compose.yaml`).
- Die Domain antwortet öffentlich über Cloudflare. `www` wird auf die
  kanonische Adresse umgeleitet (301), `http` auf `https` (308).
- **Die Website ist noch gesperrt:** `https://senioren-computer-helfer.de`
  liefert `401` mit Basic-Auth und `x-robots-tag: noindex, nofollow`. Das ist
  gewollt, solange Impressum, Datenschutz und der KI-Zugang nicht fertig sind.
  Beides wird erst zum Start entfernt.

## 2. Zuletzt geprüft (22. August 2026)

| Prüfung | Ergebnis |
| --- | --- |
| `./scripts/npm.sh run check` | 0 Fehler, 0 Warnungen (33 Dateien) |
| `./scripts/npm.sh run kontrast` | 12 von 12 Farbpaaren erfüllen WCAG 2.2 AA |
| `./scripts/npm.sh test` | 28 Tests in 3 Dateien bestanden |
| `./scripts/pruefe-auslieferung.sh` | alle Prüfungen bestanden |
| `curl 127.0.0.1:3005/api/health` | `{"status":"ok"}` |

Die Telefonprüfung in `pruefe-auslieferung.sh` wurde übersprungen, weil
`SUPPORT_PHONE` leer ist. Das ist der vorgeschriebene Auslieferungszustand
nach §16.

Zusätzlich gegengeprüft: `/api/kontakt` mit Schritt `hilfe-ja` ohne
vorangegangene Fehlversuche gibt nur die E-Mail-Adresse heraus. Der Weg an der
Eskalation vorbei läuft ins Leere.

## 3. Umgesetzt

**Gerüst und Aussehen (§8)**
Astro 5 mit Node-Adapter im Serverbetrieb. Startseite mit der vorgeschriebenen
Hauptüberschrift, Chat mittig, FAQ darunter. Schriftgrößenumschalter über
Cookie, serverseitig eingesetzt, damit die Seite beim Laden nicht springt.
Sprunglink zum Inhalt, Farbtokens aus der Palette.

**KI-Anbindung (§9)**
`src/lib/ki/index.ts` kapselt OpenAI und Anthropic hinter einer Schnittstelle.
Der Anbieterwechsel ist eine Änderung in der `.env`, kein Umbau. Die Antwort
kommt strukturiert zurück: Text, Vorlesetext, Schaltflächen, Sicherheitshinweis,
Status. Bei OpenAI ist `store: false` gesetzt.

**Eskalation (§16)**
`src/lib/kontakt/eskalation.ts` ist ein serverseitiger Zustandsautomat: drei
Fehlversuche im signierten Cookie, dann die Frage nach dem Wohnort, dann ein
zweites ausdrückliches „Ja". Erst danach entsteht überhaupt eine Telefonnummer
oder ein WhatsApp-Link. Die Nummer steht in keinem ausgelieferten HTML und in
keiner Client-Datei.

**Sicherheit**
Deterministische Betrugserkennung mit Vorrang vor der Modellantwort. Hinweis,
wenn jemand Zugangsdaten eintippt. Anfragebegrenzung je Minute, je Sitzung und
je Tag. Sicherheitskopfzeilen an genau einer Stelle (`src/middleware.ts`), CSP
ohne `unsafe-inline`. Bildinhalte werden ausdrücklich als Nutzerinhalt gerahmt,
nicht als Anweisung.

**Datenschutz (§10)**
Kein Gesprächsverlauf auf der Platte. Der Verlauf liegt im `sessionStorage` des
Browsers, der Sitzungszustand im signierten Cookie. Protokolliert werden nur
Zeitpunkt, Route, Status, Dauer und im Fehlerfall die Fehlerklasse — an einer
einzigen erlaubten Ausgabestelle.

**Docker und Betrieb (§14)**
Mehrstufiger Build, Prozess ohne Root-Rechte, schreibgeschütztes Dateisystem
mit tmpfs, `no-new-privileges`, alle Capabilities entfernt, Ressourcengrenzen,
Protokollrotation, Healthcheck. Dazu `.dockerignore`, `.env.example`, Beispiele
für Caddy und Nginx und eine README mit allen Befehlen samt Rollback.

**SEO und GEO in Teilen**
Kanonische Adresse, eigene Titel und Beschreibungen, Sitemap, `robots.txt`,
FAQPage- und WebSite-Markup aus derselben Quelle wie der sichtbare Text.

## 4. Offen

### Freigabeblocker

1. **Kein KI-Schlüssel hinterlegt.** `OPENAI_API_KEY` und `ANTHROPIC_API_KEY`
   sind leer, die Chat-Route antwortet mit `503`. Die Kernfunktion ist damit
   derzeit ohne Wirkung.
2. **`SUPPORT_EMAIL` ist ein Platzhalter** (`hilfe@example.de`). Das ist der
   Kontaktweg, der nach erfolgloser Hilfe immer angeboten wird — er führt
   gerade ins Leere.
3. **Impressum ist nicht ausgefüllt.** Name, Anschrift, E-Mail und
   gegebenenfalls Umsatzsteuer-Identifikationsnummer fehlen (§ 5 DDG).
4. **Datenschutzerklärung unvollständig.** Es fehlen die verantwortliche
   Stelle, der Name des tatsächlich eingesetzten KI-Anbieters und der Stand des
   Auftragsverarbeitungsvertrags.

### Fehlende Funktionen

5. **Spracheingabe, Vorlesen und Foto-Upload fehlen vollständig.** Es gibt
   weder Routen noch Bedienelemente. Die Methoden `transkribieren()` und
   `vorlesen()` liegen ungenutzt in `src/lib/ki/openai.ts`; `MAX_UPLOAD_MB` und
   `SITE_URL` werden von keiner Zeile gelesen. Kamera und Mikrofon sind in der
   Permissions-Policy bereits freigegeben.

   **Dringend dabei:** Die FAQ „Kann ich statt tippen auch sprechen?" antwortet
   heute mit „Ja, das ist vorgesehen. Sie können Ihre Frage sprechen …". Das
   verspricht der Zielgruppe eine Leistung, die es nicht gibt. Entweder die
   Funktion bauen oder den FAQ-Text sofort ehrlich machen.

6. **11 der 12 Unterseiten aus §4 fehlen.** Vorhanden ist nur „So funktioniert
   die Hilfe". Es fehlen: Computer, Handy, Tablet, Internet und WLAN, Drucker,
   Apps, E-Mail, Online-Banking, Betrugsverdacht, Datenschutz und Sicherheit,
   Kontakt.
7. **`/llms.txt` fehlt** (antwortet mit 404). Der GEO-Skill führt sie als
   Pflichtdatei.
8. **Gesprächsabhängige FAQ (§3) fehlen.** Die Liste ist rein statisch.

### Absicherung und Prozess

9. **Testlücken gegenüber §13.8.** Abgedeckt sind Betrugswarnungen, die drei
   Fehlversuche und das Sitzungscookie. Es fehlen Tests für den Prompt-Ablauf,
   für Dateiuploads und für das Datenschutzverhalten (Protokoll,
   Anfragebegrenzung).
10. **Die getrennte SEO- und GEO-Prüfung über die Skills ist noch nicht
    gelaufen.** Ebenso fehlt eine dokumentierte Prüfung von Tastaturbedienung,
    200 % Zoom und schmalem Mobilgerät.
11. **Basic-Auth und `noindex` müssen zum Start entfernt werden.** Sonst bleibt
    die Website für Menschen und für Antwortsysteme unsichtbar.

## 5. Vorgeschlagene Reihenfolge

1. FAQ-Antwort zur Sprachfunktion ehrlich machen — das ist eine Textänderung
   und behebt sofort ein falsches Versprechen an die Zielgruppe.
2. KI-Schlüssel und echte `SUPPORT_EMAIL` in die `.env` auf dem Server, danach
   den Chat von Hand durchspielen: Rückfrage, Lösungsschritt, drei Fehlversuche,
   Eskalation.
3. Impressum und Datenschutz ausfüllen. Beides braucht Angaben, die nur der
   Betreiber liefern kann.
4. Die Unterseiten aus §4 anlegen — mit den Skills `seo-de` und `geo-llm`
   während des Schreibens, nicht erst danach.
5. `llms.txt` ergänzen, sobald die Seiten stehen. Sie darf nur nennen, was es
   dann wirklich gibt.
6. Sprache, Vorlesen und Foto-Upload bauen, jeweils mit Route und Test.
7. Fehlende Tests aus §13.8 nachziehen.
8. Getrennte SEO- und GEO-Prüfung, Barrierefreiheitsdurchgang, danach die
   Sperre entfernen.

## 6. Wiedereinstieg

```bash
cd /home/nils/apps/senioren-helfer

docker compose ps                                  # läuft der Container?
curl -s http://127.0.0.1:3005/api/health           # antwortet er?

./scripts/npm.sh run check
./scripts/npm.sh run kontrast
./scripts/npm.sh test
./scripts/pruefe-auslieferung.sh
```

Node ist auf dem Host nicht installiert. Alle npm-Befehle laufen über
`./scripts/npm.sh` in einem Wegwerf-Container.
