# HORIZONTE: juego + API en un solo contenedor (Node sin dependencias)
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8080 DB_PATH=/app/datos/horizonte.db NODE_NO_WARNINGS=1
COPY index.html docente.html manifest.webmanifest sw.js package.json ./
COPY css ./css
COPY js ./js
COPY data ./data
COPY icons ./icons
COPY vendor ./vendor
COPY assets ./assets
COPY server ./server
RUN mkdir -p /app/datos && chown -R node:node /app/datos
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --start-interval=2s CMD wget -qO- http://127.0.0.1:8080/api/salud || exit 1
CMD ["node", "server/server.mjs"]
