FROM node:24.22.1-bookworm-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205 AS compilacion
WORKDIR /app
COPY ritmo/servidor/package*.json ritmo/servidor/
RUN npm ci --prefix ritmo/servidor --ignore-scripts --no-audit --no-fund
COPY ritmo/servidor/tsconfig.json ritmo/servidor/
COPY ritmo/servidor/src ritmo/servidor/src
RUN cd ritmo/servidor && npx tsc
FROM node:24.22.1-bookworm-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205
ENV NODE_ENV=production
WORKDIR /app
COPY ritmo/servidor/package*.json ritmo/servidor/
RUN npm ci --prefix ritmo/servidor --omit=dev --ignore-scripts --no-audit --no-fund
COPY ritmo/whatsapp/package*.json ritmo/whatsapp/
RUN npm ci --prefix ritmo/whatsapp --omit=dev --ignore-scripts --no-audit --no-fund
COPY --from=compilacion /app/ritmo/servidor/build ritmo/servidor/build
COPY ritmo/whatsapp/*.mjs ritmo/whatsapp/
USER node
CMD ["node","ritmo/whatsapp/inicio.mjs"]
