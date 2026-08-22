import OpenAI from 'openai'
import { toFile } from 'openai/uploads'
import { zodTextFormat } from 'openai/helpers/zod'
import {
    KiAntwortSchema,
    KiFehler,
    type ChatAnfrage,
    type KiAnbieter,
    type KiAntwort,
    type SprachAnbieter,
} from './typen'
import { BILD_HINWEIS, systemprompt, type PromptKontext } from './systemprompt'

/**
 * Anbieter-Anbindung an die OpenAI Responses API.
 *
 * `store: false` ist nach GEO-LLM.txt §10 verbindlich. Es verhindert, dass die
 * Anfrage beim Anbieter zur späteren Abrufbarkeit abgelegt wird. Es verhindert
 * nicht automatisch jede Aufbewahrung in Sicherheitsprotokollen — das ist eine
 * Frage der Kontoeinstellungen und gehört in die Datenschutzerklärung, nicht in
 * einen Warntext am Chat.
 */
export class OpenAiAnbieter implements KiAnbieter, SprachAnbieter {
    readonly name = 'openai'
    #client: OpenAI
    #modell: string
    #transkriptionsModell: string
    #ttsModell: string

    constructor(optionen: {
        schluessel: string
        modell?: string
        transkriptionsModell?: string
        ttsModell?: string
    }) {
        this.#client = new OpenAI({ apiKey: optionen.schluessel })
        this.#modell = optionen.modell || 'gpt-4.1'
        this.#transkriptionsModell = optionen.transkriptionsModell || 'gpt-4o-transcribe'
        this.#ttsModell = optionen.ttsModell || 'gpt-4o-mini-tts'
    }

    async antworten(anfrage: ChatAnfrage): Promise<KiAntwort> {
        const kontext: PromptKontext = {
            fehlversuche: anfrage.fehlversuche,
            maxFehlversuche: Number(process.env.MAX_FAILED_ATTEMPTS ?? 3),
            einfacherErklaeren: anfrage.einfacherErklaeren ?? false,
            betrugsverdacht: anfrage.betrugsverdacht ?? false,
        }

        const verlauf = anfrage.verlauf.map((eintrag) => ({
            role: (eintrag.rolle === 'person' ? 'user' : 'assistant') as 'user' | 'assistant',
            content: eintrag.text,
        }))

        try {
            const antwort = await this.#client.responses.parse({
                model: this.#modell,
                instructions: systemprompt(kontext),
                input: [...verlauf, this.#letzteNachricht(anfrage)],
                store: false,
                text: { format: zodTextFormat(KiAntwortSchema, 'technik_antwort') },
            })

            if (!antwort.output_parsed) {
                throw new KiFehler('Die Antwort hatte nicht die erwartete Form.', 'ungueltige-antwort')
            }

            return antwort.output_parsed
        } catch (fehler) {
            throw uebersetzeFehler(fehler)
        }
    }

    async transkribieren(audio: Buffer, dateiname: string): Promise<string> {
        try {
            const datei = await toFile(audio, dateiname)
            const ergebnis = await this.#client.audio.transcriptions.create({
                file: datei,
                model: this.#transkriptionsModell,
                language: 'de',
            })
            return ergebnis.text
        } catch (fehler) {
            throw uebersetzeFehler(fehler)
        }
    }

    async vorlesen(text: string): Promise<{ daten: Buffer; typ: string }> {
        try {
            const antwort = await this.#client.audio.speech.create({
                model: this.#ttsModell,
                voice: 'alloy',
                input: text,
                // Ruhiges, leicht verlangsamtes Sprechen. Die Zielgruppe hört sonst
                // die Hälfte nicht.
                instructions: 'Sprich ruhig, freundlich und deutlich langsamer als üblich. Deutsch.',
                response_format: 'mp3',
            })
            return { daten: Buffer.from(await antwort.arrayBuffer()), typ: 'audio/mpeg' }
        } catch (fehler) {
            throw uebersetzeFehler(fehler)
        }
    }

    #letzteNachricht(anfrage: ChatAnfrage) {
        if (!anfrage.bild) {
            return { role: 'user' as const, content: anfrage.eingabe }
        }

        return {
            role: 'user' as const,
            content: [
                { type: 'input_text' as const, text: BILD_HINWEIS },
                {
                    type: 'input_image' as const,
                    detail: 'auto' as const,
                    image_url: `data:${anfrage.bild.typ};base64,${anfrage.bild.daten.toString('base64')}`,
                },
                {
                    type: 'input_text' as const,
                    text: anfrage.eingabe || 'Bitte schauen Sie sich das Foto an.',
                },
            ],
        }
    }
}

function uebersetzeFehler(fehler: unknown): Error {
    if (fehler instanceof KiFehler) return fehler
    if (fehler instanceof OpenAI.AuthenticationError) {
        return new KiFehler('Der Zugangsschlüssel wird nicht akzeptiert.', 'kein-schluessel')
    }
    if (fehler instanceof OpenAI.APIError) {
        return new KiFehler(`Der KI-Dienst antwortet nicht wie erwartet (${fehler.status}).`, 'anbieter')
    }
    return new KiFehler('Der KI-Dienst ist nicht erreichbar.', 'anbieter')
}
