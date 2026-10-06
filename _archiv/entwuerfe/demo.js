/* ---------------------------------------------------------------------------
 * Gemeinsamer Demo-Ablauf für alle sechs Entwürfe.
 *
 * Die Entwürfe sollen sich im Aussehen unterscheiden, nicht im Inhalt. Deshalb
 * steht der Gesprächsverlauf hier einmal und wird von jedem Entwurf über
 * einen kleinen Adapter eingehängt. Was jeder Entwurf selbst macht, ist nur:
 * wie eine Nachricht, ein Wartezustand und eine Antwortmöglichkeit aussehen.
 *
 * Das ist eine Vorlage zum Ansehen und Antippen — keine Anbindung an die KI.
 * ------------------------------------------------------------------------ */

/* Zwei Sätze statt eines. Der erste bestätigt sofort, dass die Nachricht
   angekommen ist; der zweite sagt, dass gerade etwas für Sie getan wird.
   Ein Wartezustand, der nur „Bitte warten“ sagt, erklärt nichts. */
const WARTETEXTE = [
    'Danke für Ihre Nachricht. Ich schaue mir das an.',
    'Ich mache mich kurz schlau für Sie …',
]

/* Die Einleitungszeile über den Antwortmöglichkeiten. Sie ist nicht Zierde:
   Ohne sie ist für einen ungeübten Menschen nicht sicher erkennbar, dass die
   grünen Flächen angetippt werden dürfen. */
const EINLEITUNG_ANTWORT = 'Tippen Sie auf Ihre Antwort:'
const EINLEITUNG_START = 'Tippen Sie auf ein Beispiel:'

const START_KNOEPFE = [
    { beschriftung: 'Mein Drucker druckt nicht mehr.', ziel: 'drucker1' },
    { beschriftung: 'Ich habe eine merkwürdige Nachricht bekommen.', ziel: 'betrug1' },
]

const SCHRITTE = {
    drucker1: {
        text: 'Das bekommen wir gemeinsam hin.\n\nZuerst eine kurze Frage: Leuchtet oder blinkt am Drucker ein Lämpchen?',
        knoepfe: [
            { beschriftung: 'Ja, es leuchtet', ziel: 'drucker2' },
            { beschriftung: 'Ja, es blinkt', ziel: 'drucker2' },
            { beschriftung: 'Nein, nichts leuchtet', ziel: 'drucker2' },
            { beschriftung: 'Ich weiß es nicht', ziel: 'drucker2' },
        ],
    },
    drucker2: {
        text: 'Danke. Wir machen einen kleinen Schritt.\n\nZiehen Sie den Stecker des Druckers aus der Steckdose. Zählen Sie langsam bis zehn. Stecken Sie ihn wieder ein.\n\nIch warte hier auf Sie.',
        knoepfe: [
            { beschriftung: 'Das hat geklappt', ziel: 'drucker3' },
            { beschriftung: 'Das hat nicht geholfen', ziel: 'drucker4' },
            { beschriftung: 'Ich weiß es nicht', ziel: 'drucker4' },
        ],
    },
    drucker3: {
        text: 'Schön. Dann ist der Drucker wieder in Ordnung.\n\nWenn noch etwas ist, schreiben Sie mir einfach.',
        knoepfe: [],
    },
    drucker4: {
        text: 'Kein Problem, wir probieren etwas anderes.\n\nIst der Drucker mit einem Kabel am Computer angeschlossen?',
        knoepfe: [
            { beschriftung: 'Ja, mit einem Kabel', ziel: 'drucker2' },
            { beschriftung: 'Nein, ohne Kabel', ziel: 'drucker2' },
            { beschriftung: 'Ich weiß es nicht', ziel: 'drucker2' },
        ],
    },

    betrug1: {
        hinweis: 'Geben Sie niemandem Ihre PIN oder TAN. Auch nicht am Telefon.',
        text: 'Gut, dass Sie fragen. Das schauen wir uns zusammen an.\n\nVon wem soll die Nachricht sein?',
        knoepfe: [
            { beschriftung: 'Von meiner Bank', ziel: 'betrug2' },
            { beschriftung: 'Von einem Paketdienst', ziel: 'betrug2' },
            { beschriftung: 'Das steht nicht dabei', ziel: 'betrug2' },
        ],
    },
    betrug2: {
        hinweis: 'Antworten Sie nicht auf die Nachricht. Tippen Sie keinen Link darin an.',
        text: 'Solche Nachrichten sehen echt aus, sind es aber oft nicht.\n\nIhre Bank fragt Sie nie nach PIN oder TAN. Löschen Sie die Nachricht am besten.\n\nWenn Sie unsicher sind: Rufen Sie Ihre Bank unter der Nummer an, die auf Ihrer Bankkarte steht.',
        knoepfe: [
            { beschriftung: 'Danke, das mache ich', ziel: 'betrug4' },
            { beschriftung: 'Ich habe den Link schon angetippt', ziel: 'betrug3' },
        ],
    },
    betrug3: {
        hinweis: 'Rufen Sie jetzt den Sperr-Notruf an: 116 116.',
        text: 'Bleiben Sie ruhig, das lässt sich meistens noch abfangen.\n\nDer Sperr-Notruf sperrt Ihre Karten. Er ist rund um die Uhr erreichbar und kostet nichts.',
        knoepfe: [{ beschriftung: 'Ich habe angerufen', ziel: 'betrug4' }],
    },
    betrug4: {
        text: 'Sehr gut. Sie haben alles richtig gemacht.\n\nWenn wieder so eine Nachricht kommt, fragen Sie mich einfach noch einmal.',
        knoepfe: [],
    },
}

/* Vorschau-Haken für Bildschirmfotos.
 *
 * Ein Wartezustand dauert zweieinhalb Sekunden — ein Bildschirmfoto trifft ihn
 * nie. Mit „#warten“ am Ende der Adresse hält der Entwurf genau dort an, mit
 * „#antwort“ springt er auf eine fertige Antwort samt Sicherheitshinweis.
 *
 * Das dient allein dem Prüfen der Entwürfe. In der Anwendung gibt es das nicht.
 */
const VORSCHAU = window.location.hash.replace('#', '')

function starteDemo(entwurf) {
    let laeuft = false

    /* Der Schriftgrößen-Knopf im Kopf — drei Stufen im Kreis, wie auf der
       echten Seite. Hier ohne Cookie, es ist nur eine Vorlage. */
    const stufen = ['1', '1.15', '1.3']
    let stufe = 0
    entwurf.aKnopf?.addEventListener('click', () => {
        stufe = (stufe + 1) % stufen.length
        document.documentElement.style.setProperty('--schrift-faktor', stufen[stufe])
        entwurf.aKnopf.setAttribute(
            'aria-label',
            'Schriftgröße: Stufe ' + (stufe + 1) + ' von 3. Zum Wechseln tippen.',
        )
    })

    entwurf.formular?.addEventListener('submit', (ereignis) => {
        ereignis.preventDefault()
        const text = entwurf.eingabe.value.trim()
        if (!text) {
            entwurf.eingabe.focus()
            return
        }
        entwurf.eingabe.value = ''
        passeHoeheAn()
        void senden(text, 'drucker1')
    })

    entwurf.eingabe?.addEventListener('input', passeHoeheAn)

    zeigeKnoepfe(START_KNOEPFE, EINLEITUNG_START)

    if (VORSCHAU === 'warten' || VORSCHAU === 'antwort') {
        void senden('Ich habe eine merkwürdige Nachricht bekommen.', 'betrug1')
    }

    async function senden(text, ziel) {
        if (laeuft) return
        laeuft = true

        entwurf.knoepfe.replaceChildren()
        nachOben(entwurf.zeigeIhre(text))

        /* Der Wartezustand hat zwei Stufen. Die erste kommt sofort — sie ist
           die Empfangsbestätigung. Die zweite kommt nach kurzer Zeit und sagt,
           dass nachgesehen wird. */
        entwurf.warteAn(WARTETEXTE[0])
        await pause(VORSCHAU ? 0 : 1000)
        entwurf.warteText(WARTETEXTE[1])
        if (VORSCHAU === 'warten') return /* hält an, damit die Aufnahme ihn trifft */
        await pause(VORSCHAU ? 0 : 1600)
        entwurf.warteAus()

        const schritt = SCHRITTE[ziel] ?? SCHRITTE.drucker1
        const antwort = entwurf.zeigeSeine(schritt.text, schritt.hinweis ?? null)
        zeigeKnoepfe(schritt.knoepfe, EINLEITUNG_ANTWORT)
        nachOben(antwort)

        laeuft = false
    }

    /* --------------------------------------------------------------------
     * Antwortmöglichkeiten
     *
     * Immer mit einer Zeile darüber, die sagt, was zu tun ist, und immer
     * untereinander über die volle Breite. Nebeneinander umbrechende Knöpfe
     * ergeben ein unruhiges Bild und lassen offen, was zusammengehört.
     * ------------------------------------------------------------------ */
    function zeigeKnoepfe(liste, einleitung) {
        entwurf.knoepfe.replaceChildren()
        if (!liste || liste.length === 0) return

        const zeile = document.createElement('p')
        zeile.className = 'knopf-einleitung'
        zeile.id = 'knopf-einleitung'
        zeile.textContent = einleitung
        entwurf.knoepfe.append(zeile)

        const gruppe = document.createElement('div')
        gruppe.className = 'knopf-liste'
        gruppe.setAttribute('role', 'group')
        gruppe.setAttribute('aria-labelledby', 'knopf-einleitung')

        for (const eintrag of liste) {
            const knopf = document.createElement('button')
            knopf.type = 'button'
            knopf.className = 'wahl'
            knopf.textContent = eintrag.beschriftung
            knopf.addEventListener('click', () => void senden(eintrag.beschriftung, eintrag.ziel))
            gruppe.append(knopf)
        }

        entwurf.knoepfe.append(gruppe)
    }

    /* Zum Anfang der neuen Antwort, nicht zu ihrem Ende. Gelesen wird oben. */
    function nachOben(element) {
        if (!element) return
        const ruhig = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        /* In der Vorschau gar nicht scrollen: Die Aufnahme soll den Seitenanfang
           zeigen, und ein verschobener Bildausschnitt gibt bei festgehefteten
           Leisten ein falsches Bild. */
        if (VORSCHAU) return
        element.scrollIntoView({ block: 'start', behavior: ruhig ? 'auto' : 'smooth' })
    }

    function passeHoeheAn() {
        const feld = entwurf.eingabe
        if (!feld) return
        feld.style.height = 'auto'
        feld.style.height = Math.min(feld.scrollHeight, 260) + 'px'
    }
}

function pause(millisekunden) {
    return new Promise((fertig) => window.setTimeout(fertig, millisekunden))
}
