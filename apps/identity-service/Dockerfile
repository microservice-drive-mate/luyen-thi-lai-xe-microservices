# syntax=docker/dockerfile:1

# Giai đoạn 1: Prune
FROM node:20-alpine AS pruner
RUN npm install -g turbo
WORKDIR /app
COPY . .
RUN turbo prune identity-service --docker

# Giai đoạn 2: Install
FROM node:20-alpine AS installer
# Thêm libc6-compat và openssl cho Prisma
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/package-lock.json ./
RUN --mount=type=cache,id=npm,target=/root/.npm,sharing=locked \
    npm ci --legacy-peer-deps

# Giai đoạn 3: Build
FROM node:20-alpine AS builder
# Thêm libc6-compat và openssl cho Prisma
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY --from=installer /app/node_modules ./node_modules
COPY --from=installer /app/apps/identity-service/node_modules ./apps/identity-service/node_modules
COPY --from=pruner /app/out/full/ .
RUN npx prisma generate --schema=apps/identity-service/prisma/schema.prisma --config=apps/identity-service/prisma.config.ts
RUN npx turbo build --filter=identity-service
RUN mkdir -p /tmp/prisma-client && cp -R node_modules/@prisma/identity-client /tmp/prisma-client/
RUN npm prune --omit=dev --legacy-peer-deps && npm cache clean --force && mkdir -p apps/identity-service/node_modules
RUN mkdir -p node_modules/@prisma && cp -R /tmp/prisma-client/identity-client node_modules/@prisma/

# Giai đoạn 4: Runner
FROM node:20-alpine AS runner
# Thêm libc6-compat và openssl cho Prisma runtime
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
COPY --from=builder --chown=node:node /app/apps/identity-service/dist ./apps/identity-service/dist
COPY --from=builder --chown=node:node /app/apps/identity-service/package.json ./apps/identity-service/
COPY --from=builder --chown=node:node /app/apps/identity-service/prisma ./apps/identity-service/prisma
COPY --from=builder --chown=node:node /app/apps/identity-service/prisma.config.ts ./apps/identity-service/prisma.config.ts
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/apps/identity-service/node_modules ./apps/identity-service/node_modules
COPY --from=builder --chown=node:node /app/packages/common/dist ./packages/common/dist
COPY --from=builder --chown=node:node /app/packages/common/package.json ./packages/common/package.json

USER node
CMD ["node", "apps/identity-service/dist/src/main.js"]
