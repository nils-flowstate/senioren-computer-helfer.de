# Projektstand

Stand: 24. August 2026

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

## 2. Zuletzt geprüft (24. August 2026)

| Prüfung | Ergebnis |
| --- | --- |
| `./scripts/npm.sh run check` | 0 Fehler, 0 Warnungen (36 Dateien) |
| `./scripts/npm.sh run kontrast` | 12 von 12 Farbpaaren erfüllen WCAG 2.2 AA |
| `./scripts/npm.sh test` | 53 Tests in 4 Dateien bestanden |
| `./scripts/pruefe-auslieferung.sh` | alle Prüfungen bestanden |
| `curl 127.0.0.1:3005/api/health` | `{"status":"ok"}` |

`SUPPORT_PHONE` und `SUPPORT_WHATSAPP` sind jetzt gefüllt, die Telefonprüfung
läuft also wirklich: Die Nummer steht in keiner ausgelieferten Seite und in
keiner Client-Datei. `ENABLE_PHONE_SUPPORT` und `ENABLE_WHATSAPP_SUPPORT`
stehen auf `false` — solange bietet die Eskalation ausschließlich die
Support-E-Mail an, auch nach einem bestätigten „Ja, ich wohne in Köln“.

Zusätzlich gegengeprüft: `/api/kontakt` mit Schritt `hilfe-ja` ohne
vorangegangene Fehlversuche gibt nur die E-Mail-Adresse heraus. Der Weg an der
Eskalation vorbei läuft ins Leere.

Der Chat wurde am laufenden Container durchgespielt (Anthropic,
`claude-sonnet-5`): Eine echte Problembeschreibung bekommt eine Rückfrage in
einfacher Sprache; zweckfremde Eingaben werden in 5 bis 7 Millisekunden lokal
beantwortet, ohne dass der Schlüssel benutzt wird.

## 3. Umgesetzt

**Gerüst und Aussehen (§8)**
Astro 5 mit Node-Adapter im Serverbetrieb. Startseite mit der vorgeschriebenen
Hauptüberschrift, Chat mittig, FAQ darunter. Schriftgrößenumschalter über
Cookie, serverseitig eingesetzt, damit die Seite beim Laden nicht springt.
Sprunglink zum Inhalt, Farbtokens aus der Palette.

**Darstellung: zwei Ansichten (24. August 2026)**
Die Startansicht zeigt nur noch Überschrift, Chat und FAQ — der
Einleitungsabsatz ist entfallen, der Kopf ist einzeilig, die Begrüßung im Chat
kurz. Rechnerisch steht der Senden-Knopf damit auf einem 640-px-Fenster bei
etwa 520 statt 1200 Pixeln. Der Schriftgrößen-Umschalter ist ein einzelner
„A“-Knopf, der ein `<details>`-Menü aufklappt.

Ab der ersten Nachricht steht `data-ansicht="gespraech"` am `<body>`: Der
Gesprächsverlauf wird zu Frage-Antwort-Paaren, ältere Paare klappen zu und
tragen die Zeile „Hier klicken für die Antwort“, die Eingabeleiste bleibt unten
stehen. Das Umschalten macht ausschließlich CSS; das Skript setzt nur das
Attribut. Ohne JavaScript bleibt die Startansicht stehen und die Seite
vollständig lesbar. Die Zurück-Taste führt zurück in die Startansicht.

**Zweckprüfung vor dem Schlüssel (24. August 2026)**
`src/lib/schutz/vorpruefung.ts` entscheidet lokal und ohne Netzaufruf, ob eine
Eingabe überhaupt an das Sprachmodell geht: Themenbezug bei der ersten
Nachricht, Erkennung von Tastaturmüll, fremden Schriftsystemen,
Anweisungsversuchen und zweckfremden Aufgaben. Im laufenden Gespräch entfällt
die Themenprüfung, damit „Ja“, „Nein“ oder eine abgelesene Zahl durchgehen. Ob
ein Gespräch läuft, entscheidet der signierte Zähler im Cookie, nicht der
mitgeschickte Verlauf. Dazu: Herkunftsprüfung der Anfrage, ein für Menschen
unsichtbares Formularfeld und eine Wiederholungserkennung über einen
täglich wechselnden HMAC — nie über den Text selbst.

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
Zeitpunkt, Route, Status, Dauer, im Fehlerfall die Fehlerklasse und ein fester
Vermerk, warum eine Anfrage ohne KI-Aufruf beantwortet wurde — an einer
einzigen erlaubten Ausgabestelle. Der Vermerk stammt ausschließlich aus dem
Code, nie aus der Eingabe.

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

1. **Impressum ist nicht ausgefüllt.** Name, Anschrift, E-Mail und
   gegebenenfalls Umsatzsteuer-Identifikationsnummer fehlen (§ 5 DDG).
2. **Datenschutzerklärung unvollständig.** Es fehlen die verantwortliche
   Stelle, der Name des tatsächlich eingesetzten KI-Anbieters — inzwischen
   steht fest: Anthropic — und der Stand des Auftragsverarbeitungsvertrags.

**Erledigt seit dem 22. August 2026:** Der KI-Schlüssel ist hinterlegt
(`KI_ANBIETER=anthropic`, `claude-sonnet-5`), die Chat-Route antwortet.
`SUPPORT_EMAIL` ist eine echte Adresse.

### Fehlende Funktionen

3. **Spracheingabe, Vorlesen und Foto-Upload fehlen vollständig.** Es gibt
   weder Routen noch Bedienelemente. Die Methoden `transkribieren()` und
   `vorlesen()` liegen ungenutzt in `src/lib/ki/openai.ts`, `MAX_UPLOAD_MB`
   wird von keiner Zeile gelesen (`SITE_URL` inzwischen schon — von der
   Herkunftsprüfung). Kamera und Mikrofon sind in der
   Permissions-Policy bereits freigegeben.

   **Dringend dabei:** Die FAQ „Kann ich statt tippen auch sprechen?" antwortet
   heute mit „Ja, das ist vorgesehen. Sie können Ihre Frage sprechen …". Das
   verspricht der Zielgruppe eine Leistung, die es nicht gibt. Entweder die
   Funktion bauen oder den FAQ-Text sofort ehrlich machen.

4. **11 der 12 Unterseiten aus §4 fehlen.** Vorhanden ist nur „So funktioniert
   die Hilfe". Es fehlen: Computer, Handy, Tablet, Internet und WLAN, Drucker,
   Apps, E-Mail, Online-Banking, Betrugsverdacht, Datenschutz und Sicherheit,
   Kontakt.
5. **`/llms.txt` fehlt** (antwortet mit 404). Der GEO-Skill führt sie als
   Pflichtdatei.
6. **Gesprächsabhängige FAQ (§3) fehlen.** Die Liste ist rein statisch.

### Absicherung und Prozess

7. **Testlücken gegenüber §13.8.** Abgedeckt sind Betrugswarnungen, die drei
   Fehlversuche und das Sitzungscookie. Es fehlen Tests für den Prompt-Ablauf,
   für Dateiuploads und für das Datenschutzverhalten (Protokoll,
   Anfragebegrenzung).
8. **Die getrennte SEO- und GEO-Prüfung über die Skills ist noch nicht
    gelaufen.** Ebenso fehlt eine dokumentierte Prüfung von Tastaturbedienung,
    200 % Zoom und schmalem Mobilgerät.
9. **Basic-Auth und `noindex` müssen zum Start entfernt werden.** Sonst bleibt
    die Website für Menschen und für Antwortsysteme unsichtbar.

## 5. Vorgeschlagene Reihenfolge

1. FAQ-Antwort zur Sprachfunktion ehrlich machen — das ist eine Textänderung
   und behebt sofort ein falsches Versprechen an die Zielgruppe.
2. Den Chat von Hand vollständig durchspielen: Rückfrage, Lösungsschritt, drei
   Fehlversuche, Eskalation. Der Schlüssel liegt jetzt vor, geprüft ist bisher
   nur der Anfang des Ablaufs.
3. Impressum und Datenschutz ausfüllen. Beides braucht Angaben, die nur der
   Betreiber liefern kann.
4. Die Unterseiten aus §4 anlegen — mit den Skills `seo-de` und `geo-llm`
   während des Schreibens, nicht erst danach.
5. `llms.txt` ergänzen, sobald die Seiten stehen. Sie darf nur nennen, was es
   dann wirklich gibt.
6. Sprache, Vorlesen und Foto-Upload bauen, jeweils mit Route und Test.
7. Fehlende Tests aus §13.8 nachziehen.
8. Getrennte SEO- und GEO-Prüfung, Barrierefreiheitsdurchgang auf einem echten
   Handy — besonders die klebende Eingabeleiste mit eingeblendeter Tastatur —,
   danach die Sperre entfernen.

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
