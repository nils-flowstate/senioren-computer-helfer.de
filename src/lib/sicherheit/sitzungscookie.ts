import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * Signierter Sitzungszustand.
 *
 * Hier steht ausdrücklich KEIN Gesprächsinhalt — nur Zähler und Ja/Nein-Marken.
 * Der Verlauf selbst bleibt im Browser (GEO-LLM.txt §10).
 *
 * Der Zweck der Signatur: Die Freigabe der Telefonnummer hängt nach §16 am
 * tatsächlichen Ablauf. Läge der Zähler im Browser, könnte man ihn einfach
 * setzen. So wird er serverseitig geführt und ist nicht fälschbar.
 */

export const COOKIE_NAME = 'sch_sitzung'

export interface Sitzung {
    /** Erfolglose Lösungsversuche. */
    versuche: number
    /** Die Eskalationsfrage nach Köln wurde gestellt. */
    koelnGefragt: boolean
    /** Die Person hat "Ja, ich wohne in Köln" bestätigt. */
    koelnBestaetigt: boolean
    /** Die Person hat persönliche Hilfe ausdrücklich angefragt. */
    hilfeAngefragt: boolean
    /** Nachrichten in dieser Sitzung — für die Kostengrenze. */
    nachrichten: number
    /** Ausstellungszeitpunkt in Sekunden seit 1970. */
    ausgestellt: number
}

export const LEERE_SITZUNG: Sitzung = {
    versuche: 0,
    koelnGefragt: false,
    koelnBestaetigt: false,
    hilfeAngefragt: false,
    nachrichten: 0,
    ausgestellt: 0,
}

/** Vier Stunden. Lang genug für ein geduldiges Gespräch, kurz genug zum Vergessen. */
const GUELTIGKEIT_SEKUNDEN = 4 * 60 * 60

let zwischengespeichertesGeheimnis: string | null = null

function geheimnis(): string {
    if (zwischengespeichertesGeheimnis) return zwischengespeichertesGeheimnis

    const gesetzt = process.env.SESSION_SECRET
    if (gesetzt && gesetzt.length >= 32) {
        zwischengespeichertesGeheimnis = gesetzt
        return gesetzt
    }

    if (process.env.NODE_ENV === 'production') {
        throw new Error('SESSION_SECRET fehlt oder ist kürzer als 32 Zeichen.')
    }

    // In der Entwicklung ein Zufallswert je Start. Nach einem Neustart sind
    // laufende Sitzungen ungültig — das ist beim Entwickeln unerheblich.
    zwischengespeichertesGeheimnis = randomBytes(32).toString('hex')
    console.warn('SESSION_SECRET ist nicht gesetzt. Es wird ein Zufallswert für diesen Start verwendet.')
    return zwischengespeichertesGeheimnis
}

function signiere(nutzlast: string): string {
    return createHmac('sha256', geheimnis()).update(nutzlast).digest('base64url')
}

export function sitzungSchreiben(sitzung: Sitzung): string {
    const inhalt = { ...sitzung, ausgestellt: Math.floor(Date.now() / 1000) }
    const nutzlast = Buffer.from(JSON.stringify(inhalt)).toString('base64url')
    return `${nutzlast}.${signiere(nutzlast)}`
}

export function sitzungLesen(wert: string | undefined): Sitzung {
    if (!wert) return { ...LEERE_SITZUNG }

    const [nutzlast, unterschrift] = wert.split('.')
    if (!nutzlast || !unterschrift) return { ...LEERE_SITZUNG }

    const erwartet = signiere(nutzlast)
    // Zeitkonstanter Vergleich, damit die Unterschrift nicht Zeichen für Zeichen
    // erraten werden kann.
    if (
        unterschrift.length !== erwartet.length ||
        !timingSafeEqual(Buffer.from(unterschrift), Buffer.from(erwartet))
    ) {
        return { ...LEERE_SITZUNG }
    }

    try {
        const inhalt = JSON.parse(Buffer.from(nutzlast, 'base64url').toString('utf8')) as Sitzung
        const alter = Math.floor(Date.now() / 1000) - (inhalt.ausgestellt ?? 0)
        if (alter > GUELTIGKEIT_SEKUNDEN) return { ...LEERE_SITZUNG }

        return {
            versuche: Number(inhalt.versuche) || 0,
            koelnGefragt: Boolean(inhalt.koelnGefragt),
            koelnBestaetigt: Boolean(inhalt.koelnBestaetigt),
            hilfeAngefragt: Boolean(inhalt.hilfeAngefragt),
            nachrichten: Number(inhalt.nachrichten) || 0,
            ausgestellt: Number(inhalt.ausgestellt) || 0,
        }
    } catch {
        return { ...LEERE_SITZUNG }
    }
}

/** Cookie-Kopfzeile. HttpOnly, damit kein Skript im Browser herankommt. */
export function cookieKopfzeile(sitzung: Sitzung, sicher: boolean): string {
    const teile = [
        `${COOKIE_NAME}=${sitzungSchreiben(sitzung)}`,
        'Path=/',
        'HttpOnly',
        'SameSite=Lax',
        `Max-Age=${GUELTIGKEIT_SEKUNDEN}`,
    ]
    if (sicher) teile.push('Secure')
    return teile.join('; ')
}
