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
RUN npx prisma generate --schema=apps/audit-service/prisma/schema.prisma
RUN npx turbo build --filter=audit-service

FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY --from=builder --chown=node:node /app/apps/audit-service/dist ./apps/audit-service/dist
COPY --from=builder --chown=node:node /app/apps/audit-service/package.json ./apps/audit-service/
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/apps/audit-service/node_modules ./apps/audit-service/node_modules
COPY --from=builder --chown=node:node /app/packages/common/dist ./packages/common/dist
COPY --from=builder --chown=node:node /app/packages/common/package.json ./packages/common/package.json
USER node
CMD ["node", "apps/audit-service/dist/src/main.js"]
