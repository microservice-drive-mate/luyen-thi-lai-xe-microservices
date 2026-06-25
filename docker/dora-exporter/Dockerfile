# =============================================================================
# Dockerfile cho DORA Metrics Exporter
#
# Image này:
#   - Dùng node:22-alpine làm base (có sẵn node, npm, npx)
#   - Install pnpm + tsx để chạy TypeScript scripts trực tiếp
#   - Mount workspace để đọc scripts/devops-dora-*.ts
#   - Tự pull dữ liệu từ GitHub khi startup
#   - Serve file dora.prom qua port 9100
# =============================================================================
FROM node:22-alpine

# Cài các tool cần thiết: git (để detect repo), curl (health check), busybox httpd có sẵn
RUN apk add --no-cache git

# Cài tsx globally để chạy TypeScript trực tiếp
RUN npm install -g tsx

WORKDIR /app

# Copy package files để install dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ ./packages/
COPY scripts/tsconfig.json ./scripts/tsconfig.json

# Install pnpm và chỉ cài root-level dependencies (không cài toàn bộ workspace)
RUN npm install -g pnpm && \
    pnpm install --filter . --frozen-lockfile 2>/dev/null || \
    npm install axios 2>/dev/null || true

# Copy các scripts DORA
COPY scripts/devops-dora-report.ts ./scripts/
COPY scripts/devops-dora-prometheus-export.ts ./scripts/

# Copy entrypoint
COPY docker/dora-exporter/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Port 9100 — Prometheus textfile exporter
EXPOSE 9100

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -qO- http://localhost:9100/metrics | grep -q "dora_" || exit 1

ENTRYPOINT ["/entrypoint.sh"]
