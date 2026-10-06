import type { APIRoute } from 'astro'
import { einstellungen, naechsterSchritt, type Schritt } from '../../lib/kontakt/eskalation'
import { COOKIE_NAME, cookieKopfzeile, sitzungLesen } from '../../lib/sicherheit/sitzungscookie'
import { protokolliere } from '../../lib/schutz/protokoll'

export const prerender = false

/**
 * Der Eskalationsweg nach GEO-LLM.txt §16.
 *
 * Diese Route ist die einzige Stelle, an der eine Telefonnummer oder ein
 * WhatsApp-Link entstehen kann — und zwar erst nach drei erfolglosen Versuchen
 * und zwei ausdrücklichen "Ja". Der Zähler dafür steht im signierten Cookie.
 *
 * Deshalb steht die Nummer in keiner Seite, in keinem Skript und in keiner
 * Konfigurationsdatei, die der Browser bekommt.
 */

const SCHRITTE: Schritt[] = ['beginn', 'koeln-ja', 'koeln-nein', 'koeln-keine-angabe', 'hilfe-ja', 'hilfe-nein']

export const POST: APIRoute = async ({ request, url }) => {
    const beginn = performance.now()

    const koerper = (await request.json().catch(() => ({}))) as { schritt?: unknown }
    const schritt = SCHRITTE.includes(koerper.schritt as Schritt) ? (koerper.schritt as Schritt) : 'beginn'

    const sitzung = sitzungLesen(leseCookie(request, COOKIE_NAME))
    const { angebot, sitzung: neueSitzung } = naechsterSchritt(schritt, sitzung, einstellungen())

    protokolliere({ route: '/api/kontakt', status: 200, dauer: performance.now() - beginn })

    return new Response(JSON.stringify(angebot), {
        status: 200,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            'Set-Cookie': cookieKopfzeile(neueSitzung, url.protocol === 'https:'),
        },
    })
}

function leseCookie(request: Request, name: string): string | undefined {
    const kopf = request.headers.get('cookie')
    if (!kopf) return undefined
    for (const teil of kopf.split(';')) {
        const [schluessel, ...rest] = teil.trim().split('=')
        if (schluessel === name) return rest.join('=')
    }
    return undefined
}
