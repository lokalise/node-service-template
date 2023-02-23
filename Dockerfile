# ---- Base Node ----
FROM node:18.14.1-bullseye-slim as base

RUN mkdir -p /home/node/app
RUN chown -R node:node /home/node && chmod -R 770 /home/node
WORKDIR /home/node/app

# ---- Dependencies ----
FROM base AS dependencies

RUN set -ex; \
    apt-get update -y ; \
    apt-get install -y --no-install-recommends \
      ca-certificates \
      dumb-init \
      make \
      gcc \
      g++ \
      python3 \
      git \
      openssl
COPY --chown=node:node ./package.json ./package.json prisma ./
COPY --chown=node:node ./package-lock.json ./package-lock.json
USER node
# install production dependencies
RUN set -ex; \
    npm ci --ignore-scripts; \
    npx prisma generate
# separate production node_modules
RUN cp -R node_modules prod_node_modules
# install ALL node_modules, including 'devDependencies'
RUN set -ex; \
    npm install --ignore-scripts ; \
    npx prisma generate

# ---- Build ----
FROM dependencies as build

COPY --chown=node:node . .
RUN npm run build

# ---- Release ----
FROM base as release

COPY --from=build /usr/bin/dumb-init /usr/bin/dumb-init
COPY --chown=node:node --from=build /home/node/app/dist .
COPY --chown=node:node --from=build /home/node/app/prisma prisma
COPY --chown=node:node --from=build /home/node/app/prod_node_modules node_modules

ARG GIT_COMMIT_SHA=""
ARG APP_VERSION=""

ENV GIT_COMMIT_SHA=${GIT_COMMIT_SHA}
ENV APP_VERSION=${APP_VERSION}
ENV NODE_ENV=production
ENV NODE_PATH=.

USER node
CMD [ "dumb-init", "node", "/home/node/app/src/server.js" ]
