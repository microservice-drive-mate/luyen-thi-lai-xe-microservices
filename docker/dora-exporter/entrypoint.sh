#!/bin/sh
# =============================================================================
# DORA Metrics Exporter — Entrypoint
#
# Chức năng:
#   1. Khi startup: install tsx, pull dữ liệu từ GitHub API, tạo file dora.prom
#   2. Serve file dora.prom qua HTTP port 9100 tại path /metrics
#
# Biến môi trường:
#   GITHUB_TOKEN       (bắt buộc) — GitHub Personal Access Token (scope: repo)
#   DORA_REPOSITORY    (tuỳ chọn) — mặc định tự detect từ git remote origin
#   DORA_DAYS          (tuỳ chọn) — số ngày lấy dữ liệu, mặc định 30
# =============================================================================

set -e

REPORTS_DIR="/app/reports/dora"
PROM_FILE="$REPORTS_DIR/dora.prom"
METRICS_FILE="/tmp/dora-serve/metrics"
export METRICS_FILE

mkdir -p "$REPORTS_DIR" /tmp/dora-serve

# Tự detect DORA_REPOSITORY từ .git/config nếu chưa set
if [ -z "$DORA_REPOSITORY" ]; then
  GIT_CONFIG="/app/.git/config"
  if [ -f "$GIT_CONFIG" ]; then
    REMOTE_URL=$(grep -A2 '\[remote "origin"\]' "$GIT_CONFIG" | grep 'url' | sed 's|.*url *= *||' | tr -d '\r')
    if [ -n "$REMOTE_URL" ]; then
      # Normalize: https://github.com/owner/repo.git  hoặc  git@github.com:owner/repo.git  → owner/repo
      DORA_REPOSITORY=$(echo "$REMOTE_URL" | sed 's|.*github\.com[:/]||' | sed 's|\.git$||')
      export DORA_REPOSITORY
      echo "[dora-exporter] 🔍 Auto-detected repository: $DORA_REPOSITORY"
    fi
  fi
fi

echo "[dora-exporter] 📦 Installing tsx and axios..."
cd /app
npm install --prefix /tmp/dora-deps tsx axios 2>/dev/null
export PATH="/tmp/dora-deps/node_modules/.bin:$PATH"

run_report() {
  if [ -z "$GITHUB_TOKEN" ]; then
    echo "[dora-exporter] ⚠️  GITHUB_TOKEN not set — serving cached/empty metrics."
    if [ ! -f "$PROM_FILE" ]; then
      printf '# HELP dora_deployments_total Total deployments\n# TYPE dora_deployments_total gauge\ndora_deployments_total{repository="unknown"} 0\n' > "$PROM_FILE"
    fi
    return
  fi

  echo "[dora-exporter] 🔄 Pulling DORA data from GitHub (last ${DORA_DAYS:-30} days, repo: $DORA_REPOSITORY)..."

  if npx --prefix /tmp/dora-deps tsx scripts/devops-dora-report.ts; then
    echo "[dora-exporter] ✅ dora-report.json generated."
  else
    echo "[dora-exporter] ⚠️  dora-report.ts failed. Using existing metrics if available."
    return
  fi

  if npx --prefix /tmp/dora-deps tsx scripts/devops-dora-prometheus-export.ts; then
    echo "[dora-exporter] ✅ dora.prom generated."
  else
    echo "[dora-exporter] ⚠️  dora-prometheus-export.ts failed."
  fi
}

# Pull dữ liệu khi startup
run_report

# Copy file vào thư mục serve
if [ -f "$PROM_FILE" ]; then
  cp "$PROM_FILE" "$METRICS_FILE"
  echo "[dora-exporter] 📄 Metrics ready. First 3 lines:"
  head -3 "$METRICS_FILE"
else
  printf '# no metrics available\n' > "$METRICS_FILE"
fi

# Khởi động HTTP server dùng Node.js built-in (không cần install thêm gì)
echo "[dora-exporter] 🚀 Starting HTTP server on :9100 (/metrics)..."
exec node /app/docker/dora-exporter/http-server.js
