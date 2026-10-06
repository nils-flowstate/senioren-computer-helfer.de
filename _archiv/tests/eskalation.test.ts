import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
    einstellungen,
    naechsterSchritt,
    type Einstellungen,
    type KontaktAngebot,
} from '../src/lib/kontakt/eskalation'
import { LEERE_SITZUNG, type Sitzung } from '../src/lib/sicherheit/sitzungscookie'

/*
 * Diese Tests bewachen die Freigabe einer privaten Telefonnummer (§16).
 * Sie sind deshalb bewusst misstrauisch: Sie prüfen nicht nur, dass der
 * vorgesehene Weg funktioniert, sondern vor allem, dass jede Abkürzung
 * daran vorbei ins Leere läuft.
 */

const UMGEBUNG = { ...process.env }

beforeEach(() => {
    process.env.MAX_FAILED_ATTEMPTS = '3'
    process.env.LOCAL_SERVICE_ENABLED = 'true'
    process.env.LOCAL_SERVICE_CITY = 'Koeln'
    process.env.SUPPORT_EMAIL = 'hilfe@example.de'
    process.env.ENABLE_PHONE_SUPPORT = 'true'
    process.env.SUPPORT_PHONE = '+49 221 1234567'
    process.env.ENABLE_WHATSAPP_SUPPORT = 'true'
    process.env.SUPPORT_WHATSAPP = '+49 221 1234567'
})

afterEach(() => {
    process.env = { ...UMGEBUNG }
})

/** Eine Sitzung, die den Drei-Versuche-Ablauf hinter sich hat. */
function nachDreiVersuchen(zusatz: Partial<Sitzung> = {}): Sitzung {
    return { ...LEERE_SITZUNG, versuche: 3, ...zusatz }
}

/** Alles, was beim Angebot nach außen geht — Text wie Kontaktweg. */
function alleTexte(angebot: KontaktAngebot): string {
    return [angebot.text, angebot.vorleseText, ...Object.values(angebot.kontakt)].join(' ')
}

describe('Eskalation nach drei erfolglosen Versuchen', () => {
    it('fragt nach dem Wohnort, aber erst nach dem dritten Versuch', () => {
        const einst = einstellungen()
        const { angebot } = naechsterSchritt('beginn', nachDreiVersuchen(), einst)

        expect(angebot.text).toBe('Wohnen Sie in Köln?')
        expect(angebot.schaltflaechen.map((s) => s.beschriftung)).toEqual([
            'Ja',
            'Nein',
            'Möchte ich nicht sagen',
        ])
        expect(angebot.kontakt.telefon).toBeUndefined()
    })

    it('fragt vor dem dritten Versuch gar nicht erst nach dem Wohnort', () => {
        const einst = einstellungen()
        for (const versuche of [0, 1, 2]) {
            const { angebot } = naechsterSchritt('beginn', { ...LEERE_SITZUNG, versuche }, einst)
            expect(angebot.text).not.toContain('Köln')
            expect(angebot.kontakt.telefon).toBeUndefined()
            expect(angebot.kontakt.email).toBe('hilfe@example.de')
        }
    })

    it('gibt die Nummer erst nach zwei ausdrücklichen Ja frei', () => {
        const einst = einstellungen()

        const eins = naechsterSchritt('beginn', nachDreiVersuchen(), einst)
        expect(eins.sitzung.koelnGefragt).toBe(true)

        const zwei = naechsterSchritt('koeln-ja', eins.sitzung, einst)
        expect(zwei.angebot.text).toBe('Möchten Sie persönliche Hilfe bei Ihnen zu Hause anfragen?')
        expect(zwei.sitzung.koelnBestaetigt).toBe(true)
        // Nach dem ERSTEN Ja ist die Nummer noch nicht dabei.
        expect(zwei.angebot.kontakt.telefon).toBeUndefined()

        const drei = naechsterSchritt('hilfe-ja', zwei.sitzung, einst)
        expect(drei.angebot.kontakt.telefon).toBe('+49 221 1234567')
        expect(drei.angebot.kontakt.whatsapp).toBe('https://wa.me/492211234567')
        // Die E-Mail bleibt als barrierearme Alternative daneben stehen (§16).
        expect(drei.angebot.kontakt.email).toBe('hilfe@example.de')
        expect(drei.sitzung.hilfeAngefragt).toBe(true)
    })

    it('verspricht im Freigabetext weder Termin noch Lösung und warnt vor PIN und TAN', () => {
        const einst = einstellungen()
        const sitzung = nachDreiVersuchen({ koelnGefragt: true, koelnBestaetigt: true })
        const { angebot } = naechsterSchritt('hilfe-ja', sitzung, einst)

        expect(angebot.text).toContain('noch nicht fest')
        expect(angebot.text).toContain('nicht versprechen')
        expect(angebot.text).toMatch(/PIN/)
    })
})

describe('Abkürzungen am Ablauf vorbei', () => {
    it('gibt nichts frei, wenn die Versuche nicht gezählt wurden', () => {
        const einst = einstellungen()
        // Genau der Angriff: direkt den letzten Schritt aufrufen.
        const { angebot } = naechsterSchritt('hilfe-ja', LEERE_SITZUNG, einst)

        expect(alleTexte(angebot)).not.toContain('221')
        expect(angebot.kontakt.telefon).toBeUndefined()
        expect(angebot.kontakt.whatsapp).toBeUndefined()
    })

    it('gibt nichts frei, wenn der Wohnort nie bestätigt wurde', () => {
        const einst = einstellungen()
        const { angebot } = naechsterSchritt('hilfe-ja', nachDreiVersuchen(), einst)

        expect(angebot.kontakt.telefon).toBeUndefined()
        expect(angebot.kontakt.whatsapp).toBeUndefined()
        expect(angebot.kontakt.email).toBe('hilfe@example.de')
    })

    it('bietet bei Nein und bei keiner Angabe nur die E-Mail an', () => {
        const einst = einstellungen()
        const sitzung = nachDreiVersuchen({ koelnGefragt: true })

        for (const schritt of ['koeln-nein', 'koeln-keine-angabe', 'hilfe-nein'] as const) {
            const { angebot } = naechsterSchritt(schritt, sitzung, einst)
            expect(angebot.kontakt.email).toBe('hilfe@example.de')
            expect(angebot.kontakt.telefon).toBeUndefined()
            expect(angebot.kontakt.whatsapp).toBeUndefined()
            expect(alleTexte(angebot)).not.toContain('221')
        }
    })
})

describe('Abgeschaltete Funktionen', () => {
    it('fragt ohne Vor-Ort-Hilfe nicht nach dem Wohnort', () => {
        process.env.LOCAL_SERVICE_ENABLED = 'false'
        const { angebot } = naechsterSchritt('beginn', nachDreiVersuchen(), einstellungen())

        expect(angebot.text).not.toContain('Köln')
        expect(angebot.kontakt.email).toBe('hilfe@example.de')
    })

    it('gibt bei ENABLE_PHONE_SUPPORT=false auch am Ende keine Nummer heraus', () => {
        process.env.ENABLE_PHONE_SUPPORT = 'false'
        process.env.ENABLE_WHATSAPP_SUPPORT = 'false'

        const einst = einstellungen()
        expect(einst.telefon).toBeUndefined()
        expect(einst.whatsapp).toBeUndefined()

        const sitzung = nachDreiVersuchen({ koelnGefragt: true, koelnBestaetigt: true })
        const { angebot } = naechsterSchritt('hilfe-ja', sitzung, einst)

        expect(angebot.kontakt.telefon).toBeUndefined()
        expect(angebot.kontakt.whatsapp).toBeUndefined()
        expect(alleTexte(angebot)).not.toContain('221')
        // Ehrlich bleiben, statt eine Möglichkeit anzudeuten, die es nicht gibt.
        expect(angebot.text).toContain('nicht anbieten')
    })

    it('liest die Nummer nur bei eingeschalteter Funktion aus der Umgebung', () => {
        process.env.ENABLE_PHONE_SUPPORT = 'false'
        expect(einstellungen().telefon).toBeUndefined()

        process.env.ENABLE_PHONE_SUPPORT = 'true'
        expect(einstellungen().telefon).toBe('+49 221 1234567')
    })
})

describe('Einstellungen', () => {
    it('zeigt die Stadt mit Umlaut, auch wenn sie in der .env ohne steht', () => {
        process.env.LOCAL_SERVICE_CITY = 'Koeln'
        const einst: Einstellungen = einstellungen()
        expect(einst.stadt).toBe('Köln')
    })
})
