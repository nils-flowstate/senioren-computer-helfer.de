import { defineMiddleware } from 'astro:middleware'

/**
 * Setzort für die Sicherheitskopfzeilen.
 *
 * Der DSGVO-Skill verlangt, EINEN Ort festzulegen und ihn zu dokumentieren.
 * Gewählt: diese Datei. Begründung: Die Anwendung läuft mit Node-Adapter, also
 * wirkt die Middleware zur Laufzeit; sie liegt im Repository, ist versioniert
 * und wird bei jeder Änderung mit geprüft. Der Reverse Proxy setzt bewusst
 * keine dieser Kopfzeilen, sonst überschreibt still die eine die andere.
 * Vermerkt in DSGVO/UEBERSICHT.md.
 */

const CSP = [
    "default-src 'self'",
    // Keine Inline-Skripte im Projekt, deshalb ohne 'unsafe-inline'.
    "script-src 'self'",
    // inlineStylesheets: 'never' in astro.config.mjs hält auch CSS extern.
    "style-src 'self'",
    // data: und blob: für die Vorschau eines gerade aufgenommenen Fotos.
    "img-src 'self' data: blob:",
    // blob: für vorgelesene Antworten aus der Sprachausgabe.
    "media-src 'self' blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
].join('; ')

/*
 * Kamera und Mikrofon bleiben für die eigene Seite erlaubt — Foto-Upload und
 * Spracheingabe brauchen sie. Standortabfrage ist abgeschaltet: Nach §16 wird
 * der Wohnort ausschließlich erfragt, nie gemessen.
 */
const PERMISSIONS = [
    'camera=(self)',
    'microphone=(self)',
    'geolocation=()',
    'payment=()',
    'usb=()',
    'interest-cohort=()',
].join(', ')

export const onRequest = defineMiddleware(async (kontext, weiter) => {
    const antwort = await weiter()

    antwort.headers.set('Content-Security-Policy', CSP)
    antwort.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    antwort.headers.set('X-Content-Type-Options', 'nosniff')
    antwort.headers.set('X-Frame-Options', 'DENY')
    antwort.headers.set('Permissions-Policy', PERMISSIONS)
    antwort.headers.set('Cross-Origin-Opener-Policy', 'same-origin')

    // HSTS nur über HTTPS ankündigen. Auf 127.0.0.1 im Container wäre die
    // Kopfzeile wirkungslos und beim lokalen Prüfen nur störend.
    if (kontext.url.protocol === 'https:') {
        antwort.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
    }

    // Antworten des Chats dürfen nirgends zwischengespeichert werden.
    if (kontext.url.pathname.startsWith('/api/')) {
        antwort.headers.set('Cache-Control', 'no-store')
    }

    return antwort
})
