// Prüft jedes Farbpaar aus src/stile/tokens.css gegen WCAG 2.2.
// Läuft im Build und bricht ab, wenn ein Paar durchfällt — damit kann eine
// Farbänderung die Barrierefreiheit nicht still verschlechtern (GEO-LLM.txt §8).

import { readFileSync } from 'node:fs'

const TOKENS = new URL('../src/stile/tokens.css', import.meta.url)

/** Liest die --color-*-Werte direkt aus der CSS-Datei, damit es nur eine Quelle gibt. */
function farbenLesen() {
    const inhalt = readFileSync(TOKENS, 'utf8')
    const farben = {}
    for (const treffer of inhalt.matchAll(/--color-([\w-]+):\s*(#[0-9A-Fa-f]{6})/g)) {
        farben[treffer[1]] = treffer[2]
    }
    return farben
}

/** Relative Leuchtdichte nach WCAG 2.x. */
function leuchtdichte(hex) {
    const kanaele = [1, 3, 5].map((i) => {
        const anteil = parseInt(hex.slice(i, i + 2), 16) / 255
        return anteil <= 0.04045 ? anteil / 12.92 : ((anteil + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * kanaele[0] + 0.7152 * kanaele[1] + 0.0722 * kanaele[2]
}

function kontrast(vorne, hinten) {
    const a = leuchtdichte(vorne)
    const b = leuchtdichte(hinten)
    const [hell, dunkel] = a > b ? [a, b] : [b, a]
    return (hell + 0.05) / (dunkel + 0.05)
}

// Jede Kombination, die auf der Website tatsächlich vorkommt.
// "gross" = ab 24px oder ab 18.66px fett; dort genügt 3:1 statt 4.5:1.
const PAARE = [
    { was: 'Fließtext auf Seitenhintergrund', vorne: 'text', hinten: 'hintergrund' },
    { was: 'Fließtext auf weißer Fläche', vorne: 'text', hinten: 'flaeche' },
    { was: 'Fließtext auf Akzentfläche', vorne: 'text', hinten: 'akzent' },
    { was: 'Leiser Text auf Seitenhintergrund', vorne: 'text-leise', hinten: 'hintergrund' },
    { was: 'Leiser Text auf weißer Fläche', vorne: 'text-leise', hinten: 'flaeche' },
    { was: 'Linkfarbe auf Seitenhintergrund', vorne: 'primaer-aktiv', hinten: 'hintergrund' },
    { was: 'Linkfarbe auf weißer Fläche', vorne: 'primaer-aktiv', hinten: 'flaeche' },
    { was: 'Weißer Text auf großer Schaltfläche', vorne: 'flaeche', hinten: 'primaer' },
    { was: 'Weißer Text auf gedrückter Schaltfläche', vorne: 'flaeche', hinten: 'primaer-aktiv' },
    { was: 'Warnhinweis', vorne: 'warnung-text', hinten: 'warnung-flaeche' },
    { was: 'Schaltflächenrand gegen Hintergrund', vorne: 'primaer', hinten: 'hintergrund', gross: true },
    { was: 'Trennlinie gegen weiße Fläche', vorne: 'linie', hinten: 'flaeche', gross: true },
]

const farben = farbenLesen()
let fehler = 0

console.log('Kontrastprüfung nach WCAG 2.2\n')

for (const paar of PAARE) {
    const vorne = farben[paar.vorne]
    const hinten = farben[paar.hinten]

    if (!vorne || !hinten) {
        console.error(`  FEHLT   ${paar.was}: Token --color-${paar.vorne} oder --color-${paar.hinten} nicht gefunden`)
        fehler++
        continue
    }

    const wert = kontrast(vorne, hinten)
    const noetig = paar.gross ? 3 : 4.5
    const bestanden = wert >= noetig
    if (!bestanden) fehler++

    const zeile = [
        bestanden ? '  OK     ' : '  FEHLER ',
        paar.was.padEnd(42),
        `${wert.toFixed(2)}:1`.padStart(8),
        `  (nötig ${noetig}:1)`,
    ].join('')
    console.log(zeile)
}

console.log('')

if (fehler > 0) {
    console.error(`${fehler} Farbpaar(e) erfüllen die Anforderung nicht. Bitte die Palette in src/stile/tokens.css anpassen.`)
    process.exit(1)
}

console.log('Alle Farbpaare erfüllen WCAG 2.2 AA.')
