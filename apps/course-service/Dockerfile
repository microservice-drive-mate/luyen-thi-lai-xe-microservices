# Giai đoạn 1: Prune
FROM node:20-alpine AS pruner
RUN npm install -g turbo
WORKDIR /app
COPY . .
RUN turbo prune course-service --docker

# Giai đoạn 2: Install
FROM node:20-alpine AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/package-lock.json ./
RUN npm ci

# Giai đoạn 3: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=installer /app/node_modules ./node_modules
COPY --from=pruner /app/out/full/ .
RUN npx turbo build --filter=course-service

# Giai đoạn 4: Runner
FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder --chown=node:node /app/apps/course-service/dist ./apps/course-service/dist
COPY --from=builder --chown=node:node /app/apps/course-service/package.json ./apps/course-service/
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
USER node
CMD ["node", "apps/course-service/dist/main.js"]