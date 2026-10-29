# syntax=docker/dockerfile:1

# Build from the repository root so the whole workspace is in the context:
#   docker build -f apps/service/Dockerfile .

# ---- Base Node ----
FROM node:26.7.0-trixie-slim AS base

RUN set -ex && \
    apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates dumb-init && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# /pnpm hosts the pnpm store via a BuildKit cache mount in the build stage
# below; create it as node-owned so non-root installs can write to it.
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN mkdir -p /pnpm/store /home/node/app && \
    chown -R node:node /pnpm /home/node && \
    chmod -R 770 /home/node

WORKDIR /home/node/app

# ---- Prune ----
# Reduce the workspace to this app and the workspace packages it depends on.
# out/json holds only their manifests and the pruned lockfile, so the install
# layer below stays cached until a dependency changes.
FROM base AS prune

COPY --chown=node:node . .
# Installed from / because npm refuses to run next to a package.json whose
# devEngines.packageManager names pnpm.
RUN cd / && \
    npm install -g --no-fund --no-audit turbo@$(node -p "require('/home/node/app/package.json').devDependencies.turbo") && \
    npm cache clean --force
USER node
RUN turbo prune @node-service-template/service --docker

# ---- Build ----
FROM base AS build

# pnpm is installed directly from npm rather than via corepack (which is no
# longer bundled with Node 26), pinned to package.json#devEngines.packageManager.
COPY --chown=node:node --from=prune /home/node/app/out/json/ .
RUN cd / && \
    npm install -g --no-fund --no-audit pnpm@$(node -p "require('/home/node/app/package.json').devEngines.packageManager.version") && \
    npm cache clean --force

USER node
RUN --mount=type=cache,id=pnpm,target=/pnpm/store,uid=1000,gid=1000 \
    pnpm install --frozen-lockfile --ignore-scripts

COPY --chown=node:node --from=prune /home/node/app/out/full/ .
RUN pnpm exec turbo run build --filter=@node-service-template/service...

# Drop devDependencies now that everything is compiled.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store,uid=1000,gid=1000 \
    CI=true pnpm install --frozen-lockfile --ignore-scripts --prod

# ---- Release ----
FROM base AS release

# Stable runtime config first.
ENV NODE_ENV=production
ENV APP_PORT=3000

COPY --chown=node:node --from=build /home/node/app .

WORKDIR /home/node/app/apps/service

USER node

# EXPOSE is resolved at build time, so it documents the default APP_PORT (3000).
# Override APP_PORT at runtime with `-e APP_PORT=...` and publish with `-p <host>:<app_port>`.
EXPOSE 3000

# Uses /live (shallow liveness) instead of /health (readiness) so the container
# is not killed when external dependencies (Postgres, Redis) are temporarily down.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD node -e "fetch(\`http://localhost:${process.env.APP_PORT || 3000}/live\`).then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"

# Volatile build metadata last: a new commit only invalidates this thin
# trailing layer, leaving the heavy COPY layers above cache-eligible.
ARG GIT_COMMIT_SHA=""
ARG APP_VERSION=""
ENV GIT_COMMIT_SHA=${GIT_COMMIT_SHA}
ENV APP_VERSION=${APP_VERSION}
LABEL org.opencontainers.image.revision=${GIT_COMMIT_SHA} \
      org.opencontainers.image.version=${APP_VERSION} \
      org.opencontainers.image.source="https://github.com/lokalise/node-service-template"

CMD ["dumb-init", "node", "--import=@opentelemetry/instrumentation/hook.mjs", "dist/server.js"]
