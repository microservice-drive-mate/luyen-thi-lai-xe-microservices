# syntax=docker/dockerfile:1

FROM node:20-alpine AS pruner
RUN npm install -g turbo
WORKDIR /app
COPY . .
RUN turbo prune media-service --docker

FROM node:20-alpine AS installer
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/package-lock.json ./
RUN --mount=type=cache,id=npm,target=/root/.npm,sharing=locked \
    npm ci --legacy-peer-deps

FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY --from=installer /app/node_modules ./node_modules
COPY --from=installer /app/apps/media-service/node_modules ./apps/media-service/node_modules
COPY --from=pruner /app/out/full/ .
RUN npx prisma generate --schema=apps/media-service/prisma/schema.prisma
RUN npx turbo build --filter=media-service
RUN npm prune --omit=dev --legacy-peer-deps && npm cache clean --force && mkdir -p apps/media-service/node_modules

FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat openssl
# Runtime only needs node; package managers add unrelated CVE surface.
RUN rm -rf \
    /usr/local/lib/node_modules/npm \
    /usr/local/bin/npm \
    /usr/local/bin/npx \
    /usr/local/lib/node_modules/corepack \
    /usr/local/bin/corepack \
    /opt/yarn* \
    /usr/local/bin/yarn \
    /usr/local/bin/yarnpkg
WORKDIR /app
COPY --from=builder --chown=node:node /app/apps/media-service/dist ./apps/media-service/dist
COPY --from=builder --chown=node:node /app/apps/media-service/package.json ./apps/media-service/
COPY --from=builder --chown=node:node /app/apps/media-service/prisma ./apps/media-service/prisma
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/apps/media-service/node_modules ./apps/media-service/node_modules
COPY --from=builder --chown=node:node /app/packages/common/dist ./packages/common/dist
COPY --from=builder --chown=node:node /app/packages/common/package.json ./packages/common/package.json
USER node
CMD ["node", "apps/media-service/dist/src/main.js"]
