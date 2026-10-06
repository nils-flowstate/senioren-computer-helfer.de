import type { APIRoute } from 'astro'

/**
 * Die Inhaltsseiten dürfen gelesen werden — auch von KI-Antwortsystemen, dafür
 * ist die Website gebaut. Nur die Schnittstellen bleiben außen vor.
 */
export const GET: APIRoute = ({ site }) =>
    new Response(
        [
            'User-agent: *',
            'Allow: /',
            'Disallow: /api/',
            '',
            `Sitemap: ${new URL('sitemap-index.xml', site ?? 'https://senioren-computer-helfer.de').href}`,
            '',
        ].join('\n'),
        { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
    )
