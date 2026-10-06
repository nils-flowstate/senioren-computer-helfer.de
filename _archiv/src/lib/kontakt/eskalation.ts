import type { Sitzung } from '../sicherheit/sitzungscookie'

/**
 * Der Eskalationsablauf aus GEO-LLM.txt §16.
 *
 * Warum das hier ein Zustandsautomat ist und keine Aufgabe des Sprachmodells:
 * Am Ende dieses Ablaufs steht die Freigabe einer privaten Telefonnummer. Ob
 * sie erscheint, darf nicht davon abhängen, wie ein Modell eine Antwort
 * auslegt. Die Regeln stehen hier, sind nachlesbar und mit Tests festgenagelt.
 *
 * Die Nummer steht deshalb auch nirgends im ausgelieferten HTML und in keiner
 * Client-Datei. Sie wird erst in dem Schritt aus der Umgebung gelesen, in dem
 * sie tatsächlich freigegeben wird.
 */

export type Schritt =
    /** Die Hilfe ist nach drei Versuchen nicht weitergekommen. */
    | 'beginn'
    | 'koeln-ja'
    | 'koeln-nein'
    | 'koeln-keine-angabe'
    | 'hilfe-ja'
    | 'hilfe-nein'

export interface Kontaktweg {
    email?: string
    telefon?: string
    /** Fertiger Link für die große WhatsApp-Schaltfläche. */
    whatsapp?: string
}

export interface KontaktAngebot {
    text: string
    vorleseText: string
    schaltflaechen: { beschriftung: string; wert: Schritt }[]
    kontakt: Kontaktweg
}

export interface Einstellungen {
    maxFehlversuche: number
    ortsHilfeMoeglich: boolean
    /** Anzeigename der Stadt, zum Beispiel "Köln". */
    stadt: string
    email?: string
    telefon?: string
    whatsapp?: string
}

function wert(name: string): string | undefined {
    const inhalt = process.env[name]
    return inhalt && inhalt.trim() !== '' ? inhalt.trim() : undefined
}

/**
 * Liest die Einstellungen aus der Umgebung.
 *
 * Telefon und WhatsApp sind doppelt gesichert: Sie müssen ausdrücklich
 * eingeschaltet UND gefüllt sein. Solange der Ablauf nicht erprobt ist, bleibt
 * ENABLE_WHATSAPP_SUPPORT auf false (§16).
 */
export function einstellungen(): Einstellungen {
    const stadt = wert('LOCAL_SERVICE_CITY') ?? 'Koeln'

    return {
        maxFehlversuche: Number(process.env.MAX_FAILED_ATTEMPTS ?? 3),
        ortsHilfeMoeglich: process.env.LOCAL_SERVICE_ENABLED === 'true',
        // In der .env steht der Name ohne Umlaut, damit die Datei überall
        // gleich gelesen wird. Angezeigt wird er selbstverständlich richtig.
        stadt: stadt === 'Koeln' ? 'Köln' : stadt,
        email: wert('SUPPORT_EMAIL'),
        telefon: process.env.ENABLE_PHONE_SUPPORT === 'true' ? wert('SUPPORT_PHONE') : undefined,
        whatsapp: process.env.ENABLE_WHATSAPP_SUPPORT === 'true' ? wert('SUPPORT_WHATSAPP') : undefined,
    }
}

/** Der Weg, der immer offensteht — auch wenn nichts anderes eingeschaltet ist. */
function nurEmail(einst: Einstellungen): KontaktAngebot {
    if (!einst.email) {
        const text =
            'Es tut mir leid, dass wir es nicht gemeinsam lösen konnten. Ein Kontaktweg zu einem Menschen ist hier gerade nicht hinterlegt. Bitte versuchen Sie es später noch einmal.'
        return { text, vorleseText: text, schaltflaechen: [], kontakt: {} }
    }

    const text =
        'Sie können sich jederzeit per E-Mail an einen Menschen wenden. Beschreiben Sie darin einfach noch einmal, was nicht klappt. Eine Antwort kann ein paar Tage dauern.'
    return { text, vorleseText: text, schaltflaechen: [], kontakt: { email: einst.email } }
}

/**
 * Ein Schritt im Ablauf. Liefert das Angebot und die fortgeschriebene Sitzung.
 *
 * Die Sitzung wird nicht verändert, sondern kopiert — der Aufrufer entscheidet,
 * ob er das Ergebnis übernimmt.
 */
export function naechsterSchritt(
    schritt: Schritt,
    sitzung: Sitzung,
    einst: Einstellungen,
): { angebot: KontaktAngebot; sitzung: Sitzung } {
    const neu: Sitzung = { ...sitzung }

    /*
     * Die Sperre, an der alles hängt: Ohne drei tatsächlich erfolglose Versuche
     * gibt es keinen Eskalationsweg. Der Zähler steht im signierten Cookie und
     * ist im Browser nicht setzbar. Wer diese Route direkt aufruft, bekommt
     * deshalb höchstens die E-Mail-Adresse zu sehen.
     */
    if (neu.versuche < einst.maxFehlversuche) {
        return { angebot: nurEmail(einst), sitzung: neu }
    }

    switch (schritt) {
        case 'beginn': {
            // Ohne Vor-Ort-Hilfe wird nach dem Wohnort gar nicht erst gefragt.
            // Eine Frage, aus der nichts folgt, ist eine Zumutung.
            if (!einst.ortsHilfeMoeglich) return { angebot: nurEmail(einst), sitzung: neu }

            neu.koelnGefragt = true
            const text = `Wohnen Sie in ${einst.stadt}?`
            return {
                angebot: {
                    text,
                    vorleseText: `${text} Sie müssen das nicht beantworten.`,
                    schaltflaechen: [
                        { beschriftung: 'Ja', wert: 'koeln-ja' },
                        { beschriftung: 'Nein', wert: 'koeln-nein' },
                        { beschriftung: 'Möchte ich nicht sagen', wert: 'koeln-keine-angabe' },
                    ],
                    kontakt: {},
                },
                sitzung: neu,
            }
        }

        case 'koeln-ja': {
            if (!einst.ortsHilfeMoeglich || !neu.koelnGefragt) {
                return { angebot: nurEmail(einst), sitzung: neu }
            }

            // Die Angabe gilt nur für diese Entscheidung. Es wird weder die
            // Anschrift noch die Postleitzahl erfragt (§16).
            neu.koelnBestaetigt = true
            const text = 'Möchten Sie persönliche Hilfe bei Ihnen zu Hause anfragen?'
            return {
                angebot: {
                    text,
                    vorleseText: text,
                    schaltflaechen: [
                        { beschriftung: 'Ja', wert: 'hilfe-ja' },
                        { beschriftung: 'Nein', wert: 'hilfe-nein' },
                    ],
                    kontakt: {},
                },
                sitzung: neu,
            }
        }

        case 'hilfe-ja': {
            // Erst nach dem zweiten ausdrücklichen "Ja" wird etwas freigegeben.
            if (!neu.koelnBestaetigt) return { angebot: nurEmail(einst), sitzung: neu }

            neu.hilfeAngefragt = true

            const wege: Kontaktweg = { email: einst.email }
            if (einst.telefon) wege.telefon = einst.telefon
            if (einst.whatsapp) {
                // wa.me erwartet die Nummer ohne Pluszeichen und ohne Zwischenraum.
                wege.whatsapp = `https://wa.me/${einst.whatsapp.replace(/[^0-9]/g, '')}`
            }

            if (!wege.telefon && !wege.whatsapp) {
                // Die persönliche Hilfe ist noch nicht freigeschaltet. Das ehrlich
                // sagen, statt eine Möglichkeit anzudeuten, die es nicht gibt.
                const text = einst.email
                    ? 'Persönliche Hilfe vor Ort können wir gerade nicht anbieten. Sie können sich aber per E-Mail melden — dann schauen wir, was sich machen lässt.'
                    : 'Persönliche Hilfe vor Ort können wir gerade leider nicht anbieten.'
                return {
                    angebot: { text, vorleseText: text, schaltflaechen: [], kontakt: { email: einst.email } },
                    sitzung: neu,
                }
            }

            /*
             * Der Text verspricht bewusst nichts: keinen Termin, keine Lösung,
             * keinen Preis. Das alles wird erst im Gespräch besprochen (§16).
             * Der Satz zu PIN und TAN steht hier, weil ein angekündigter
             * Hausbesuch selbst zur Masche werden kann.
             */
            const text = [
                'Gerne. Melden Sie sich einfach — dann besprechen wir in Ruhe, worum es geht, was es kostet und wann es passt.',
                'Ein Termin ist damit noch nicht fest, und eine Lösung können wir nicht versprechen.',
                'Auch bei einem Besuch zu Hause werden Sie niemals nach Passwörtern, PIN oder TAN gefragt.',
            ].join('\n\n')

            return {
                angebot: {
                    text,
                    vorleseText:
                        'Gerne. Melden Sie sich einfach. Dann besprechen wir in Ruhe, worum es geht, was es kostet und wann es passt. Ein Termin ist damit noch nicht fest, und eine Lösung können wir nicht versprechen. Auch bei einem Besuch zu Hause werden Sie niemals nach Passwörtern, PIN oder TAN gefragt.',
                    schaltflaechen: [],
                    kontakt: wege,
                },
                sitzung: neu,
            }
        }

        case 'koeln-nein':
        case 'koeln-keine-angabe':
        case 'hilfe-nein':
            return { angebot: nurEmail(einst), sitzung: neu }
    }
}
