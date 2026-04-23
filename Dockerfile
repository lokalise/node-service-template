# ---- Base Node ----
FROM node:24.15.0-trixie-slim AS base

RUN set -ex && \
    apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates dumb-init && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Enable pnpm via corepack so the version pinned in package.json#packageManager
# is used consistently across local, CI, and Docker builds.
RUN corepack enable

RUN mkdir -p /home/node/app && chown -R node:node /home/node && chmod -R 770 /home/node
WORKDIR /home/node/app

# ---- Production dependencies ----
FROM base AS production-deps

# Workspace manifests must all be present so pnpm can resolve `workspace:*` deps.
COPY --chown=node:node ./package.json ./pnpm-lock.yaml ./pnpm-workspace.yaml ./
COPY --chown=node:node ./packages/api-contracts/package.json ./packages/api-contracts/package.json

USER node
RUN set -ex; \
    pnpm install --frozen-lockfile --ignore-scripts --prod;

# ---- Build ----
FROM base AS build

COPY --chown=node:node ./package.json ./pnpm-lock.yaml ./pnpm-workspace.yaml ./
COPY --chown=node:node ./packages/api-contracts/package.json ./packages/api-contracts/package.json

USER node
# Full install including devDependencies needed to build the service.
RUN set -ex; \
    pnpm install --frozen-lockfile --ignore-scripts;

COPY --chown=node:node . .
RUN pnpm run build

# ---- Release ----
FROM base AS release

# Production node_modules (with pnpm symlinks into workspace packages)
COPY --chown=node:node --from=production-deps /home/node/app/node_modules ./node_modules
# Workspace packages referenced via symlinks from node_modules
COPY --chown=node:node --from=build /home/node/app/packages ./packages
COPY --chown=node:node --from=build /home/node/app/src/db/migrations ./src/db/migrations
COPY --chown=node:node --from=build /home/node/app/dist ./

ARG GIT_COMMIT_SHA=""
ARG APP_VERSION=""

ENV GIT_COMMIT_SHA=${GIT_COMMIT_SHA}
ENV APP_VERSION=${APP_VERSION}
ENV NODE_ENV=production
ENV NODE_PATH=.

USER node

ENV APP_PORT=3000
# EXPOSE is resolved at build time, so it documents the default APP_PORT (3000).
# Override APP_PORT at runtime with `-e APP_PORT=...` and publish with `-p <host>:<app_port>`.
EXPOSE 3000

# Uses /live (shallow liveness) instead of /health (readiness) so the container
# is not killed when external dependencies (Postgres, Redis) are temporarily down.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD node -e "fetch(\`http://localhost:${process.env.APP_PORT || 3000}/live\`).then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"

CMD ["dumb-init", "node", "--import=@opentelemetry/instrumentation/hook.mjs", "server.js"]
