import { AnthropicAnbieter } from './anthropic'
import { OpenAiAnbieter } from './openai'
import { KiFehler, type KiAnbieter, type SprachAnbieter } from './typen'

export * from './typen'

/**
 * Einzige Stelle im Projekt, die weiß, welche KI-Anbieter es gibt.
 *
 * Alles andere kennt nur die Schnittstellen KiAnbieter und SprachAnbieter.
 * Ein Anbieterwechsel ist damit eine Änderung in der .env, kein Umbau.
 */

let chatAnbieter: KiAnbieter | null = null
let sprachAnbieter: SprachAnbieter | null | undefined

function umgebung(name: string): string | undefined {
    const wert = process.env[name]
    return wert && wert.trim() !== '' ? wert.trim() : undefined
}

/** Liefert den Anbieter für den Chat. Wirft, wenn kein Schlüssel hinterlegt ist. */
export function chat(): KiAnbieter {
    if (chatAnbieter) return chatAnbieter

    const gewaehlt = (umgebung('KI_ANBIETER') || 'openai').toLowerCase()

    if (gewaehlt === 'anthropic') {
        const schluessel = umgebung('ANTHROPIC_API_KEY')
        if (!schluessel) {
            throw new KiFehler('ANTHROPIC_API_KEY ist nicht gesetzt.', 'kein-schluessel')
        }
        chatAnbieter = new AnthropicAnbieter({
            schluessel,
            modell: umgebung('ANTHROPIC_MODEL'),
            aufwand: umgebung('ANTHROPIC_AUFWAND'),
        })
        return chatAnbieter
    }

    if (gewaehlt !== 'openai') {
        throw new KiFehler(`Unbekannter Wert für KI_ANBIETER: ${gewaehlt}`, 'anbieter')
    }

    const schluessel = umgebung('OPENAI_API_KEY')
    if (!schluessel) {
        throw new KiFehler('OPENAI_API_KEY ist nicht gesetzt.', 'kein-schluessel')
    }
    chatAnbieter = new OpenAiAnbieter({
        schluessel,
        modell: umgebung('OPENAI_MODEL'),
        transkriptionsModell: umgebung('OPENAI_TRANSCRIPTION_MODEL'),
        ttsModell: umgebung('OPENAI_TTS_MODEL'),
    })
    return chatAnbieter
}

/**
 * Liefert den Anbieter für Spracherkennung und Vorlesen — oder null, wenn beides
 * im Browser stattfinden soll. Null ist ein gültiger Betriebszustand, kein Fehler:
 * Die Browser-Sprachausgabe ist datensparsamer, weil dabei nichts das Gerät verlässt.
 */
export function sprache(): SprachAnbieter | null {
    if (sprachAnbieter !== undefined) return sprachAnbieter

    const gewaehlt = (umgebung('SPRACHE_ANBIETER') || 'browser').toLowerCase()

    if (gewaehlt === 'browser') {
        sprachAnbieter = null
        return null
    }

    if (gewaehlt !== 'openai') {
        throw new KiFehler(`Unbekannter Wert für SPRACHE_ANBIETER: ${gewaehlt}`, 'anbieter')
    }

    const schluessel = umgebung('OPENAI_API_KEY')
    if (!schluessel) {
        throw new KiFehler('OPENAI_API_KEY ist für die Sprachfunktionen nicht gesetzt.', 'kein-schluessel')
    }
    sprachAnbieter = new OpenAiAnbieter({
        schluessel,
        transkriptionsModell: umgebung('OPENAI_TRANSCRIPTION_MODEL'),
        ttsModell: umgebung('OPENAI_TTS_MODEL'),
    })
    return sprachAnbieter
}

/** Nur für Tests: erzwingt beim nächsten Aufruf eine neue Auswahl. */
export function anbieterZuruecksetzen(): void {
    chatAnbieter = null
    sprachAnbieter = undefined
}
