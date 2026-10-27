# Base libre de Evolution 2.3.7 + Baileys corregido. No usar :latest.
FROM node:24.22.1-bookworm-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205 AS compilar
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl git openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /evolution
RUN curl --fail --location --proto '=https' --tlsv1.2 https://codeload.github.com/evolution-foundation/evolution-api/tar.gz/cd800f2976e1e5b682fbf86a01ee4d85ae61f370 -o /tmp/fuente.tar.gz \
 && echo '4aee3973d0cc71e870049c4157642bcb7855050429b3dd455fef29f6c90b9861  /tmp/fuente.tar.gz' | sha256sum -c - \
 && tar -xzf /tmp/fuente.tar.gz --strip-components=1 -C /evolution
COPY ritmo/railway/evolution/proveedor-package.json ./package.json
COPY ritmo/railway/evolution/proveedor-package-lock.json ./package-lock.json
RUN npm ci --ignore-scripts --no-audit --no-fund
ENV DATABASE_PROVIDER=postgresql
RUN DATABASE_CONNECTION_URI='postgresql://compilacion:sin_datos@127.0.0.1:5432/solo_compilacion?schema=agendappx_evolution' npm run db:generate \
 && npm run build \
 && test ! -e prisma/migrations && cp -r prisma/postgresql-migrations prisma/migrations
WORKDIR /evolution/guard
COPY ritmo/railway/evolution/guard/package*.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY ritmo/railway/evolution/guard/*.mjs ./

FROM node:24.22.1-bookworm-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /evolution
COPY --from=compilar --chown=node:node /evolution /evolution
ENV NODE_ENV=production TZ=America/Mexico_City DOCKER_ENV=true DATABASE_PROVIDER=postgresql
USER node
EXPOSE 8080
CMD ["node","guard/arranque.mjs"]
