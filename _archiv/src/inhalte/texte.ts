/**
 * Texte, die an mehr als einer Stelle gebraucht werden.
 *
 * Die Begrüßung steht im gerenderten HTML und wird nach einem Neubeginn erneut
 * gebraucht. Zwei Fassungen desselben Satzes laufen früher oder später
 * auseinander, deshalb steht sie nur hier.
 */

export const BEGRUESSUNG = 'Guten Tag. Womit haben Sie Schwierigkeiten? Ein Satz genügt.'

/**
 * Zwei Beispiele zum Antippen in der Startansicht.
 *
 * Wer noch nie mit einem Computer geschrieben hat, weiß vor einem leeren Feld
 * oft nicht, was hineingehört — und wie ausführlich es sein muss. Die beiden
 * Sätze zeigen beides in einem Zug. Sie decken zugleich die zwei häufigsten
 * Anlässe ab: ein Gerät geht nicht, und eine Nachricht wirkt verdächtig.
 */
export const BEISPIELE = [
    'Mein Drucker druckt nicht mehr.',
    'Ich habe eine merkwürdige Nachricht bekommen.',
]

/**
 * Der Wartezustand hat zwei Stufen.
 *
 * Die erste erscheint sofort und bestätigt, dass die Nachricht angekommen ist.
 * Die zweite kommt nach einer Sekunde und sagt, dass gerade nachgesehen wird.
 * Ein Wartezustand, der nur „Bitte warten“ sagt, beantwortet keine der beiden
 * Fragen, die an dieser Stelle offen sind.
 */
export const WARTETEXTE = [
    'Danke für Ihre Nachricht. Ich schaue mir das an.',
    'Ich mache mich kurz schlau für Sie …',
]

/** Zeit bis zur zweiten Stufe des Wartezustands, in Millisekunden. */
export const WARTETEXT_WECHSEL = 1000

/**
 * Die Zeile über den Antwortmöglichkeiten.
 *
 * Sie ist nicht Zierde: Ohne sie ist für einen ungeübten Menschen nicht sicher
 * erkennbar, dass die grünen Flächen angetippt werden dürfen. Sie steht einmal
 * im gerenderten HTML und einmal im Skript — deshalb hier.
 */
export const EINLEITUNG_BEISPIELE = 'Tippen Sie auf ein Beispiel:'
export const EINLEITUNG_ANTWORT = 'Tippen Sie auf Ihre Antwort:'
