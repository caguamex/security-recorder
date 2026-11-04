FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY ritmo/servidor/package*.json ritmo/servidor/
RUN npm ci --prefix ritmo/servidor
COPY ritmo ritmo
RUN npm run build --prefix ritmo/servidor && npm prune --omit=dev --prefix ritmo/servidor

FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app/ritmo/servidor/build ritmo/servidor/build
COPY --from=build --chown=node:node /app/ritmo/servidor/node_modules ritmo/servidor/node_modules
COPY --from=build --chown=node:node /app/ritmo/servidor/package.json ritmo/servidor/package.json
COPY --from=build --chown=node:node /app/ritmo/herramientas/estatico.mjs ritmo/herramientas/estatico.mjs
COPY --from=build --chown=node:node /app/ritmo/dist/pwa ritmo/dist/pwa
USER node
EXPOSE 3000
CMD ["node", "ritmo/servidor/build/index.js"]
