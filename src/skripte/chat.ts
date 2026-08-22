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

    if (!formular || !eingabefeld || !verlaufListe || !wartet || !schaltflaechenBereich) return

    let verlauf: Nachricht[] = ladeVerlauf()
    let laeuft = false
    let letzterStatus: KiAntwort['status'] = 'frage'

    // Ein wiederhergestelltes Gespräch nach einem versehentlichen Neuladen der
    // Seite. Ohne das wäre alles weg, was schon erklärt wurde.
    if (verlauf.length > 0) {
        for (const eintrag of verlauf) {
            zeigeNachricht(eintrag.rolle, eintrag.text)
        }
    }

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
        verlauf = []
        speichereVerlauf(verlauf)
        void senden('Ich möchte von vorne beginnen.', { neuBeginnen: true })
        verlaufListe.replaceChildren()
    })

    async function senden(
        text: string,
        zusatz: { ergebnis?: 'geholfen' | 'nicht-geholfen'; einfacherErklaeren?: boolean; neuBeginnen?: boolean },
    ): Promise<void> {
        if (laeuft) return
        laeuft = true

        schaltflaechenBereich!.replaceChildren()
        zeigeNachricht('person', text)
        verlauf.push({ rolle: 'person', text })
        eingabefeld!.value = ''
        wartet!.hidden = false

        try {
            const antwort = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ eingabe: text, verlauf: verlauf.slice(0, -1), ...zusatz }),
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

    function verarbeite(antwort: KiAntwort): void {
        letzterStatus = antwort.status
        zeigeNachricht('assistent', antwort.antwortText, antwort.sicherheitshinweis)
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
            zeigeNachricht(
                'assistent',
                'Die Verbindung hat gerade nicht geklappt. Bitte versuchen Sie es noch einmal.',
            )
        } finally {
            wartet!.hidden = true
            laeuft = false
        }
    }

    function zeigeAngebot(angebot: KontaktAngebot): void {
        zeigeNachricht('assistent', angebot.text)

        schaltflaechenBereich!.replaceChildren()

        for (const knopf of angebot.schaltflaechen) {
            schaltflaechenBereich!.append(
                baueKnopf(knopf.beschriftung, () => {
                    // Die eigene Antwort bleibt im Verlauf sichtbar. Sie wandert
                    // aber nicht in den Gesprächsverlauf für die KI — der
                    // Wohnort geht das Sprachmodell nichts an (§16).
                    zeigeNachricht('person', knopf.beschriftung)
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

    function zeigeNachricht(rolle: Nachricht['rolle'], text: string, sicherheitshinweis?: string | null): void {
        const eintrag = document.createElement('li')

        const absender = document.createElement('p')
        absender.className = 'mb-1 font-bold text-text-leise'
        absender.textContent = rolle === 'person' ? 'Sie' : 'Der Helfer'
        eintrag.append(absender)

        if (sicherheitshinweis) {
            const hinweis = document.createElement('p')
            hinweis.className = 'lesebreite mb-3 rounded-xl bg-warnung-flaeche p-4 font-bold text-warnung-text'
            hinweis.textContent = sicherheitshinweis
            eintrag.append(hinweis)
        }

        // textContent statt innerHTML: Modellantworten werden nie als Markup
        // ausgewertet. Absätze entstehen durch Aufteilen an Leerzeilen.
        for (const absatz of text.split(/\n{2,}/)) {
            const p = document.createElement('p')
            p.className =
                rolle === 'person'
                    ? 'lesebreite rounded-xl border-2 border-linie p-4'
                    : 'lesebreite rounded-xl bg-akzent p-4'
            p.textContent = absatz
            eintrag.append(p)
        }

        verlaufListe!.append(eintrag)
        eintrag.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
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
