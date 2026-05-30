# syntax=docker/dockerfile:1

FROM node:20-alpine AS pruner
RUN npm install -g turbo
WORKDIR /app
COPY . .
RUN turbo prune audit-service --docker

FROM node:20-alpine AS installer
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/package-lock.json ./
RUN --mount=type=cache,id=npm,target=/root/.npm,sharing=locked npm ci --legacy-peer-deps

FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY --from=installer /app/node_modules ./node_modules
COPY --from=installer /app/apps/audit-service/node_modules ./apps/audit-service/node_modules
COPY --from=pruner /app/out/full/ .
RUN npx prisma generate --schema=apps/audit-service/prisma/schema.prisma --config=apps/audit-service/prisma.config.ts
RUN npx turbo build --filter=audit-service
RUN mkdir -p /tmp/prisma-client && cp -R node_modules/@prisma/audit-client /tmp/prisma-client/
RUN npm prune --omit=dev --legacy-peer-deps && npm cache clean --force && mkdir -p apps/audit-service/node_modules
RUN mkdir -p node_modules/@prisma && cp -R /tmp/prisma-client/audit-client node_modules/@prisma/

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
COPY --from=builder --chown=node:node /app/apps/audit-service/dist ./apps/audit-service/dist
COPY --from=builder --chown=node:node /app/apps/audit-service/package.json ./apps/audit-service/
COPY --from=builder --chown=node:node /app/apps/audit-service/prisma ./apps/audit-service/prisma
COPY --from=builder --chown=node:node /app/apps/audit-service/prisma.config.ts ./apps/audit-service/prisma.config.ts
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/apps/audit-service/node_modules ./apps/audit-service/node_modules
COPY --from=builder --chown=node:node /app/packages/common/dist ./packages/common/dist
COPY --from=builder --chown=node:node /app/packages/common/package.json ./packages/common/package.json
USER node
CMD ["node", "apps/audit-service/dist/src/main.js"]
