FROM node:22-alpine AS base

RUN set -ex && \
    apk update && \
    apk add --no-cache libssl3 openssl

RUN mkdir -p /home/node/app
RUN chown -R node:node /home/node && chmod -R 770 /home/node
WORKDIR /home/node/app

FROM base AS builder
RUN set -ex && \
    apk update && \
    apk add --no-cache \
      ca-certificates \
      dumb-init \
      make \
      gcc \
      g++ \
      python3 \
      git \
      openssl

COPY prisma ./prisma
COPY scripts ./scripts
COPY src ./src
COPY package.json package-lock.json tsconfig.json ./

RUN set -ex && \
    npm ci --ignore-scripts --omit dev && \
    npx prisma generate && \
    cp -R node_modules prod_node_modules && \
    npm install --ignore-scripts && \
    npm run build

FROM base AS runner

COPY --from=builder /usr/bin/dumb-init /usr/bin/dumb-init

COPY --chown=node:node --from=builder /home/node/app/dist .
COPY --chown=node:node --from=builder /home/node/app/prisma prisma
COPY --chown=node:node --from=builder /home/node/app/prod_node_modules node_modules

ARG GIT_COMMIT_SHA=""
ARG APP_VERSION=""

ENV GIT_COMMIT_SHA=${GIT_COMMIT_SHA}
ENV APP_VERSION=${APP_VERSION}
ENV NODE_ENV=production
ENV NODE_PATH=.

USER node
CMD [ "dumb-init", "node", "/home/node/app/src/server.js" ]
