# syntax=docker/dockerfile:1

# Giai đoạn 1: Prune
FROM node:20-alpine AS pruner
RUN npm install -g turbo
WORKDIR /app
COPY . .
RUN turbo prune notification-service --docker

# Giai đoạn 2: Install
FROM node:20-alpine AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/package-lock.json ./
RUN --mount=type=cache,id=npm,target=/root/.npm,sharing=locked \
    npm ci

# Giai đoạn 3: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=installer /app/node_modules ./node_modules
COPY --from=pruner /app/out/full/ .
RUN npx turbo build --filter=notification-service

# Giai đoạn 4: Runner
FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder --chown=node:node /app/apps/notification-service/dist ./apps/notification-service/dist
COPY --from=builder --chown=node:node /app/apps/notification-service/package.json ./apps/notification-service/
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/packages/common/dist ./packages/common/dist
COPY --from=builder --chown=node:node /app/packages/common/package.json ./packages/common/package.json
USER node
CMD ["node", "apps/notification-service/dist/main.js"]