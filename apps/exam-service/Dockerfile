# Giai đoạn 1: Prune code (Lọc code thừa))
FROM node:20-alpine AS builder
RUN npm install -g turbo
WORKDIR /app
COPY . .
RUN turbo prune exam-service --docker

# Giai đoạn 2: Install dependencies (Tận dụng Docker Cache)
FROM node:20-alpine AS installer
WORKDIR /app
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/package-lock.json ./
RUN npm ci

# Giai đoạn 3: Build mã nguồn
COPY --from=builder /app/out/full/ .
RUN npx turbo build --filter=exam-service

# Giai đoạn 4: Runner (Image production cực nhẹ và bảo mật)
FROM node:20-alpine AS runner
WORKDIR /app
USER node

# TỐI ƯU 3: Dung lượng - Chỉ copy package.json, node_modules và thư mục dist đã biên dịch
COPY --from=installer --chown=node:node /app/package.json .
COPY --from=installer --chown=node:node /app/apps/exam-service/package.json ./apps/exam-service/
COPY --from=installer --chown=node:node /app/node_modules ./node_modules
COPY --from=installer --chown=node:node /app/apps/exam-service/dist ./apps/exam-service/dist

# Chạy file main.js đã build từ NestJS
CMD ["node", "apps/exam-service/dist/main.js"]