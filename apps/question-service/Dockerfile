# syntax=docker/dockerfile:1

# Giai đoạn 1: Prune
FROM node:20-alpine AS pruner
RUN corepack enable && corepack prepare pnpm@10.34.1 --activate
WORKDIR /app
COPY . .
RUN pnpm dlx turbo@2.9.16 prune question-service --docker

# Giai đoạn 2: Install
FROM node:20-alpine AS installer
RUN apk add --no-cache libc6-compat openssl
RUN corepack enable && corepack prepare pnpm@10.34.1 --activate
WORKDIR /app
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store,sharing=locked \
    pnpm install --frozen-lockfile

# Giai đoạn 3: Build
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
RUN corepack enable && corepack prepare pnpm@10.34.1 --activate
WORKDIR /app
COPY --from=installer /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=installer /app/node_modules ./node_modules
COPY --from=installer /app/apps/question-service/node_modules ./apps/question-service/node_modules
COPY --from=pruner /app/out/full/ .
RUN pnpm exec prisma generate --schema=apps/question-service/prisma/schema.prisma --config=apps/question-service/prisma.config.ts
RUN pnpm exec turbo build --filter=question-service
RUN mkdir -p /tmp/prisma-client && cp -R node_modules/@prisma/question-client /tmp/prisma-client/
RUN CI=true pnpm prune --prod --ignore-scripts && mkdir -p apps/question-service/node_modules
RUN mkdir -p node_modules/@prisma && cp -R /tmp/prisma-client/question-client node_modules/@prisma/

# Giai đoạn 4: Runner
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
COPY --from=builder --chown=node:node /app/apps/question-service/dist ./apps/question-service/dist
COPY --from=builder --chown=node:node /app/apps/question-service/package.json ./apps/question-service/
COPY --from=builder --chown=node:node /app/apps/question-service/prisma ./apps/question-service/prisma
COPY --from=builder --chown=node:node /app/apps/question-service/prisma.config.ts ./apps/question-service/prisma.config.ts
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/apps/question-service/node_modules ./apps/question-service/node_modules
COPY --from=builder --chown=node:node /app/packages/common/dist ./packages/common/dist
COPY --from=builder --chown=node:node /app/packages/common/package.json ./packages/common/package.json
USER node
CMD ["node", "apps/question-service/dist/src/main.js"]
