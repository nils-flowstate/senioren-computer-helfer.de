# syntax=docker/dockerfile:1

# Mehrstufiger Build nach GEO-LLM.txt §14. Die Bauwerkzeuge bleiben in den
# frühen Stufen zurück; im Laufzeit-Image liegt am Ende nur, was der Server
# tatsächlich ausführt.

# ---------------------------------------------------------------------------
# Stufe 1: alle Abhängigkeiten, reproduzierbar aus der Lockdatei.
# ---------------------------------------------------------------------------
FROM node:22-alpine AS abhaengigkeiten
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---------------------------------------------------------------------------
# Stufe 2: Astro bauen.
# ---------------------------------------------------------------------------
FROM node:22-alpine AS bau
WORKDIR /app
ENV ASTRO_TELEMETRY_DISABLED=1
COPY --from=abhaengigkeiten /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---------------------------------------------------------------------------
# Stufe 3: nur die Produktionsabhängigkeiten. Getrennt von Stufe 1, damit
# TypeScript, Vitest und Tailwind nicht im Laufzeit-Image landen.
# ---------------------------------------------------------------------------
FROM node:22-alpine AS produktionsabhaengigkeiten
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# ---------------------------------------------------------------------------
# Stufe 4: Laufzeit.
# ---------------------------------------------------------------------------
FROM node:22-alpine AS laufzeit
WORKDIR /app

# Der Container lauscht innerhalb des Netzes auf 0.0.0.0:3005 (§11). Nach außen
# gibt ihn erst compose.yaml frei — und zwar ausschließlich an 127.0.0.1.
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3005 \
    ASTRO_TELEMETRY_DISABLED=1

COPY --from=produktionsabhaengigkeiten /app/node_modules ./node_modules
COPY --from=bau /app/dist ./dist
COPY package.json ./

# Kein Root: Der Benutzer "node" ist im offiziellen Image bereits angelegt.
USER node

EXPOSE 3005

CMD ["node", "dist/server/entry.mjs"]
