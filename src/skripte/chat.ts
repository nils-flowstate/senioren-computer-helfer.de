/**
 * Die einzige Insel mit Client-JavaScript. Bewusst ohne Framework:
 * Die Zielgruppe nutzt oft alte Geräte mit wenig Arbeitsspeicher und langsamer
 * Verbindung. Was hier nicht steht, muss dort nicht geladen werden.
 */

interface Schaltflaeche {
    beschriftung: string
    wert: string
}

interface KiAntwort {
    antwortText: string
    vorleseText: string
    schaltflaechen: Schaltflaeche[]
    sicherheitshinweis: string | null
    status: 'frage' | 'loesungsschritt' | 'geloest' | 'eskalation'
}

interface Nachricht {
    rolle: 'person' | 'assistent'
    text: string
}

/**
 * Was der Server im Eskalationsablauf zurückgibt (§16). Der Browser kennt
 * weder Telefonnummer noch WhatsApp-Link, bevor der Server sie freigibt — und
 * er entscheidet auch nicht, welcher Schritt als Nächstes kommt.
 */
interface KontaktAngebot {
    text: string
    vorleseText: string
    schaltflaechen: { beschriftung: string; wert: string }[]
    kontakt: { email?: string; telefon?: string; whatsapp?: string }
}

const SPEICHER = 'sch_verlauf'

export function starteChat(): void {
    const formular = document.getElementById('chatformular') as HTMLFormElement | null
    const eingabefeld = document.getElementById('eingabe') as HTMLTextAreaElement | null
    const verlaufListe = document.getElementById('verlauf')
    const wartet = document.getElementById('wartet')
    const schaltflaechenBereich = document.getElementById('schaltflaechen')
    const einfacherKnopf = document.getElementById('einfacher')
    const neubeginnKnopf = document.getElementById('neubeginn')
    const faqOeffner = document.getElementById('faq-oeffner')
    /** Das Feld, das kein Mensch sieht. Ausgefüllt heißt: kein Mensch. */
    const hinweisfeld = document.getElementById('hinweisfeld') as HTMLInputElement | null

    if (!formular || !eingabefeld || !verlaufListe || !wartet || !schaltflaechenBereich) return

    /** Die serverseitig gerenderte Begrüßung. Sie überlebt einen Neubeginn. */
    const begruessung = verlaufListe.querySelector('.begruessung')

    let verlauf: Nachricht[] = ladeVerlauf()
    let laeuft = false
    let letzterStatus: KiAntwort['status'] = 'frage'

    /** Der Kasten, in dem die Antworten zur zuletzt gestellten Frage landen. */
    let offenerAbschnitt: HTMLElement | null = null

    const ruhig = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // Ein wiederhergestelltes Gespräch nach einem versehentlichen Neuladen der
    // Seite. Ohne das wäre alles weg, was schon erklärt wurde.
    if (verlauf.length > 0) {
        for (const eintrag of verlauf) {
            if (eintrag.rolle === 'person') beginneAbschnitt(eintrag.text)
            else zeigeAntwort(eintrag.text)
        }
        setzeAnsicht('gespraech')
    }

    eingabefeld.addEventListener('input', passeHoeheAn)

    formular.addEventListener('submit', (ereignis) => {
        ereignis.preventDefault()
        const text = eingabefeld.value.trim()
        if (!text) {
            eingabefeld.focus()
            return
        }
        void senden(text, {})
    })

    einfacherKnopf?.addEventListener('click', () => {
        void senden('Bitte erklären Sie mir das noch einmal einfacher.', { einfacherErklaeren: true })
    })

    neubeginnKnopf?.addEventListener('click', () => {
        // Rückfrage, weil ein versehentlicher Druck sonst das ganze Gespräch löscht.
        if (!window.confirm('Möchten Sie wirklich von vorne beginnen? Das bisherige Gespräch wird dann gelöscht.')) {
            return
        }
        void neuBeginnen()
    })

    // Im Gespräch stehen die allgemeinen Fragen hinter einer Zeile. Wer sie
    // trotzdem braucht, holt sie mit einem Tipp zurück, ohne das Gespräch zu
    // verlassen.
    faqOeffner?.addEventListener('click', () => {
        const offen = document.body.dataset.faq === 'offen'
        if (offen) delete document.body.dataset.faq
        else document.body.dataset.faq = 'offen'
        faqOeffner.setAttribute('aria-expanded', String(!offen))
        faqOeffner.textContent = offen ? 'Häufige Fragen anzeigen' : 'Häufige Fragen ausblenden'
    })

    // Die Zurück-Taste führt aus dem Gespräch zurück zur Startansicht, statt
    // von der Website weg. Viele Menschen benutzen sie als Abbruchtaste.
    window.addEventListener('popstate', (ereignis) => {
        const zustand = (ereignis.state as { ansicht?: string } | null)?.ansicht
        document.body.dataset.ansicht = zustand === 'gespraech' ? 'gespraech' : 'start'
    })

    /**
     * Startansicht: Überschrift, Chat, FAQ. Gesprächsansicht: nur das Gespräch,
     * die Eingabeleiste bleibt unten stehen. Das Aussehen macht basis.css —
     * hier wird nur das Attribut gesetzt.
     */
    function setzeAnsicht(name: 'start' | 'gespraech'): void {
        if (document.body.dataset.ansicht === name) return
        document.body.dataset.ansicht = name
        if (name === 'gespraech') history.pushState({ ansicht: 'gespraech' }, '')
    }

    async function senden(
        text: string,
        zusatz: { ergebnis?: 'geholfen' | 'nicht-geholfen'; einfacherErklaeren?: boolean },
    ): Promise<void> {
        if (laeuft) return
        laeuft = true

        setzeAnsicht('gespraech')
        schaltflaechenBereich!.replaceChildren()
        beginneAbschnitt(text)
        verlauf.push({ rolle: 'person', text })
        eingabefeld!.value = ''
        passeHoeheAn()
        wartet!.hidden = false

        try {
            const antwort = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    eingabe: text,
                    verlauf: verlauf.slice(0, -1),
                    hinweisfeld: hinweisfeld?.value ?? '',
                    ...zusatz,
                }),
            })

            const daten = (await antwort.json()) as { antwort: KiAntwort }
            verarbeite(daten.antwort)
        } catch {
            // Eine Verbindungsstörung ist kein Systemfehler, den man erklären
            // müsste — sie braucht einen Satz, der sagt, was zu tun ist.
            verarbeite({
                antwortText:
                    'Die Verbindung hat gerade nicht geklappt. Bitte tippen Sie noch einmal auf Senden.',
                vorleseText: 'Die Verbindung hat gerade nicht geklappt. Bitte tippen Sie noch einmal auf Senden.',
                schaltflaechen: [],
                sicherheitshinweis: null,
                status: 'frage',
            })
        } finally {
            wartet!.hidden = true
            laeuft = false
        }
    }

    /** Alles zurück auf Anfang — auch der Fehlversuchszähler auf dem Server. */
    async function neuBeginnen(): Promise<void> {
        verlauf = []
        speichereVerlauf(verlauf)
        offenerAbschnitt = null
        verlaufListe!.replaceChildren(...(begruessung ? [begruessung] : []))
        schaltflaechenBereich!.replaceChildren()
        if (einfacherKnopf) einfacherKnopf.hidden = true
        eingabefeld!.value = ''
        passeHoeheAn()

        document.body.dataset.ansicht = 'start'
        history.replaceState({ ansicht: 'start' }, '')
        eingabefeld!.focus()

        try {
            // Ohne diesen Aufruf liefe das neue Gespräch mit den Fehlversuchen
            // des alten weiter — der Zähler steht im Cookie, nicht im Browser.
            await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ neuBeginnen: true }),
            })
        } catch {
            /* Der Zähler bleibt dann stehen. Das Gespräch beginnt trotzdem neu. */
        }
    }

    function verarbeite(antwort: KiAntwort): void {
        letzterStatus = antwort.status
        zeigeAntwort(antwort.antwortText, antwort.sicherheitshinweis)
        verlauf.push({ rolle: 'assistent', text: antwort.antwortText })
        speichereVerlauf(verlauf)

        if (einfacherKnopf) einfacherKnopf.hidden = false

        const knoepfe: Schaltflaeche[] = [...antwort.schaltflaechen]

        // Nach einem Lösungsschritt wird immer gefragt, ob er geholfen hat.
        // Diese Rückmeldung führt den Eskalationszähler auf dem Server — sie darf
        // nicht davon abhängen, ob das Sprachmodell die passenden Knöpfe liefert.
        if (letzterStatus === 'loesungsschritt') {
            zeigeErgebnisKnoepfe()
            return
        }

        // Nach drei erfolglosen Versuchen führt der Server durch den weiteren
        // Ablauf (§16). Die Schaltflächen des Modells werden hier bewusst
        // verworfen: Am Ende dieses Wegs steht eine Telefonnummer, und darüber
        // entscheidet keine Modellantwort.
        if (letzterStatus === 'eskalation') {
            void eskalation('beginn')
            return
        }

        zeigeSchaltflaechen(knoepfe)
    }

    /** Ein Schritt im Eskalationsablauf. Den Zustand dazu führt der Server. */
    async function eskalation(schritt: string): Promise<void> {
        if (laeuft) return
        laeuft = true

        schaltflaechenBereich!.replaceChildren()
        wartet!.hidden = false

        try {
            const antwort = await fetch('/api/kontakt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ schritt }),
            })
            zeigeAngebot((await antwort.json()) as KontaktAngebot)
        } catch {
            zeigeAntwort('Die Verbindung hat gerade nicht geklappt. Bitte versuchen Sie es noch einmal.')
        } finally {
            wartet!.hidden = true
            laeuft = false
        }
    }

    function zeigeAngebot(angebot: KontaktAngebot): void {
        zeigeAntwort(angebot.text)

        schaltflaechenBereich!.replaceChildren()

        for (const knopf of angebot.schaltflaechen) {
            schaltflaechenBereich!.append(
                baueKnopf(knopf.beschriftung, () => {
                    // Die eigene Antwort bleibt im Verlauf sichtbar. Sie wandert
                    // aber nicht in den Gesprächsverlauf für die KI — der
                    // Wohnort geht das Sprachmodell nichts an (§16).
                    beginneAbschnitt(knopf.beschriftung)
                    void eskalation(knopf.wert)
                }),
            )
        }

        const wege = angebot.kontakt
        if (wege.whatsapp) {
            schaltflaechenBereich!.append(baueLink('Über WhatsApp schreiben', wege.whatsapp))
        }
        if (wege.telefon) {
            schaltflaechenBereich!.append(
                baueLink(`Anrufen: ${wege.telefon}`, `tel:${wege.telefon.replace(/[^+0-9]/g, '')}`),
            )
        }
        if (wege.email) {
            schaltflaechenBereich!.append(baueLink('E-Mail schreiben', `mailto:${wege.email}`))
        }
    }

    /** Ein Kontaktweg sieht aus wie eine Schaltfläche, ist aber ein Link. */
    function baueLink(beschriftung: string, ziel: string): HTMLAnchorElement {
        const link = document.createElement('a')
        link.href = ziel
        link.textContent = beschriftung
        link.className =
            'tippziel flex items-center rounded-xl bg-primaer px-8 text-basis font-bold text-flaeche no-underline hover:bg-primaer-aktiv'
        return link
    }

    function zeigeSchaltflaechen(knoepfe: Schaltflaeche[]): void {
        schaltflaechenBereich!.replaceChildren()
        for (const knopf of knoepfe.slice(0, 4)) {
            schaltflaechenBereich!.append(baueKnopf(knopf.beschriftung, () => void senden(knopf.wert, {})))
        }
    }

    function zeigeErgebnisKnoepfe(): void {
        schaltflaechenBereich!.replaceChildren()
        schaltflaechenBereich!.append(
            baueKnopf('Das hat geklappt', () =>
                void senden('Das hat geklappt.', { ergebnis: 'geholfen' }),
            ),
            baueKnopf('Das hat nicht geholfen', () =>
                void senden('Das hat leider nicht geholfen.', { ergebnis: 'nicht-geholfen' }),
            ),
            baueKnopf('Ich weiß es nicht', () => void senden('Ich weiß es nicht.', {})),
        )
    }

    function baueKnopf(beschriftung: string, bei_klick: () => void): HTMLButtonElement {
        const knopf = document.createElement('button')
        knopf.type = 'button'
        knopf.textContent = beschriftung
        knopf.className =
            'tippziel rounded-xl border-2 border-primaer bg-flaeche px-6 text-basis font-bold text-primaer-aktiv hover:bg-akzent'
        knopf.addEventListener('click', bei_klick)
        return knopf
    }

    /**
     * Beginnt ein neues Frage-Antwort-Paar.
     *
     * Das vorherige Paar klappt dabei zu. Im laufenden Gespräch zählt die
     * neueste Antwort; alles davor bleibt über die eigene Frage auffindbar und
     * ist mit einem Tipp wieder da.
     */
    function beginneAbschnitt(frage: string): void {
        for (const offen of verlaufListe!.querySelectorAll<HTMLDetailsElement>('details[open]')) {
            offen.open = false
        }

        const eintrag = document.createElement('li')
        eintrag.className = 'paar'

        const klapp = document.createElement('details')
        klapp.open = true
        klapp.className = 'rounded-xl border-2 border-linie bg-flaeche'

        const zeile = document.createElement('summary')
        zeile.className = 'tippziel flex flex-col justify-center gap-1 px-4 py-3'

        const fragetext = document.createElement('span')
        fragetext.className = 'font-bold'
        fragetext.textContent = `Sie: ${frage}`
        zeile.append(fragetext)

        // Für Vorlesegeräte überflüssig: Sie sagen von sich aus, ob ein
        // Bereich ein- oder ausgeblendet ist.
        const hinweis = document.createElement('span')
        hinweis.className = 'klapp-hinweis'
        hinweis.setAttribute('aria-hidden', 'true')
        hinweis.textContent = 'Hier klicken für die Antwort'
        zeile.append(hinweis)

        const koerper = document.createElement('div')
        koerper.className = 'flex flex-col gap-4 border-t-2 border-linie p-4'

        klapp.append(zeile, koerper)
        eintrag.append(klapp)
        verlaufListe!.append(eintrag)

        offenerAbschnitt = koerper
        scrolleZumPaar(eintrag)
    }

    function zeigeAntwort(text: string, sicherheitshinweis?: string | null): void {
        const ziel = offenerAbschnitt ?? neuerEinzelabschnitt()

        if (sicherheitshinweis) {
            const hinweis = document.createElement('p')
            hinweis.className = 'lesebreite rounded-xl bg-warnung-flaeche p-4 font-bold text-warnung-text'
            hinweis.textContent = sicherheitshinweis
            ziel.append(hinweis)
        }

        // textContent statt innerHTML: Modellantworten werden nie als Markup
        // ausgewertet. Absätze entstehen durch Aufteilen an Leerzeilen.
        for (const absatz of text.split(/\n{2,}/)) {
            const p = document.createElement('p')
            p.className = 'lesebreite rounded-xl bg-akzent p-4'
            p.textContent = absatz
            ziel.append(p)
        }

        const paar = ziel.closest('.paar')
        if (paar) scrolleZumPaar(paar as HTMLElement)
    }

    /** Für Antworten ohne vorangegangene Frage — etwa eine Verbindungsstörung. */
    function neuerEinzelabschnitt(): HTMLElement {
        const eintrag = document.createElement('li')
        eintrag.className = 'paar flex flex-col gap-4'
        verlaufListe!.append(eintrag)
        offenerAbschnitt = eintrag
        return eintrag
    }

    /**
     * Zum Anfang der neuen Antwort, nicht zu ihrem Ende. Gelesen wird von oben,
     * und wer die erste Zeile sucht, hat schon verloren.
     */
    function scrolleZumPaar(paar: HTMLElement): void {
        paar.scrollIntoView({ block: 'start', behavior: ruhig ? 'auto' : 'smooth' })
    }

    /** Das Eingabefeld beginnt einzeilig und wächst mit dem Text. */
    function passeHoeheAn(): void {
        const feld = eingabefeld!
        feld.style.height = 'auto'
        const zeilenhoehe = parseFloat(getComputedStyle(document.documentElement).fontSize) || 20
        feld.style.height = `${Math.min(feld.scrollHeight, zeilenhoehe * 12)}px`
    }

    function ladeVerlauf(): Nachricht[] {
        try {
            const roh = window.sessionStorage.getItem(SPEICHER)
            return roh ? (JSON.parse(roh) as Nachricht[]) : []
        } catch {
            // Privates Fenster oder blockierter Speicher — der Chat funktioniert
            // trotzdem, nur ohne Wiederherstellung nach dem Neuladen.
            return []
        }
    }

    function speichereVerlauf(eintraege: Nachricht[]): void {
        try {
            // sessionStorage statt localStorage: Der Verlauf endet mit dem
            // Schließen des Fensters (GEO-LLM.txt §10).
            window.sessionStorage.setItem(SPEICHER, JSON.stringify(eintraege.slice(-40)))
        } catch {
            /* Speichern ist eine Bequemlichkeit, kein Muss. */
        }
    }
}
