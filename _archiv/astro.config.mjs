// @ts-check
import { defineConfig } from 'astro/config'
import node from '@astrojs/node'
import sitemap from '@astrojs/sitemap'
import tailwindcss from '@tailwindcss/vite'

// Serverbetrieb statt statischem Export: Die KI-Anbindung braucht serverseitige
// Routen, damit der API-Schlüssel den Browser nie erreicht (GEO-LLM.txt §9, §11).
export default defineConfig({
  site: 'https://senioren-computer-helfer.de',
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  trailingSlash: 'never',
  compressHTML: true,
  // Kein Prefetch: Das legte ein Client-Skript auf jede Seite, ohne dass eine
  // Website dieser Größe messbar davon profitiert.
  prefetch: false,
  integrations: [
    sitemap({
      // API-Routen und Fehlerseiten gehören nicht in die Sitemap.
      filter: (seite) => !seite.includes('/api/') && !seite.includes('/404'),
    }),
  ],
  /*
   * Der Node-Adapter würde Sitzungen sonst auf die Platte schreiben. Wir führen
   * keinen serverseitigen Sitzungsspeicher — der Zustand steckt im signierten
   * Cookie, der Verlauf im Browser (GEO-LLM.txt §10). Der Speicher im
   * Arbeitsspeicher bleibt leer, hinterlässt aber keine Dateien.
   */
  session: {
    driver: 'memory',
  },
  build: {
    // Kein eingebettetes CSS: Sonst bräuchte die Content-Security-Policy
    // 'unsafe-inline' für Stile, und die Richtlinie verlöre ihren Sinn.
    inlineStylesheets: 'never',
  },
  vite: {
    plugins: [tailwindcss()],
    build: {
      /*
       * Astro bettet Skripte unterhalb von 4 KB direkt ins HTML ein. Zusammen
       * mit "script-src 'self'" aus src/middleware.ts blockiert der Browser
       * genau diese Skripte: Der Chat bliebe stumm und die Schriftgröße ließe
       * sich nicht umstellen — ohne dass beim Bauen etwas auffiele.
       *
       * 0 heißt: jedes Skript bekommt eine eigene Datei und wird über src
       * geladen. Damit deckt sich das, was gebaut wird, mit dem, was die
       * Sicherheitsrichtlinie erlaubt.
       */
      assetsInlineLimit: 0,
    },
  },
})
