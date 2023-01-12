FROM node:18.13.0-bullseye-slim as base

RUN set -ex; \
    apt update -y; \
    apt install ca-certificates -y; \
    update-ca-certificates

FROM base as build

WORKDIR /app

RUN apt install make gcc g++ python3 git openssl -y;

COPY --chown=node:node package.json package-lock.json prisma ./
RUN set -ex; \
    npm install --ignore-scripts; \
    npx prisma generate

COPY --chown=node:node . .
RUN set -ex; \
    npm run build; \
    NODE_ENV=production npm prune

FROM base as app

WORKDIR /app

COPY --from=build /app/dist ./
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules ./node_modules

ENV NODE_PATH=.

USER node
CMD [ "node", "/app/src/server.js" ]
