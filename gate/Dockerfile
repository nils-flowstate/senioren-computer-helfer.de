FROM node:22-alpine
WORKDIR /app
COPY server.js .
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 3000
CMD ["node", "server.js"]
