import type { APIRoute } from 'astro'
import { chat, KiFehler, type ChatAnfrage, type KiAntwort, type Nachricht } from '../../lib/ki'
import {
    enthaeltZugangsdaten,
    pruefeBetrug,
    ZUGANGSDATEN_HINWEIS,
} from '../../lib/sicherheit/betrugserkennung'
import {
    COOKIE_NAME,
    cookieKopfzeile,
    LEERE_SITZUNG,
    sitzungLesen,
    type Sitzung,
} from '../../lib/sicherheit/sitzungscookie'
import { ABLEHNUNGSTEXT, pruefeGrenzen, pruefeWiederholung } from '../../lib/schutz/ratelimit'
import { fehlerart, protokolliere } from '../../lib/schutz/protokoll'
import { pruefeZweck } from '../../lib/schutz/vorpruefung'
import { fremdeHerkunft } from '../../lib/schutz/herkunft'
import { BEGRUESSUNG } from '../../inhalte/texte'

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
    /** Feld, das kein Mensch sieht. Siehe Chat.astro. */
    hinweisfeld?: unknown
}

const WIEDERHOLUNG_TEXT =
    'Diese Nachricht haben Sie gerade schon geschickt. Bitte beschreiben Sie mit anderen Worten, was nicht klappt — dann komme ich besser weiter.'

export const POST: APIRoute = async ({ request, clientAddress, url }) => {
    const beginn = performance.now()
    let status = 200
    let vermerk: string | undefined

    try {
        // Ein Aufruf von einer fremden Seite kostet denselben Schlüsselzugriff
        // wie ein echter — nur dass niemand davon etwas hat.
        if (fremdeHerkunft(request, url)) {
            status = 403
            vermerk = 'fremde-herkunft'
            return antwortJson(fehlerAntwort('Diese Anfrage kam nicht von unserer Website.'), status)
        }

        const koerper = (await request.json()) as AnfrageKoerper
        const eingabe = typeof koerper.eingabe === 'string' ? koerper.eingabe.trim() : ''
        const verlauf = leseVerlauf(koerper.verlauf)
        const neuBeginnen = koerper.neuBeginnen === true

        // Das unsichtbare Feld ist ausgefüllt: Das schafft nur ein Programm,
        // das das Formular ausliest und alles hineinschreibt, was es findet.
        if (typeof koerper.hinweisfeld === 'string' && koerper.hinweisfeld.trim() !== '') {
            status = 400
            vermerk = 'hinweisfeld'
            return antwortJson(fehlerAntwort('Bitte schreiben Sie Ihre Frage in das große Feld.'), status)
        }

        if (!neuBeginnen && !eingabe && verlauf.length === 0) {
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
        if (neuBeginnen) {
            sitzung = { ...LEERE_SITZUNG }
        }

        const kennung = besucherKennung(request, clientAddress)
        const ablehnung = pruefeGrenzen(kennung, sitzung.nachrichten)
        if (ablehnung) {
            status = 429
            vermerk = `grenze:${ablehnung}`
            return antwortJson(fehlerAntwort(ABLEHNUNGSTEXT[ablehnung]), status, sitzung, url)
        }

        // Ein Neubeginn braucht kein Sprachmodell: Der Text ist immer derselbe.
        // Der Aufruf setzt nur den Zähler im Cookie zurück.
        if (neuBeginnen) {
            vermerk = 'neubeginn'
            return antwortJson(ohneKi(BEGRUESSUNG), status, sitzung, url)
        }

        // Ein gescheiterter Lösungsschritt zählt für die Eskalation nach §16.
        // Der Zähler hängt an einer ausdrücklichen Rückmeldung, nicht an einer
        // Vermutung des Sprachmodells — sonst wäre die Eskalation nicht verlässlich.
        if (koerper.ergebnis === 'nicht-geholfen') sitzung.versuche++
        if (koerper.ergebnis === 'geholfen') sitzung.versuche = 0

        /*
         * Ob schon ein Gespräch läuft, entscheidet der signierte Zähler im
         * Cookie — nicht der mitgeschickte Verlauf. Der kommt aus dem Browser
         * und ließe sich frei behaupten, um die Zweckprüfung zu umgehen.
         */
        const imGespraech = sitzung.nachrichten > 0

        const befund = pruefeBetrug(eingabe)
        const zugangsdaten = enthaeltZugangsdaten(eingabe)

        /*
         * Zweckprüfung vor dem Schlüssel (siehe vorpruefung.ts). Sicherheit hat
         * Vorrang: Wer einen Betrug schildert oder versehentlich ein Passwort
         * eintippt, wird nie an einer Themenliste abgewiesen.
         */
        if (!befund && !zugangsdaten) {
            const vorbefund = pruefeZweck(eingabe, imGespraech)
            if (vorbefund) {
                vermerk = `vorpruefung:${vorbefund.grund}`
                return antwortJson(ohneKi(vorbefund.antwort), status, sitzung, url)
            }

            if (pruefeWiederholung(kennung, eingabe)) {
                vermerk = 'wiederholung'
                return antwortJson(ohneKi(WIEDERHOLUNG_TEXT), status, sitzung, url)
            }
        }

        /*
         * Erst hier wird mitgezählt — nach allen Prüfungen, vor dem Aufruf.
         *
         * Zählte die Sitzung schon eine abgewiesene Nachricht mit, wäre die
         * Sitzung danach "im Gespräch" und die Themenprüfung damit für immer
         * abgeschaltet. Eine einzige abgewiesene Nachricht hätte den Zugang
         * geöffnet. Außerdem ist der Zähler die Kostengrenze, und was den
         * Schlüssel nie erreicht, kostet auch nichts.
         */
        sitzung.nachrichten++

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

        if (zugangsdaten) {
            antwort.antwortText = `${ZUGANGSDATEN_HINWEIS}\n\n${antwort.antwortText}`
            antwort.vorleseText = `${ZUGANGSDATEN_HINWEIS} ${antwort.vorleseText}`
        }

        if (antwort.status === 'eskalation') sitzung.koelnGefragt = true

        return antwortJson({ ok: true as const, antwort, betrugsverdacht: befund?.art ?? null }, status, sitzung, url)
    } catch (fehler) {
        status = fehler instanceof KiFehler && fehler.ursache === 'kein-schluessel' ? 503 : 502
        protokolliere({
            route: '/api/chat',
            status,
            dauer: performance.now() - beginn,
            fehlerart: fehlerart(fehler),
            vermerk,
        })
        return antwortJson(
            fehlerAntwort(
                'Ich konnte gerade nicht antworten. Bitte tippen Sie noch einmal auf Senden. Wenn es weiter nicht geht, versuchen Sie es in ein paar Minuten erneut.',
            ),
            status,
        )
    } finally {
        if (status < 500) {
            protokolliere({ route: '/api/chat', status, dauer: performance.now() - beginn, vermerk })
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

/**
 * Eine vollwertige Antwort, die ohne Sprachmodell zustande kam. Für die
 * Oberfläche sieht sie aus wie jede andere — die Person merkt keinen Bruch.
 */
function ohneKi(text: string) {
    const antwort: KiAntwort = {
        antwortText: text,
        vorleseText: text,
        schaltflaechen: [],
        sicherheitshinweis: null,
        status: 'frage',
    }
    return { ok: true as const, antwort, betrugsverdacht: null }
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
