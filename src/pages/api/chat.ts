import type { APIRoute } from 'astro'
import { chat, KiFehler, type ChatAnfrage, type KiAntwort, type Nachricht } from '../../lib/ki'
import {
    enthaeltZugangsdaten,
    pruefeBetrug,
    ZUGANGSDATEN_HINWEIS,
} from '../../lib/sicherheit/betrugserkennung'
import { COOKIE_NAME, cookieKopfzeile, sitzungLesen, type Sitzung } from '../../lib/sicherheit/sitzungscookie'
import { ABLEHNUNGSTEXT, pruefeGrenzen } from '../../lib/schutz/ratelimit'
import { fehlerart, protokolliere } from '../../lib/schutz/protokoll'

export const prerender = false

const MAX_EINGABE_ZEICHEN = 2000
const MAX_VERLAUF = 40

interface AnfrageKoerper {
    eingabe?: unknown
    verlauf?: unknown
    /** Rückmeldung zum vorherigen Lösungsschritt. Steuert den Eskalationszähler. */
    ergebnis?: unknown
    einfacherErklaeren?: unknown
    neuBeginnen?: unknown
}

export const POST: APIRoute = async ({ request, clientAddress, url }) => {
    const beginn = performance.now()
    let status = 200

    try {
        const koerper = (await request.json()) as AnfrageKoerper
        const eingabe = typeof koerper.eingabe === 'string' ? koerper.eingabe.trim() : ''
        const verlauf = leseVerlauf(koerper.verlauf)

        if (!eingabe && verlauf.length === 0) {
            status = 400
            return antwortJson(fehlerAntwort('Bitte schreiben Sie kurz, womit ich Ihnen helfen kann.'), status)
        }

        if (eingabe.length > MAX_EINGABE_ZEICHEN) {
            status = 413
            return antwortJson(
                fehlerAntwort('Ihre Nachricht ist sehr lang. Bitte beschreiben Sie das Problem in ein paar Sätzen.'),
                status,
            )
        }

        let sitzung = sitzungLesen(leseCookie(request, COOKIE_NAME))
        if (koerper.neuBeginnen === true) {
            sitzung = { versuche: 0, koelnGefragt: false, koelnBestaetigt: false, hilfeAngefragt: false, nachrichten: 0, ausgestellt: 0 }
        }

        const ablehnung = pruefeGrenzen(besucherKennung(request, clientAddress), sitzung.nachrichten)
        if (ablehnung) {
            status = 429
            return antwortJson(fehlerAntwort(ABLEHNUNGSTEXT[ablehnung]), status, sitzung, url)
        }

        // Ein gescheiterter Lösungsschritt zählt für die Eskalation nach §16.
        // Der Zähler hängt an einer ausdrücklichen Rückmeldung, nicht an einer
        // Vermutung des Sprachmodells — sonst wäre die Eskalation nicht verlässlich.
        if (koerper.ergebnis === 'nicht-geholfen') sitzung.versuche++
        if (koerper.ergebnis === 'geholfen') sitzung.versuche = 0
        sitzung.nachrichten++

        const befund = pruefeBetrug(eingabe)

        const anfrage: ChatAnfrage = {
            verlauf,
            eingabe,
            fehlversuche: sitzung.versuche,
            einfacherErklaeren: koerper.einfacherErklaeren === true,
            betrugsverdacht: befund !== null,
        }

        const antwort = await chat().antworten(anfrage)

        // Der deterministische Sicherheitshinweis hat Vorrang vor dem, was das
        // Sprachmodell formuliert hat. Er ist geprüft und ändert sich nicht.
        if (befund) {
            antwort.sicherheitshinweis = `${befund.hinweis} ${befund.naechsterSchritt}`
        }

        if (enthaeltZugangsdaten(eingabe)) {
            antwort.antwortText = `${ZUGANGSDATEN_HINWEIS}\n\n${antwort.antwortText}`
            antwort.vorleseText = `${ZUGANGSDATEN_HINWEIS} ${antwort.vorleseText}`
        }

        if (antwort.status === 'eskalation') sitzung.koelnGefragt = true

        return antwortJson({ ok: true as const, antwort, betrugsverdacht: befund?.art ?? null }, status, sitzung, url)
    } catch (fehler) {
        status = fehler instanceof KiFehler && fehler.ursache === 'kein-schluessel' ? 503 : 502
        protokolliere({ route: '/api/chat', status, dauer: performance.now() - beginn, fehlerart: fehlerart(fehler) })
        return antwortJson(
            fehlerAntwort(
                'Ich konnte gerade nicht antworten. Bitte tippen Sie noch einmal auf Senden. Wenn es weiter nicht geht, versuchen Sie es in ein paar Minuten erneut.',
            ),
            status,
        )
    } finally {
        if (status < 500) {
            protokolliere({ route: '/api/chat', status, dauer: performance.now() - beginn })
        }
    }
}

/** Fehler bekommen dieselbe Form wie eine normale Antwort — die Oberfläche hat nur einen Fall. */
function fehlerAntwort(text: string) {
    const antwort: KiAntwort = {
        antwortText: text,
        vorleseText: text,
        schaltflaechen: [],
        sicherheitshinweis: null,
        status: 'frage',
    }
    return { ok: false as const, antwort, betrugsverdacht: null }
}

function antwortJson(inhalt: unknown, status: number, sitzung?: Sitzung, url?: URL): Response {
    const kopf: Record<string, string> = {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
    }
    if (sitzung && url) {
        kopf['Set-Cookie'] = cookieKopfzeile(sitzung, url.protocol === 'https:')
    }
    return new Response(JSON.stringify(inhalt), { status, headers: kopf })
}

function leseVerlauf(roh: unknown): Nachricht[] {
    if (!Array.isArray(roh)) return []
    return roh
        .filter(
            (eintrag): eintrag is Nachricht =>
                typeof eintrag === 'object' &&
                eintrag !== null &&
                typeof (eintrag as Nachricht).text === 'string' &&
                ((eintrag as Nachricht).rolle === 'person' || (eintrag as Nachricht).rolle === 'assistent'),
        )
        .slice(-MAX_VERLAUF)
        .map((eintrag) => ({ rolle: eintrag.rolle, text: eintrag.text.slice(0, MAX_EINGABE_ZEICHEN) }))
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

/**
 * Merkmal für die Anfragebegrenzung. Wird sofort in ratelimit.ts zu einem
 * täglich wechselnden HMAC verrechnet und nirgends gespeichert.
 */
function besucherKennung(request: Request, clientAddress: string): string {
    const weitergeleitet = request.headers.get('x-forwarded-for')
    if (weitergeleitet) return weitergeleitet.split(',')[0]!.trim()
    return clientAddress || 'unbekannt'
}
