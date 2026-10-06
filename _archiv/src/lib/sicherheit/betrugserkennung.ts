/**
 * Vorgeschaltete Betrugsprüfung nach GEO-LLM.txt §6.
 *
 * Warum überhaupt eine Regelprüfung, wenn doch eine KI antwortet: Weil ein
 * Sicherheitshinweis nicht davon abhängen darf, ob ein Sprachmodell die Lage
 * richtig einschätzt. Die Regeln hier greifen immer, sind nachlesbar und
 * testbar. Die KI bekommt den Befund zusätzlich als Kontext.
 *
 * Der Preis dafür sind gelegentliche Fehlalarme. Das ist beabsichtigt: Ein
 * überflüssiger Hinweis kostet ein paar Sekunden, ein übersehener Betrug das
 * Ersparte.
 */

export type BetrugsArt =
    | 'bankdaten'
    | 'fernwartung'
    | 'schockanruf'
    | 'paket'
    | 'gewinn'
    | 'geldanlage'
    | 'kontosperre'

export interface BetrugsBefund {
    art: BetrugsArt
    /** Kurzer, ruhiger Hinweis in Alltagssprache. */
    hinweis: string
    /** Der eine wichtigste nächste Schritt. */
    naechsterSchritt: string
}

interface Regel {
    art: BetrugsArt
    muster: RegExp[]
    hinweis: string
    naechsterSchritt: string
}

/*
 * Die Muster sind bewusst auf die Formulierungen der Zielgruppe gemünzt — so,
 * wie jemand eine Betrugsnachricht nacherzählt, nicht wie Fachliteratur sie
 * beschreibt.
 */
const REGELN: Regel[] = [
    {
        art: 'bankdaten',
        muster: [
            /\b(tan|itan|mtan|smstan|photo-?tan|push-?tan)\b/i,
            /\bpin\b.{0,40}\b(eingeben|nennen|senden|schicken|bestätigen)\b/i,
            /\b(bank|sparkasse|volksbank|postbank|commerzbank|ing|dkb)\b.{0,60}\b(angerufen|geschrieben|gemailt|sms|nachricht)\b/i,
            // "Konto ... bestätigen" allein ist noch kein Griff nach Zugangsdaten.
            // So klingt vor allem die gefälschte Nachricht über eine angebliche
            // Kontosperre — die gehört zur Regel "kontosperre", deren Rat dort der
            // richtige ist: Link nicht antippen, sondern wie gewohnt anmelden.
            /\b(zugangsdaten|online-?banking|kontodaten|kontonummer)\b.{0,40}\b(bestätigen|verifizieren|freigeben|aktualisieren|eingeben|angeben)\b/i,
            /\bkonto\b.{0,40}\b(freigeben|verifizieren)\b/i,
            /\büberweisung\b.{0,40}\b(freigeben|bestätigen|autorisieren)\b/i,
        ],
        hinweis: 'Ihre Bank fragt Sie niemals nach PIN oder TAN — weder am Telefon noch per Nachricht oder E-Mail. Genau das ist die häufigste Betrugsmasche.',
        naechsterSchritt: 'Geben Sie nichts ein und beenden Sie das Gespräch beziehungsweise löschen Sie die Nachricht. Wenn Sie schon etwas eingegeben haben, rufen Sie sofort den Sperr-Notruf 116 116 an.',
    },
    {
        art: 'fernwartung',
        muster: [
            /\b(anydesk|teamviewer|ultraviewer|quicksupport|fernwartung|fernzugriff)\b/i,
            /\b(microsoft|windows|apple|google)\b.{0,50}\b(angerufen|anruf|hat sich gemeldet|mitarbeiter|support)\b/i,
            /\b(bildschirm|computer)\b.{0,30}\b(freigeben|übernehmen|fernsteuern)\b/i,
            /\b(virus|befall|infiziert|gehackt)\b.{0,60}\b(meldung|fenster|nummer anrufen|hotline)\b/i,
        ],
        hinweis: 'Microsoft, Apple und Google rufen niemals von sich aus an. Wer Sie bittet, ein Programm zu installieren oder Ihren Bildschirm freizugeben, will an Ihr Geld.',
        naechsterSchritt: 'Legen Sie auf und installieren Sie nichts. Falls schon ein Programm läuft: Gerät ausschalten und die Verbindung trennen.',
    },
    {
        art: 'schockanruf',
        muster: [
            /\b(enkel|enkelin|sohn|tochter|neffe|nichte)\b.{0,60}\b(geld|notlage|unfall|verhaftet|kaution|überweisen)\b/i,
            /\b(neue nummer|handy verloren|hallo mama|hallo papa)\b/i,
            /\b(polizei|staatsanwalt|kripo)\b.{0,60}\b(geld|kaution|wertsachen|abholen|übergeben)\b/i,
        ],
        hinweis: 'Das klingt nach dem sogenannten Schockanruf. Dabei geben sich Fremde als Angehörige oder als Polizei aus und drängen zur Eile.',
        naechsterSchritt: 'Legen Sie auf. Rufen Sie Ihre Angehörigen unter der Nummer an, die Sie schon kennen — nicht unter der Nummer aus der Nachricht. Die echte Polizei erreichen Sie unter 110.',
    },
    {
        art: 'paket',
        muster: [
            /\b(dhl|hermes|ups|dpd|zoll|paket|sendung)\b.{0,60}\b(gebühr|zahlen|nachzahlen|verzollen|link|klicken)\b/i,
            /\bsendungsverfolgung\b.{0,40}\b(link|aktualisieren|bestätigen)\b/i,
        ],
        hinweis: 'Nachrichten über angeblich feststeckende Pakete mit einem Link sind fast immer gefälscht. Der Link führt auf eine nachgemachte Seite.',
        naechsterSchritt: 'Tippen Sie den Link nicht an. Löschen Sie die Nachricht. Wenn Sie wirklich ein Paket erwarten, schauen Sie direkt auf der Seite des Versanddienstes nach.',
    },
    {
        art: 'gewinn',
        muster: [
            /\b(gewonnen|gewinn|lotterie|verlosung|preis)\b.{0,60}\b(gebühr|bearbeitungsgebühr|daten|angeben|zahlen)\b/i,
            /\b(erbschaft|erbe)\b.{0,60}\b(anwalt|gebühr|überweisen|ausland)\b/i,
        ],
        hinweis: 'Bei einem echten Gewinn müssen Sie niemals vorher etwas bezahlen und keine Kontodaten angeben.',
        naechsterSchritt: 'Antworten Sie nicht und überweisen Sie nichts. Löschen Sie die Nachricht.',
    },
    {
        art: 'geldanlage',
        muster: [
            /\b(bitcoin|krypto|kryptowährung|trading|broker|rendite)\b.{0,60}\b(investieren|einzahlen|verdoppeln|sicher|gewinn)\b/i,
            /\b(geldanlage|investment)\b.{0,50}\b(garantiert|risikolos|schnell)\b/i,
        ],
        hinweis: 'Versprechen von sicheren oder besonders hohen Gewinnen bei einer Geldanlage sind ein deutliches Warnzeichen.',
        naechsterSchritt: 'Zahlen Sie nichts ein. Sprechen Sie vorher mit Ihrer Hausbank oder mit der Verbraucherzentrale.',
    },
    {
        art: 'kontosperre',
        muster: [
            /\b(konto|zugang|account)\b.{0,40}\b(gesperrt|deaktiviert|läuft ab|wird geschlossen)\b/i,
            /\b(identität|daten)\b.{0,30}\b(bestätigen|verifizieren)\b.{0,40}\b(link|klicken|frist|24 stunden)\b/i,
        ],
        hinweis: 'Nachrichten, die Druck machen und eine Frist setzen, kommen fast immer von Betrügern. Echte Anbieter drängen nicht.',
        naechsterSchritt: 'Tippen Sie den Link nicht an. Melden Sie sich stattdessen so an, wie Sie es sonst immer tun, und schauen Sie dort nach.',
    },
]

/**
 * Prüft eine Eingabe auf Betrugsmuster. Liefert den ersten Treffer — die Regeln
 * stehen nach Dringlichkeit sortiert, Bankdaten zuerst.
 */
export function pruefeBetrug(text: string): BetrugsBefund | null {
    if (!text) return null

    for (const regel of REGELN) {
        if (regel.muster.some((muster) => muster.test(text))) {
            return {
                art: regel.art,
                hinweis: regel.hinweis,
                naechsterSchritt: regel.naechsterSchritt,
            }
        }
    }

    return null
}

/*
 * Sieht die Eingabe so aus, als hätte jemand versehentlich ein Passwort, eine PIN
 * oder eine TAN hineingeschrieben? Dann wird die Eingabe nicht blockiert — das
 * wäre bevormundend und nach dem Absenden ohnehin zu spät. Stattdessen bekommt
 * die Person einen freundlichen Hinweis.
 */
const ZUGANGSDATEN_MUSTER: RegExp[] = [
    /\bmein (passwort|kennwort|pin|tan)\b.{0,20}\b(ist|lautet)\b/i,
    /\b(passwort|kennwort|pin|tan)\s*[:=]\s*\S+/i,
    /\b\d{6}\b.{0,20}\b(tan|code)\b/i,
]

export function enthaeltZugangsdaten(text: string): boolean {
    return ZUGANGSDATEN_MUSTER.some((muster) => muster.test(text))
}

export const ZUGANGSDATEN_HINWEIS =
    'Bitte schreiben Sie mir keine Passwörter, PINs oder TANs. Ich brauche sie nicht, und niemand sonst sollte danach fragen. Wir kommen auch ohne weiter.'
