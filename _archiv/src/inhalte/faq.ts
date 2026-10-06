/**
 * Eine Quelle für sichtbare FAQ und für die strukturierten Daten.
 *
 * Der GEO-Skill verlangt, dass FAQPage-Markup und sichtbarer Text
 * übereinstimmen. Zwei getrennte Listen laufen früher oder später auseinander,
 * deshalb gibt es hier nur eine.
 */

export interface FaqEintrag {
    frage: string
    antwort: string
    /** Weiterführende Seite, falls die kurze Antwort nicht reicht. */
    weiterlesen?: { text: string; ziel: string }
}

export const ALLGEMEINE_FAQ: FaqEintrag[] = [
    {
        frage: 'Was kostet die Hilfe?',
        antwort: 'Die Hilfe im Chat ist kostenlos. Sie müssen sich nicht anmelden und nichts angeben.',
    },
    {
        frage: 'Wie benutze ich den Chat?',
        antwort: 'Schreiben Sie in das große Feld, womit Sie Schwierigkeiten haben — in Ihren eigenen Worten. Ein Satz genügt. Danach stelle ich Ihnen ein paar kurze Fragen und wir gehen Schritt für Schritt vor.',
        weiterlesen: { text: 'So funktioniert die Hilfe', ziel: '/so-funktioniert-die-hilfe' },
    },
    {
        frage: 'Werden meine Gespräche gespeichert?',
        antwort: 'Wir speichern Ihr Gespräch nicht dauerhaft. Zur Beantwortung wird Ihre Eingabe an unseren KI-Dienst übermittelt. Bitte geben Sie keine Passwörter, PINs oder TANs ein.',
        weiterlesen: { text: 'Mehr zum Datenschutz', ziel: '/datenschutz' },
    },
    {
        frage: 'Spricht hier ein Mensch mit mir?',
        antwort: 'Nein. Die Antworten kommen von einem Computerprogramm. Wenn es Ihnen nicht weiterhelfen kann, bieten wir Ihnen den Kontakt zu einem Menschen an.',
    },
    {
        frage: 'Kann ich statt tippen auch sprechen?',
        antwort: 'Ja, das ist vorgesehen. Sie können Ihre Frage sprechen und sich die Antwort vorlesen lassen. Sie können außerdem ein Foto von Ihrem Bildschirm schicken, wenn Sie etwas nicht beschreiben können.',
    },
    {
        frage: 'Ich habe eine merkwürdige Nachricht bekommen. Ist das Betrug?',
        antwort: 'Schreiben Sie mir einfach, was in der Nachricht steht. Ich sage Ihnen, worauf Sie achten sollten. Wichtig vorweg: Ihre Bank fragt Sie niemals nach PIN oder TAN, und echte Firmen rufen Sie nicht unaufgefordert wegen eines Virus an.',
    },
    {
        frage: 'Was tue ich, wenn ich schon auf einen Betrug hereingefallen bin?',
        antwort: 'Rufen Sie sofort den Sperr-Notruf 116 116 an, wenn es um Karten oder Konten geht. Bei einer Straftat ist die Polizei unter 110 erreichbar.',
    },
    {
        frage: 'An wen kann ich mich wenden, wenn der Chat nicht weiterhilft?',
        antwort: 'Wenn wir es nach mehreren Versuchen nicht gemeinsam lösen können, biete ich Ihnen von selbst an, sich an einen Menschen zu wenden.',
    },
]

/** Strukturierte Daten aus derselben Liste — ohne Zusätze, die nicht sichtbar sind. */
export function faqStrukturiert(eintraege: FaqEintrag[]) {
    return {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: eintraege.map((eintrag) => ({
            '@type': 'Question',
            name: eintrag.frage,
            acceptedAnswer: { '@type': 'Answer', text: eintrag.antwort },
        })),
    }
}
