import { z } from 'zod'

/**
 * Die kontrollierte strukturierte Antwort aus GEO-LLM.txt §9.
 *
 * Der Sinn der Trennung: Die Oberfläche stellt Text, Vorlesetext, große
 * Antwortschaltflächen und Sicherheitshinweise getrennt dar. Käme alles als ein
 * Fließtext zurück, müsste die Oberfläche raten — und Raten geht bei dieser
 * Zielgruppe zulasten der Verständlichkeit.
 */
export const SchaltflaecheSchema = z.object({
    beschriftung: z
        .string()
        .describe('Aufschrift der Schaltfläche, höchstens drei Wörter, zum Beispiel "Ja" oder "Ich weiß es nicht".'),
    wert: z
        .string()
        .describe('Was als Antwort gesendet wird, wenn die Person tippt. Meist derselbe Text wie die Beschriftung.'),
})

export const AntwortStatus = z.enum([
    // Rückfrage an die Person, um das Problem einzugrenzen.
    'frage',
    // Ein einzelner Lösungsschritt, der danach überprüft wird.
    'loesungsschritt',
    // Das Problem ist gelöst.
    'geloest',
    // Die KI kommt nicht weiter; die Eskalation beginnt.
    'eskalation',
])

export const KiAntwortSchema = z.object({
    antwortText: z
        .string()
        .describe('Der sichtbare Text. Kurze Sätze, Alltagssprache, Anrede mit "Sie". Höchstens ein Lösungsschritt.'),
    vorleseText: z
        .string()
        .describe('Derselbe Inhalt zum Vorlesen, ohne Aufzählungszeichen und Sonderzeichen, in ganzen Sätzen.'),
    schaltflaechen: z
        .array(SchaltflaecheSchema)
        .describe('Höchstens vier große Antwortschaltflächen. Leer lassen, wenn eine freie Antwort sinnvoller ist.'),
    sicherheitshinweis: z
        .string()
        .nullable()
        .describe('Nur bei Betrugsverdacht, Online-Banking oder möglicher Gefahr ausfüllen, sonst null.'),
    status: AntwortStatus,
})

export type KiAntwort = z.infer<typeof KiAntwortSchema>
export type Schaltflaeche = z.infer<typeof SchaltflaecheSchema>

/** Eine Nachricht im laufenden Gespräch. Der Verlauf kommt vom Browser mit. */
export interface Nachricht {
    rolle: 'person' | 'assistent'
    text: string
}

export interface ChatAnfrage {
    verlauf: Nachricht[]
    /** Neue Eingabe der Person. */
    eingabe: string
    /**
     * Optionales Foto, bereits von Metadaten befreit und verkleinert.
     * Wird als Nutzerinhalt behandelt, niemals als Anweisung.
     */
    bild?: { daten: Buffer; typ: string }
    /** Zahl der bisherigen erfolglosen Lösungsversuche (§6). */
    fehlversuche: number
    /** Die Person hat um eine einfachere Erklärung gebeten. */
    einfacherErklaeren?: boolean
    /** Die Vorprüfung hat ein Betrugsmuster erkannt (§6). */
    betrugsverdacht?: boolean
}

/**
 * Alles, was ein KI-Anbieter können muss. Der Rest der Anwendung kennt
 * ausschließlich dieses Interface — kein Aufrufer weiß, wer gerade antwortet.
 * Das ist die Bedingung dafür, den Anbieter später ohne Umbau zu wechseln.
 */
export interface KiAnbieter {
    readonly name: string
    antworten(anfrage: ChatAnfrage): Promise<KiAntwort>
}

/** Spracherkennung und Vorlesen sind getrennt, weil nicht jeder Anbieter beides kann. */
export interface SprachAnbieter {
    readonly name: string
    transkribieren(audio: Buffer, dateiname: string): Promise<string>
    vorlesen?(text: string): Promise<{ daten: Buffer; typ: string }>
}

/** Fehler, den die Oberfläche in Alltagssprache übersetzen kann. */
export class KiFehler extends Error {
    constructor(
        message: string,
        readonly ursache: 'kein-schluessel' | 'anbieter' | 'ungueltige-antwort' | 'nicht-unterstuetzt',
    ) {
        super(message)
        this.name = 'KiFehler'
    }
}
