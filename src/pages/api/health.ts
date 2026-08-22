import type { APIRoute } from 'astro'

export const prerender = false

/**
 * Funktionskontrolle für Docker und den Betrieb.
 *
 * Gibt bewusst keine Versionen, Pfade, Anbieternamen oder Konfigurationswerte
 * aus (GEO-LLM.txt §11). Wer den Zustand genauer braucht, schaut ins Protokoll.
 */
export const GET: APIRoute = () =>
    new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
        },
    })
