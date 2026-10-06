/**
 * Lokale Zweckprüfung vor dem KI-Aufruf.
 *
 * Jede Anfrage an das Sprachmodell kostet Geld und Zeit. Bots, Spielereien und
 * versehentliche Eingaben sollen den Schlüssel gar nicht erst erreichen. Die
 * Prüfung läuft vollständig hier im Server, ohne Netzaufruf und ohne
 * Zwischenspeicher: Sie liest den Text, entscheidet, und vergisst ihn.
 *
 * Die Prüfung ist bewusst nachsichtig. Ein zu Unrecht abgewiesener Mensch aus
 * der Zielgruppe versucht es meist kein zweites Mal — das wiegt schwerer als
 * ein durchgerutschter Bot, den danach noch die Anfragebegrenzung bremst.
 * Deshalb genügt EIN Treffer aus einer sehr breiten Wortliste, und im
 * laufenden Gespräch entfällt die Themenprüfung ganz.
 *
 * Vorrang der Sicherheit: Betrugsverdacht und Zugangsdaten werden vor dieser
 * Prüfung erkannt und übergehen sie (AGENTS.md, Regel 3). Wer einen Betrug
 * schildert, darf nie an einer Themenliste scheitern.
 */

export type Vorbefund =
    | 'zu-kurz'
    | 'kein-text'
    | 'fremde-schrift'
    | 'ohne-technikbezug'
    | 'anderer-zweck'
    | 'anweisungsversuch'

export interface Vorpruefung {
    grund: Vorbefund
    /** Freundliche Antwort in Alltagssprache. Kein Fehlercode, kein Vorwurf. */
    antwort: string
}

/*
 * Geräte, Programme und Dinge, um die es hier geht. Absichtlich in der Sprache
 * der Zielgruppe und mit Schreibweisen, wie sie tatsächlich getippt werden.
 * Die Liste ist ein Stammwort-Vergleich: "drucker", "druckt", "ausdrucken"
 * treffen alle über "druck".
 */
const TECHNIKWOERTER = [
    'computer', 'rechner', 'laptop', 'notebook', 'pc', 'mac', 'bildschirm', 'monitor',
    'maus', 'tastatur', 'taste', 'kabel', 'stecker', 'strom', 'akku', 'batterie', 'lad',
    'druck', 'scan', 'patrone', 'tinte', 'toner', 'papier', 'kopier',
    'handy', 'telefon', 'smartphone', 'iphone', 'samsung', 'android', 'sim', 'mobilfunk',
    'tablet', 'ipad', 'fernseher', 'fernsehe', 'tv', 'radio',
    'internet', 'wlan', 'wifi', 'router', 'fritzbox', 'netzwerk', 'verbindung', 'empfang',
    'browser', 'chrome', 'firefox', 'edge', 'safari', 'google', 'seite', 'webseite', 'link',
    'mail', 'postfach', 'outlook', 'gmail', 'gmx', 'web.de', 'anhang', 'posteingang',
    'app', 'programm', 'software', 'update', 'windows', 'apple', 'symbol', 'fenster',
    'passwort', 'kennwort', 'anmeld', 'abmeld', 'login', 'konto', 'benutzername', 'zugang',
    'virus', 'schadprogramm', 'werbung', 'pop-up', 'popup', 'meldung', 'fehlermeldung',
    'whatsapp', 'facebook', 'instagram', 'sms', 'nachricht', 'anruf', 'kontakt',
    'foto', 'bild', 'video', 'kamera', 'mikrofon', 'ton', 'lautsprecher', 'kopfhörer',
    'lautstärke', 'bluetooth', 'kopplung', 'drucker',
    'datei', 'ordner', 'speicher', 'festplatte', 'usb', 'stick', 'karte', 'cloud', 'sicherung',
    'banking', 'überweisung', 'bank', 'tan', 'geldautomat', 'bezahl', 'rechnung',
    'termin', 'kalender', 'zoom', 'teams', 'skype', 'streaming', 'netflix', 'alexa',
    'gerät', 'einstellung', 'knopf', 'schaltfläche', 'klick', 'tipp', 'wisch', 'zoom',
    'betrug', 'abzock', 'phishing', 'gesperrt', 'gehackt',
]

/*
 * Wie ein Problem geschildert wird — auch ohne dass ein Gerät genannt wird.
 * "Es geht nicht mehr an" ist eine vollständige Problembeschreibung.
 */
const PROBLEMWOERTER = [
    'geht nicht', 'funktioniert nicht', 'klappt nicht', 'kann nicht', 'weiß nicht',
    'kaputt', 'defekt', 'hängt', 'hängt sich', 'reagiert nicht', 'friert', 'abgestürzt',
    'stürzt ab', 'startet nicht', 'lässt sich nicht', 'komme nicht', 'finde nicht',
    'verschwunden', 'weg', 'langsam', 'fehler', 'problem', 'hilfe', 'schwierig',
    'kein bild', 'kein ton', 'schwarz', 'blockiert', 'zu klein', 'zu groß',
]

/*
 * Aufgaben, für die diese Website nicht da ist. Sie werden zuerst geprüft,
 * weil solche Anfragen oft ein Technikwort enthalten ("schreib mir ein
 * Programm"). Für Menschen aus der Zielgruppe sind es keine typischen Sätze.
 */
const ANDERER_ZWECK = [
    /schreib(e|en)?\s+(mir\s+)?(ein|eine|einen)\s+(gedicht|lied|song|text|aufsatz|essay|brief|roman|geschichte|witz|rede)/i,
    /gedicht|songtext|liedtext|hausaufgabe|drehbuch|horoskop|lottozahlen/i,
    /rezept\s+(für|zum)/i,
    /(schreib|erstell|programmier|generier)(e|en)?\s+(mir\s+)?(bitte\s+)?(ein|eine|einen)?\s*(code|skript|script|programm|website|app)\b/i,
    /\b(python|javascript|typescript|java|php|sql|html|css)\b/i,
    /übersetze?\s+(mir\s+)?(das|dies|diesen|den|folgenden|bitte)/i,
    /\b(aktienkurs|bitcoin|wettervorhersage|fußballergebnis)\b/i,
]

/*
 * Versuche, die Rolle der Hilfe zu verstellen. Der Systemprompt hält dagegen,
 * aber ein Aufruf, der gar nicht erst hinausgeht, ist billiger und sicherer.
 */
const ANWEISUNGSVERSUCH = [
    /ignorier(e|en)?\s+(alle\s+|deine\s+)?(bisherigen|vorherigen|obigen|vorher)/i,
    /ignore\s+(all\s+)?(previous|above|prior)/i,
    /vergiss\s+(alle\s+|deine\s+)?(regeln|anweisungen|bisherige)/i,
    /system\s*-?\s*prompt|systemnachricht|systemanweisung/i,
    /deine\s+(anweisungen|regeln|vorgaben)\s+(lauten|sind|aus)/i,
    /(zeig|nenn|gib|verrat)(e|en)?\s+(mir\s+)?(deine|die)\s+(anweisungen|regeln|vorgaben)/i,
    /du\s+bist\s+(jetzt|ab\s+sofort|kein)/i,
    /verhalte\s+dich\s+wie|tu\s+so,?\s+als\s+(ob|wärst)/i,
    /\bact\s+as\b|\bpretend\s+to\b|\bjailbreak\b|developer\s+mode|\bdan\s+mode\b/i,
]

/** Schriftzeichen, die auf eine andere Sprache deuten. */
const FREMDE_SCHRIFT =
    /[Ѐ-ӿ֐-׿؀-ۿऀ-ॿ぀-ヿ一-鿿가-힯]/g

const ANTWORTEN: Record<Vorbefund, string> = {
    'zu-kurz':
        'Da war leider noch nichts zu lesen. Bitte schreiben Sie in einem Satz, womit Sie Schwierigkeiten haben.',
    'kein-text':
        'Daraus konnte ich keinen Satz erkennen. Bitte schreiben Sie mit Ihren eigenen Worten, was nicht klappt — zum Beispiel: „Mein Drucker druckt nicht mehr.“',
    'fremde-schrift':
        'Diese Hilfe gibt es nur auf Deutsch. Bitte schreiben Sie Ihre Frage auf Deutsch, dann helfe ich Ihnen gerne weiter.',
    'ohne-technikbezug':
        'Ich helfe bei Computer, Handy, Tablet, Internet und Drucker. Bitte schreiben Sie, welches Gerät Ihnen Schwierigkeiten macht und was dabei passiert.',
    'anderer-zweck':
        'Dafür ist diese Hilfe leider nicht da. Ich helfe bei Computer, Handy, Tablet, Internet und Drucker. Bitte beschreiben Sie, womit Sie technisch nicht weiterkommen.',
    'anweisungsversuch':
        'Ich beantworte hier nur Fragen zu Computer, Handy, Tablet, Internet und Drucker. Bitte beschreiben Sie, was an Ihrem Gerät nicht klappt.',
}

/**
 * Prüft eine Eingabe, bevor der API-Schlüssel benutzt wird.
 *
 * @param eingabe Der getippte Text.
 * @param imGespraech Ob in dieser Sitzung schon eine Nachricht beantwortet
 *   wurde. Die Angabe stammt aus dem signierten Cookie, nicht aus dem Browser —
 *   sonst könnte ein Bot einfach behaupten, mitten im Gespräch zu sein.
 * @returns null, wenn die Anfrage hinausgehen darf.
 */
export function pruefeZweck(eingabe: string, imGespraech: boolean): Vorpruefung | null {
    const text = eingabe.trim()

    if (text.length === 0) return befund('zu-kurz')

    /*
     * Ein einzelnes Zeichen ist nur außerhalb eines Gesprächs sinnlos. Läuft
     * eines, ist "5" eine vollständige Antwort — etwa auf die Frage, welche
     * Zahl auf dem Bildschirm steht. Dasselbe gilt für Antworten ganz ohne
     * Buchstaben.
     */
    const buchstaben = text.match(/\p{L}/gu)?.length ?? 0
    if (!imGespraech && (text.length < 2 || buchstaben < 2)) {
        return befund(text.length < 2 ? 'zu-kurz' : 'kein-text')
    }

    if (text.length > 12 && buchstaben / text.length < 0.4) return befund('kein-text')
    if (/(.)\1{9,}/.test(text)) return befund('kein-text')

    // Ein einzelnes fremdes Zeichen kann ein Emoji-Nachbar oder ein Zitat sein.
    // Erst mehrere sprechen für eine andere Sprache.
    if ((text.match(FREMDE_SCHRIFT)?.length ?? 0) >= 3) return befund('fremde-schrift')

    if (ANWEISUNGSVERSUCH.some((muster) => muster.test(text))) return befund('anweisungsversuch')
    if (ANDERER_ZWECK.some((muster) => muster.test(text))) return befund('anderer-zweck')

    /*
     * Im laufenden Gespräch endet die Themenprüfung. "Ja", "Nein", "Das hat
     * nicht geholfen" oder eine vorgelesene Zahl vom Bildschirm sind dann
     * vollständige, sinnvolle Antworten — der Zusammenhang steht im Verlauf.
     */
    if (imGespraech) return null

    const klein = text.toLowerCase()
    const passt =
        TECHNIKWOERTER.some((wort) => klein.includes(wort)) ||
        PROBLEMWOERTER.some((wort) => klein.includes(wort))

    return passt ? null : befund('ohne-technikbezug')
}

function befund(grund: Vorbefund): Vorpruefung {
    return { grund, antwort: ANTWORTEN[grund] }
}
