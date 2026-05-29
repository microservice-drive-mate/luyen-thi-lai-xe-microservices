#!/usr/bin/env bash

set -euo pipefail

SMOKE_BASE_URL="${SMOKE_BASE_URL:?SMOKE_BASE_URL is required}"
SMOKE_TIMEOUT_SECONDS="${SMOKE_TIMEOUT_SECONDS:-180}"
SMOKE_INTERVAL_SECONDS="${SMOKE_INTERVAL_SECONDS:-5}"

services=(
  identity-service
  user-service
  exam-service
  course-service
  question-service
  notification-service
  analytics-service
  simulation-service
  media-service
  audit-service
)

check_url() {
  local url="$1"
  local deadline=$((SECONDS + SMOKE_TIMEOUT_SECONDS))

  until curl --silent --show-error --fail "$url" > /dev/null; do
    if (( SECONDS >= deadline )); then
      echo "[smoke] failed: ${url}" >&2
      return 1
    fi

    sleep "$SMOKE_INTERVAL_SECONDS"
  done

  echo "[smoke] ok: ${url}"
}

for service in "${services[@]}"; do
  check_url "${SMOKE_BASE_URL}/${service}/health/live"
  check_url "${SMOKE_BASE_URL}/${service}/health/ready"
done
