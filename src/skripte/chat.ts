/**
 * Die einzige Insel mit Client-JavaScript. Bewusst ohne Framework:
 * Die Zielgruppe nutzt oft alte Geräte mit wenig Arbeitsspeicher und langsamer
 * Verbindung. Was hier nicht steht, muss dort nicht geladen werden.
 *
 * Das Aussehen macht ausschließlich src/stile/basis.css. Hier werden nur
 * Klassen vergeben und Attribute gesetzt — der Fragenbereich am Eingabefeld
 * kommt ganz ohne dieses Skript aus.
 */

import {
    EINLEITUNG_ANTWORT,
    EINLEITUNG_BEISPIELE,
    BEISPIELE,
    WARTETEXTE,
    WARTETEXT_WECHSEL,
} from '../inhalte/texte'

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
    const wartetSatz = document.getElementById('wartet-satz')
    const schaltflaechenBereich = document.getElementById('schaltflaechen')
    const einfacherKnopf = document.getElementById('einfacher') as HTMLButtonElement | null
    const neubeginnKnopf = document.getElementById('neubeginn')
    /** Das Feld, das kein Mensch sieht. Ausgefüllt heißt: kein Mensch. */
    const hinweisfeld = document.getElementById('hinweisfeld') as HTMLInputElement | null

    if (!formular || !eingabefeld || !verlaufListe || !wartet || !wartetSatz || !schaltflaechenBereich) {
        return
    }

    /** Die serverseitig gerenderte Begrüßung. Sie überlebt einen Neubeginn. */
    const begruessung = verlaufListe.querySelector('.begruessung')

    let verlauf: Nachricht[] = ladeVerlauf()
    let laeuft = false
    let letzterStatus: KiAntwort['status'] = 'frage'
    /** Der Wechsel auf die zweite Stufe des Wartetextes. */
    let warteWechsel: number | undefined

    const ruhig = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // Ein wiederhergestelltes Gespräch nach einem versehentlichen Neuladen der
    // Seite. Ohne das wäre alles weg, was schon erklärt wurde.
    if (verlauf.length > 0) {
        for (const eintrag of verlauf) {
            if (eintrag.rolle === 'person') zeigeIhre(eintrag.text)
            else zeigeAntwort(eintrag.text)
        }
        setzeAnsicht('gespraech')
        if (einfacherKnopf) einfacherKnopf.hidden = false
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

    // Die Beispiele in der Startansicht stehen fertig im HTML. Ein Zuhörer am
    // Bereich statt an jedem Knopf: Dann gilt er auch für die Beispiele, die
    // nach einem Neubeginn neu entstehen.
    schaltflaechenBereich.addEventListener('click', (ereignis) => {
        const ziel = ereignis.target as HTMLElement | null
        const knopf = ziel?.closest<HTMLButtonElement>('[data-wert]')
        if (knopf?.dataset.wert) void senden(knopf.dataset.wert, {})
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

    // Die Zurück-Taste führt aus dem Gespräch zurück zur Startansicht, statt
    // von der Website weg. Viele Menschen benutzen sie als Abbruchtaste.
    window.addEventListener('popstate', (ereignis) => {
        const zustand = (ereignis.state as { ansicht?: string } | null)?.ansicht
        document.body.dataset.ansicht = zustand === 'gespraech' ? 'gespraech' : 'start'
    })

    /**
     * Startansicht: Überschrift, Chat, Beispiele. Gesprächsansicht: die
     * Überschrift tritt zurück, damit auf dem Handy mehr vom Gespräch zu sehen
     * ist. Das Aussehen macht basis.css — hier wird nur das Attribut gesetzt.
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
        nachOben(zeigeIhre(text))
        verlauf.push({ rolle: 'person', text })
        eingabefeld!.value = ''
        passeHoeheAn()
        warteAn()

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
            warteAus()
            verarbeite(daten.antwort)
        } catch {
            // Eine Verbindungsstörung ist kein Systemfehler, den man erklären
            // müsste — sie braucht einen Satz, der sagt, was zu tun ist.
            warteAus()
            verarbeite({
                antwortText:
                    'Die Verbindung hat gerade nicht geklappt. Bitte tippen Sie noch einmal auf Senden.',
                vorleseText: 'Die Verbindung hat gerade nicht geklappt. Bitte tippen Sie noch einmal auf Senden.',
                schaltflaechen: [],
                sicherheitshinweis: null,
                status: 'frage',
            })
        } finally {
            warteAus()
            laeuft = false
        }
    }

    /** Alles zurück auf Anfang — auch der Fehlversuchszähler auf dem Server. */
    async function neuBeginnen(): Promise<void> {
        verlauf = []
        speichereVerlauf(verlauf)
        verlaufListe!.replaceChildren(...(begruessung ? [begruessung] : []), wartet!)
        wartet!.hidden = true
        zeigeBeispiele()
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
        nachOben(zeigeAntwort(antwort.antwortText, antwort.sicherheitshinweis))
        verlauf.push({ rolle: 'assistent', text: antwort.antwortText })
        speichereVerlauf(verlauf)

        if (einfacherKnopf) einfacherKnopf.hidden = false

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

        zeigeSchaltflaechen(antwort.schaltflaechen)
    }

    /** Ein Schritt im Eskalationsablauf. Den Zustand dazu führt der Server. */
    async function eskalation(schritt: string): Promise<void> {
        if (laeuft) return
        laeuft = true

        schaltflaechenBereich!.replaceChildren()
        warteAn()

        try {
            const antwort = await fetch('/api/kontakt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ schritt }),
            })
            warteAus()
            zeigeAngebot((await antwort.json()) as KontaktAngebot)
        } catch {
            warteAus()
            nachOben(zeigeAntwort('Die Verbindung hat gerade nicht geklappt. Bitte versuchen Sie es noch einmal.'))
        } finally {
            warteAus()
            laeuft = false
        }
    }

    function zeigeAngebot(angebot: KontaktAngebot): void {
        nachOben(zeigeAntwort(angebot.text))

        const gruppe = baueGruppe(EINLEITUNG_ANTWORT)

        for (const knopf of angebot.schaltflaechen) {
            gruppe.append(
                baueKnopf(knopf.beschriftung, () => {
                    // Die eigene Antwort bleibt im Verlauf sichtbar. Sie wandert
                    // aber nicht in den Gesprächsverlauf für die KI — der
                    // Wohnort geht das Sprachmodell nichts an (§16).
                    nachOben(zeigeIhre(knopf.beschriftung))
                    void eskalation(knopf.wert)
                }),
            )
        }

        const wege = angebot.kontakt
        if (wege.whatsapp) gruppe.append(baueLink('Über WhatsApp schreiben', wege.whatsapp))
        if (wege.telefon) {
            gruppe.append(baueLink(`Anrufen: ${wege.telefon}`, `tel:${wege.telefon.replace(/[^+0-9]/g, '')}`))
        }
        if (wege.email) gruppe.append(baueLink('E-Mail schreiben', `mailto:${wege.email}`))
    }

    /* --------------------------------------------------------------------
     * Wartezustand
     *
     * Das Element steht fertig im HTML und wird nur ans Ende geschoben, mit
     * Text gefüllt und eingeblendet. Zwei Stufen: Die erste bestätigt den
     * Empfang, die zweite sagt, dass nachgesehen wird.
     * ------------------------------------------------------------------ */
    function warteAn(): void {
        window.clearTimeout(warteWechsel)
        wartetSatz!.textContent = WARTETEXTE[0]
        // Ans Ende, damit er immer unter der zuletzt gestellten Frage steht.
        verlaufListe!.append(wartet!)
        wartet!.hidden = false
        // Mittig statt an den unteren Rand: Am unteren Rand steht die
        // Eingabeleiste, und der Wartezustand verschwände zur Hälfte dahinter.
        wartet!.scrollIntoView({ block: 'center', behavior: ruhig ? 'auto' : 'smooth' })

        warteWechsel = window.setTimeout(() => {
            wartetSatz!.textContent = WARTETEXTE[1]
        }, WARTETEXT_WECHSEL)
    }

    function warteAus(): void {
        window.clearTimeout(warteWechsel)
        wartet!.hidden = true
    }

    /* --------------------------------------------------------------------
     * Antwortmöglichkeiten
     * ------------------------------------------------------------------ */

    /** Einleitungszeile und Gruppe. Ohne die Zeile ist nicht erkennbar, dass
     *  die grünen Flächen angetippt werden dürfen. */
    function baueGruppe(einleitung: string): HTMLDivElement {
        schaltflaechenBereich!.replaceChildren()

        const zeile = document.createElement('p')
        zeile.className = 'wahl-einleitung'
        zeile.id = 'wahl-einleitung'
        zeile.textContent = einleitung

        const gruppe = document.createElement('div')
        gruppe.className = 'wahl-liste'
        gruppe.setAttribute('role', 'group')
        gruppe.setAttribute('aria-labelledby', 'wahl-einleitung')

        schaltflaechenBereich!.append(zeile, gruppe)
        return gruppe
    }

    function zeigeBeispiele(): void {
        const gruppe = baueGruppe(EINLEITUNG_BEISPIELE)
        for (const beispiel of BEISPIELE) {
            const knopf = baueKnopf(beispiel)
            knopf.dataset.wert = beispiel
            gruppe.append(knopf)
        }
    }

    function zeigeSchaltflaechen(knoepfe: Schaltflaeche[]): void {
        schaltflaechenBereich!.replaceChildren()
        if (knoepfe.length === 0) return

        const gruppe = baueGruppe(EINLEITUNG_ANTWORT)
        for (const knopf of knoepfe.slice(0, 4)) {
            gruppe.append(baueKnopf(knopf.beschriftung, () => void senden(knopf.wert, {})))
        }
    }

    function zeigeErgebnisKnoepfe(): void {
        const gruppe = baueGruppe(EINLEITUNG_ANTWORT)
        gruppe.append(
            baueKnopf('Das hat geklappt', () => void senden('Das hat geklappt.', { ergebnis: 'geholfen' })),
            baueKnopf('Das hat nicht geholfen', () =>
                void senden('Das hat leider nicht geholfen.', { ergebnis: 'nicht-geholfen' }),
            ),
            baueKnopf('Ich weiß es nicht', () => void senden('Ich weiß es nicht.', {})),
        )
    }

    function baueKnopf(beschriftung: string, bei_klick?: () => void): HTMLButtonElement {
        const knopf = document.createElement('button')
        knopf.type = 'button'
        knopf.className = 'wahl'
        knopf.textContent = beschriftung
        if (bei_klick) knopf.addEventListener('click', bei_klick)
        return knopf
    }

    /** Ein Kontaktweg sieht aus wie eine Antwort, ist aber ein Link. */
    function baueLink(beschriftung: string, ziel: string): HTMLAnchorElement {
        const link = document.createElement('a')
        link.href = ziel
        link.className = 'wahl'
        link.textContent = beschriftung
        return link
    }

    /* --------------------------------------------------------------------
     * Nachrichten
     *
     * Zwei Formen, mehr nicht: seine Nachricht mit Bild links, Ihre rechts.
     * textContent statt innerHTML — Modellantworten werden nie als Markup
     * ausgewertet. Absätze entstehen durch Aufteilen an Leerzeilen.
     * ------------------------------------------------------------------ */

    function zeigeIhre(text: string): HTMLLIElement {
        const eintrag = document.createElement('li')
        eintrag.className = 'von-ihnen'

        const blase = document.createElement('div')
        blase.className = 'blase'
        blase.append(absatz(text))

        eintrag.append(blase)
        verlaufListe!.append(eintrag)
        return eintrag
    }

    function zeigeAntwort(text: string, sicherheitshinweis?: string | null): HTMLLIElement {
        const eintrag = document.createElement('li')
        eintrag.className = 'von-ihm'
        eintrag.append(helferBild())

        const spalte = document.createElement('div')

        if (sicherheitshinweis) {
            const hinweis = document.createElement('p')
            hinweis.className = 'sicherheitshinweis'
            hinweis.textContent = sicherheitshinweis
            spalte.append(hinweis)
        }

        const blase = document.createElement('div')
        blase.className = 'blase'
        for (const teil of text.split(/\n{2,}/)) blase.append(absatz(teil))

        spalte.append(blase)
        eintrag.append(spalte)
        verlaufListe!.append(eintrag)
        return eintrag
    }

    /** Dieselbe Datei wie im gerenderten HTML — der Browser hat sie schon. */
    function helferBild(): HTMLImageElement {
        const bild = document.createElement('img')
        bild.src = '/images/nils-technik-helfer-rund.webp'
        bild.alt = ''
        bild.width = 320
        bild.height = 320
        return bild
    }

    function absatz(text: string): HTMLParagraphElement {
        const p = document.createElement('p')
        p.textContent = text
        return p
    }

    /**
     * Zum Anfang der neuen Nachricht, nicht zu ihrem Ende. Gelesen wird von
     * oben, und wer die erste Zeile sucht, hat schon verloren.
     */
    function nachOben(eintrag: HTMLElement): void {
        eintrag.scrollIntoView({ block: 'start', behavior: ruhig ? 'auto' : 'smooth' })
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
