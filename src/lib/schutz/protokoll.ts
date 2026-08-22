/**
 * Protokollierung mit fester Obergrenze dessen, was hineindarf.
 *
 * GEO-LLM.txt §10 verbietet Chattexte, Fotos, Audiodaten und Zugangsdaten im
 * Protokoll. Diese Datei ist die einzige erlaubte Ausgabestelle — dadurch lässt
 * sich die Zusage überhaupt prüfen, statt sie an jeder console.log-Zeile im
 * Projekt einzeln nachzuhalten.
 */

export interface Eintrag {
    route: string
    status: number
    /** Dauer in Millisekunden. */
    dauer: number
    /** Nur die Fehlerklasse, niemals die Meldung — Meldungen enthalten Nutzereingaben. */
    fehlerart?: string
}

export function protokolliere(eintrag: Eintrag): void {
    const zeile = [
        new Date().toISOString(),
        eintrag.route,
        String(eintrag.status),
        `${Math.round(eintrag.dauer)}ms`,
        eintrag.fehlerart ?? '-',
    ].join(' ')

    if (eintrag.status >= 500) {
        console.error(zeile)
    } else {
        console.log(zeile)
    }
}

/**
 * Fehlerklasse eines unbekannten Wurfs. Bewusst ohne Meldung und ohne Stapel:
 * Beides kann Nutzereingaben enthalten, etwa wenn ein Anbieter die abgelehnte
 * Eingabe in der Fehlermeldung zitiert.
 */
export function fehlerart(fehler: unknown): string {
    if (fehler instanceof Error) return fehler.name
    return typeof fehler
}
