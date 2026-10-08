FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
# Abhängigkeiten reproduzierbar aus der Lockdatei (GEO-LLM.txt §14).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY server.js .
USER node
EXPOSE 3000
CMD ["node", "server.js"]
