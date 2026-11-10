FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
COPY src ./src
RUN npm ci --ignore-scripts \
    && npm run build

# Lock the minimal stdio runtime independently from build/deployment tooling.
FROM node:22-bookworm-slim AS stdio-deps
WORKDIR /app
COPY docker/package.json docker/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

FROM node:22-bookworm-slim AS runtime
LABEL org.opencontainers.image.title="TMDB MCP Server" \
      org.opencontainers.image.source="https://github.com/Laksh-star/mcp-server-tmdb" \
      org.opencontainers.image.licenses="MIT"
ENV NODE_ENV=production
WORKDIR /app
COPY --from=stdio-deps --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=stdio-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node LICENSE ./LICENSE
USER node
ENTRYPOINT ["node", "dist/index.js"]
