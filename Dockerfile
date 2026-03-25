# ---- Base Node ----
FROM node:24.14.1-trixie-slim AS base

RUN set -ex && \
    apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates dumb-init && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/node/app && chown -R node:node /home/node && chmod -R 770 /home/node
WORKDIR /home/node/app

# ---- Dependencies ----
FROM base AS dependencies

COPY --chown=node:node ./package.json ./
COPY --chown=node:node ./package-lock.json ./
USER node
# install production dependencies
RUN set -ex; \
    npm ci --ignore-scripts --omit dev;
# separate production node_modules
# Uses cp (not mv) so that the next npm install can add dev dependencies
# incrementally on top of existing production deps, instead of installing
# everything from scratch. Trades disk usage in the build stage for faster
# installs. This stage is discarded in the final image.
RUN cp -R node_modules prod_node_modules
# install ALL node_modules, including 'devDependencies'
RUN set -ex; \
    npm install --ignore-scripts;

# ---- Build ----
FROM dependencies AS build

COPY --chown=node:node . .
RUN node --run build

# ---- Release ----
FROM base AS release

COPY --chown=node:node --from=build /home/node/app/prod_node_modules ./node_modules
COPY --chown=node:node --from=build /home/node/app/src/db/migrations ./src/db/migrations
COPY --chown=node:node --from=build /home/node/app/dist ./

ARG GIT_COMMIT_SHA=""
ARG APP_VERSION=""

ENV GIT_COMMIT_SHA=${GIT_COMMIT_SHA}
ENV APP_VERSION=${APP_VERSION}
ENV NODE_ENV=production
ENV NODE_PATH=.

USER node

EXPOSE 3000

# Uses /live (shallow liveness) instead of /health (readiness) so the container
# is not killed when external dependencies (Postgres, Redis) are temporarily down.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://localhost:3000/live').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"

CMD ["dumb-init", "node", "--import=@opentelemetry/instrumentation/hook.mjs", "server.js"]
