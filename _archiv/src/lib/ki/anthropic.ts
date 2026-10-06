import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { KiAntwortSchema, KiFehler, type ChatAnfrage, type KiAnbieter, type KiAntwort } from './typen'
import { BILD_HINWEIS, systemprompt, type PromptKontext } from './systemprompt'

/** Wie gründlich das Modell nachdenken soll. Mehr Aufwand heißt langsamer und teurer. */
type Aufwand = 'low' | 'medium' | 'high' | 'xhigh' | 'max'

/**
 * Anbieter-Anbindung an die Anthropic Messages API.
 *
 * Spracherkennung und Vorlesen fehlen hier bewusst: Anthropic bietet beides nicht
 * an. Wer diesen Anbieter für den Chat wählt, bekommt Sprache weiterhin über
 * OpenAI oder über den Browser — siehe SPRACHE_ANBIETER in der .env.
 */
export class AnthropicAnbieter implements KiAnbieter {
    readonly name = 'anthropic'
    #client: Anthropic
    #modell: string
    #aufwand: Aufwand

    constructor(optionen: { schluessel: string; modell?: string; aufwand?: string }) {
        this.#client = new Anthropic({ apiKey: optionen.schluessel })
        this.#modell = optionen.modell || 'claude-opus-5'
        // "medium" statt des Vorgabewerts "high": Die Antworten sind kurz und die
        // Zielgruppe wartet ungern. Über ANTHROPIC_AUFWAND änderbar.
        this.#aufwand = (optionen.aufwand as Aufwand) || 'medium'
    }

    async antworten(anfrage: ChatAnfrage): Promise<KiAntwort> {
        const kontext: PromptKontext = {
            fehlversuche: anfrage.fehlversuche,
            maxFehlversuche: Number(process.env.MAX_FAILED_ATTEMPTS ?? 3),
            einfacherErklaeren: anfrage.einfacherErklaeren ?? false,
            betrugsverdacht: anfrage.betrugsverdacht ?? false,
        }

        const nachrichten: Anthropic.MessageParam[] = anfrage.verlauf.map((eintrag) => ({
            role: eintrag.rolle === 'person' ? 'user' : 'assistant',
            content: eintrag.text,
        }))

        try {
            const antwort = await this.#client.messages.parse({
                model: this.#modell,
                max_tokens: 8000,
                system: systemprompt(kontext),
                messages: [...nachrichten, this.#letzteNachricht(anfrage)],
                output_config: {
                    format: zodOutputFormat(KiAntwortSchema),
                    effort: this.#aufwand,
                },
            })

            if (antwort.stop_reason === 'refusal') {
                throw new KiFehler('Die Anfrage wurde abgelehnt.', 'anbieter')
            }

            if (!antwort.parsed_output) {
                throw new KiFehler('Die Antwort hatte nicht die erwartete Form.', 'ungueltige-antwort')
            }

            return antwort.parsed_output
        } catch (fehler) {
            throw uebersetzeFehler(fehler)
        }
    }

    /** Baut die neue Nachricht, bei Bedarf mit Foto und dem Schutzrahmen davor. */
    #letzteNachricht(anfrage: ChatAnfrage): Anthropic.MessageParam {
        if (!anfrage.bild) {
            return { role: 'user', content: anfrage.eingabe }
        }

        return {
            role: 'user',
            content: [
                { type: 'text', text: BILD_HINWEIS },
                {
                    type: 'image',
                    source: {
                        type: 'base64',
                        media_type: anfrage.bild.typ as 'image/jpeg' | 'image/png' | 'image/webp',
                        data: anfrage.bild.daten.toString('base64'),
                    },
                },
                { type: 'text', text: anfrage.eingabe || 'Bitte schauen Sie sich das Foto an.' },
            ],
        }
    }
}

function uebersetzeFehler(fehler: unknown): Error {
    if (fehler instanceof KiFehler) return fehler
    if (fehler instanceof Anthropic.AuthenticationError) {
        return new KiFehler('Der Zugangsschlüssel wird nicht akzeptiert.', 'kein-schluessel')
    }
    if (fehler instanceof Anthropic.APIError) {
        return new KiFehler(`Der KI-Dienst antwortet nicht wie erwartet (${fehler.status}).`, 'anbieter')
    }
    return new KiFehler('Der KI-Dienst ist nicht erreichbar.', 'anbieter')
}
