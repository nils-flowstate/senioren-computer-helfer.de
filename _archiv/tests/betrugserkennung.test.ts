import { describe, expect, it } from 'vitest'
import {
    enthaeltZugangsdaten,
    pruefeBetrug,
} from '../src/lib/sicherheit/betrugserkennung'

/*
 * Diese Tests sind der Grund, warum die Betrugsprüfung als Regelwerk und nicht
 * als reine Modellaufgabe umgesetzt ist: Man kann sie festnageln.
 */

describe('Betrugsprüfung', () => {
    it('erkennt die Frage nach einer TAN', () => {
        const befund = pruefeBetrug('Meine Bank hat angerufen und will eine TAN von mir.')
        expect(befund?.art).toBe('bankdaten')
        expect(befund?.naechsterSchritt).toContain('116 116')
    })

    it('erkennt den angeblichen Microsoft-Anruf', () => {
        const befund = pruefeBetrug('Ein Mitarbeiter von Microsoft hat angerufen wegen einem Virus.')
        expect(befund?.art).toBe('fernwartung')
    })

    it('erkennt Fernwartungsprogramme beim Namen', () => {
        expect(pruefeBetrug('Ich soll AnyDesk installieren.')?.art).toBe('fernwartung')
        expect(pruefeBetrug('Er wollte TeamViewer bei mir einrichten.')?.art).toBe('fernwartung')
    })

    it('erkennt den Schockanruf', () => {
        const befund = pruefeBetrug('Mein Enkel braucht dringend Geld für eine Kaution.')
        expect(befund?.art).toBe('schockanruf')
        expect(befund?.naechsterSchritt).toContain('110')
    })

    it('erkennt gefälschte Paketnachrichten', () => {
        expect(pruefeBetrug('DHL schreibt, ich soll eine Gebühr zahlen über den Link.')?.art).toBe('paket')
    })

    it('erkennt Gewinnversprechen', () => {
        expect(pruefeBetrug('Ich habe angeblich gewonnen, soll aber eine Bearbeitungsgebühr zahlen.')?.art).toBe('gewinn')
    })

    it('erkennt Druck über eine angebliche Kontosperre', () => {
        expect(pruefeBetrug('Mein Konto wird gesperrt, ich soll meine Daten bestätigen über den Link.')?.art).toBe('kontosperre')
    })

    it('schlägt bei harmlosen Fragen nicht an', () => {
        expect(pruefeBetrug('Mein Drucker druckt nicht mehr.')).toBeNull()
        expect(pruefeBetrug('Wie stelle ich die Schrift größer?')).toBeNull()
        expect(pruefeBetrug('Das WLAN ist weg.')).toBeNull()
        expect(pruefeBetrug('')).toBeNull()
    })

    it('setzt Bankdaten vor andere Treffer', () => {
        // Enthält Muster für Bankdaten und für Kontosperre zugleich.
        const befund = pruefeBetrug('Die Sparkasse hat mir eine SMS geschrieben, mein Konto sei gesperrt.')
        expect(befund?.art).toBe('bankdaten')
    })
})

describe('Erkennung versehentlich eingegebener Zugangsdaten', () => {
    it('erkennt ein ausgeschriebenes Passwort', () => {
        expect(enthaeltZugangsdaten('Mein Passwort ist Sonnenblume12')).toBe(true)
        expect(enthaeltZugangsdaten('PIN: 4711')).toBe(true)
    })

    it('hält normale Sätze über Passwörter aus', () => {
        expect(enthaeltZugangsdaten('Ich habe mein Passwort vergessen.')).toBe(false)
        expect(enthaeltZugangsdaten('Wo kann ich das Passwort ändern?')).toBe(false)
    })
})
