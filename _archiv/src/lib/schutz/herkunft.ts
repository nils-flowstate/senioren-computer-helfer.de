/**
 * Herkunftsprüfung für die API-Routen.
 *
 * Ein Skript auf einer fremden Website kann unsere Route aufrufen, auch wenn es
 * die Antwort wegen CORS nie zu sehen bekommt. Der Aufruf kostet dann trotzdem
 * einen Schlüsselzugriff. Der Browser sagt selbst, woher die Anfrage kommt —
 * das ist die billigste verlässliche Auskunft, die es dazu gibt.
 *
 * Fehlen beide Angaben, gilt die Anfrage als zulässig: Ältere Browser senden
 * "Sec-Fetch-Site" nicht, und genau die stehen bei dieser Zielgruppe auf dem
 * Tisch. Lieber ein durchgelassenes Werkzeug als ein ausgesperrter Mensch —
 * die Anfragebegrenzung fängt den Rest.
 */
export function fremdeHerkunft(request: Request, url: URL): boolean {
    const ziel = request.headers.get('sec-fetch-site')
    if (ziel && ziel !== 'same-origin' && ziel !== 'none') return true

    const herkunft = request.headers.get('origin')
    if (!herkunft) return false

    try {
        /*
         * Verglichen wird nur der Rechnername, nicht das Protokoll: Hinter dem
         * Reverse Proxy kommt die Anfrage intern über http an, während der
         * Browser https gesehen hat. Ein Vergleich der vollen Adresse würde
         * dann im Betrieb jede echte Anfrage abweisen.
         */
        const erlaubt = new Set([url.host])
        const eigene = process.env.SITE_URL
        if (eigene) erlaubt.add(new URL(eigene).host)

        return !erlaubt.has(new URL(herkunft).host)
    } catch {
        return true
    }
}
