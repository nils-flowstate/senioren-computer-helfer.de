import { createHmac, randomBytes } from 'node:crypto'

/**
 * Anfragebegrenzung und Kostendeckel ohne Anmeldung.
 *
 * Die Zählung braucht ein Merkmal je Besucher. Die IP-Adresse ist ein
 * personenbezogenes Datum, deshalb wird sie nie gespeichert, sondern nur als
 * HMAC mit einem Salz verwendet, das täglich wechselt und den Prozess nie
 * verlässt. Nach einem Tageswechsel ist ein Rückschluss auf die IP damit auch
 * intern nicht mehr möglich.
 *
 * Der Speicher ist bewusst nur im Arbeitsspeicher: Nach einem Neustart ist alles
 * weg — genau das ist bei Zählern über personenbezogene Merkmale erwünscht.
 */

interface Eimer {
    anzahl: number
    fensterBeginn: number
}

const eimer = new Map<string, Eimer>()
const tagesZaehler = { tag: '', anzahl: 0 }

let salz = randomBytes(32)
let salzTag = heute()

function heute(): string {
    return new Date().toISOString().slice(0, 10)
}

function kennung(ip: string): string {
    if (salzTag !== heute()) {
        salz = randomBytes(32)
        salzTag = heute()
        eimer.clear()
    }
    return createHmac('sha256', salz).update(ip).digest('base64url').slice(0, 22)
}

export interface Grenzen {
    proMinute: number
    proSitzung: number
    proTag: number
}

export function grenzen(): Grenzen {
    return {
        proMinute: Number(process.env.RATE_LIMIT_PRO_MINUTE ?? 12),
        proSitzung: Number(process.env.MAX_NACHRICHTEN_PRO_SITZUNG ?? 60),
        proTag: Number(process.env.TAGESBUDGET_ANFRAGEN ?? 2000),
    }
}

export type Ablehnung = 'zu-schnell' | 'sitzung-voll' | 'tagesbudget'

/**
 * Prüft alle drei Grenzen. Liefert null, wenn die Anfrage durchgehen darf.
 * Der Aufruf zählt die Anfrage mit — er ist nicht nebenwirkungsfrei.
 */
export function pruefeGrenzen(ip: string, nachrichtenInSitzung: number): Ablehnung | null {
    const g = grenzen()

    if (nachrichtenInSitzung >= g.proSitzung) return 'sitzung-voll'

    const tag = heute()
    if (tagesZaehler.tag !== tag) {
        tagesZaehler.tag = tag
        tagesZaehler.anzahl = 0
    }
    if (tagesZaehler.anzahl >= g.proTag) return 'tagesbudget'

    const schluessel = kennung(ip)
    const jetzt = Date.now()
    const vorhanden = eimer.get(schluessel)

    if (!vorhanden || jetzt - vorhanden.fensterBeginn > 60_000) {
        eimer.set(schluessel, { anzahl: 1, fensterBeginn: jetzt })
    } else {
        if (vorhanden.anzahl >= g.proMinute) return 'zu-schnell'
        vorhanden.anzahl++
    }

    tagesZaehler.anzahl++
    return null
}

/** Meldungen in Alltagssprache — der Grund bleibt für die Person nachvollziehbar. */
export const ABLEHNUNGSTEXT: Record<Ablehnung, string> = {
    'zu-schnell': 'Einen Moment bitte. Sie haben gerade sehr schnell hintereinander geschrieben. Versuchen Sie es in einer Minute noch einmal.',
    'sitzung-voll': 'Wir haben heute schon sehr lange miteinander geschrieben. Bitte beginnen Sie ein neues Gespräch, dann geht es weiter.',
    'tagesbudget': 'Der Hilfe-Chat ist gerade sehr stark belastet. Bitte versuchen Sie es später noch einmal.',
}

/** Nur für Tests. */
export function zaehlerZuruecksetzen(): void {
    eimer.clear()
    tagesZaehler.tag = ''
    tagesZaehler.anzahl = 0
}
