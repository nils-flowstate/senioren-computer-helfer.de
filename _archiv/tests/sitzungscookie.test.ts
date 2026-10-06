import { createHmac } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import {
    cookieKopfzeile,
    LEERE_SITZUNG,
    sitzungLesen,
    sitzungSchreiben,
    type Sitzung,
} from '../src/lib/sicherheit/sitzungscookie'

beforeAll(() => {
    process.env.SESSION_SECRET = 'testgeheimnis-mindestens-zweiunddreissig-zeichen'
})

const BEISPIEL: Sitzung = {
    versuche: 3,
    koelnGefragt: true,
    koelnBestaetigt: true,
    hilfeAngefragt: false,
    nachrichten: 7,
    ausgestellt: 0,
}

describe('Signierte Sitzung', () => {
    it('liest zurück, was geschrieben wurde', () => {
        const gelesen = sitzungLesen(sitzungSchreiben(BEISPIEL))
        expect(gelesen.versuche).toBe(3)
        expect(gelesen.koelnBestaetigt).toBe(true)
        expect(gelesen.nachrichten).toBe(7)
    })

    it('verwirft eine veränderte Nutzlast', () => {
        // Genau der Angriff, gegen den die Signatur schützt: den Zähler
        // hochsetzen, um die Telefonnummer freizuschalten.
        const gefaelscht = Buffer.from(
            JSON.stringify({ ...BEISPIEL, versuche: 99, ausgestellt: Math.floor(Date.now() / 1000) }),
        ).toString('base64url')
        const echt = sitzungSchreiben(BEISPIEL)
        const unterschrift = echt.split('.')[1]

        expect(sitzungLesen(`${gefaelscht}.${unterschrift}`)).toEqual(LEERE_SITZUNG)
    })

    it('verwirft Unsinn und leere Werte', () => {
        expect(sitzungLesen(undefined)).toEqual(LEERE_SITZUNG)
        expect(sitzungLesen('kaputt')).toEqual(LEERE_SITZUNG)
        expect(sitzungLesen('a.b')).toEqual(LEERE_SITZUNG)
    })

    it('verwirft eine abgelaufene Sitzung', () => {
        const alt = { ...BEISPIEL, ausgestellt: Math.floor(Date.now() / 1000) - 5 * 60 * 60 }
        // Neu signieren, damit nur das Alter der Grund für die Ablehnung ist.
        const nutzlast = Buffer.from(JSON.stringify(alt)).toString('base64url')
        const unterschrift = createHmac('sha256', process.env.SESSION_SECRET!).update(nutzlast).digest('base64url')

        expect(sitzungLesen(`${nutzlast}.${unterschrift}`)).toEqual(LEERE_SITZUNG)
    })

    it('setzt HttpOnly und SameSite, Secure nur über HTTPS', () => {
        const ueberHttps = cookieKopfzeile(BEISPIEL, true)
        expect(ueberHttps).toContain('HttpOnly')
        expect(ueberHttps).toContain('SameSite=Lax')
        expect(ueberHttps).toContain('Secure')

        expect(cookieKopfzeile(BEISPIEL, false)).not.toContain('Secure')
    })

    it('enthält keinen Gesprächsinhalt', () => {
        // Wenn jemand später ein Textfeld hinzufügt, fällt es hier auf.
        const nutzlast = sitzungSchreiben(BEISPIEL).split('.')[0]!
        const inhalt = JSON.parse(Buffer.from(nutzlast, 'base64url').toString('utf8'))
        for (const wert of Object.values(inhalt)) {
            expect(typeof wert).not.toBe('string')
        }
    })
})
