#!/bin/sh
set -eu

BACKUP_ROOT="${BACKUP_ROOT:-/backups/postgres}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
BACKUP_WEEKLY_RETENTION_WEEKS="${BACKUP_WEEKLY_RETENTION_WEEKS:-4}"
BACKUP_INTERVAL_SECONDS="${BACKUP_INTERVAL_SECONDS:-86400}"
BACKUP_RUN_ONCE="${BACKUP_RUN_ONCE:-false}"
WEEKLY_BACKUP_ROOT="${WEEKLY_BACKUP_ROOT:-${BACKUP_ROOT}/weekly}"
NODE_ENV="${NODE_ENV:-development-local}"

log() {
  printf '%s %s\n' "$(date '+%Y-%m-%dT%H:%M:%S%z')" "$*"
}

backup_target() {
  service_name="$1"
  host="$2"
  port="$3"
  database="$4"
  user="$5"
  password="$6"
  timestamp="$7"
  backup_dir="$8"
  manifest_file="$9"

  file_path="${backup_dir}/${service_name}_${NODE_ENV}_${timestamp}.dump"
  temp_path="${file_path}.tmp"

  log "[backup] Starting ${service_name}/${database} from ${host}:${port}"

  if ! PGPASSWORD="${password}" pg_isready -h "${host}" -p "${port}" -U "${user}" -d "${database}" >/dev/null 2>&1; then
    log "[backup] ERROR ${service_name}/${database}: database is not ready"
    return 1
  fi

  if ! PGPASSWORD="${password}" pg_dump \
    -h "${host}" \
    -p "${port}" \
    -U "${user}" \
    -d "${database}" \
    --format=custom \
    --compress=6 \
    --no-owner \
    --no-privileges \
    --file="${temp_path}"; then
    rm -f "${temp_path}"
    log "[backup] ERROR ${service_name}/${database}: pg_dump failed"
    return 1
  fi

  mv "${temp_path}" "${file_path}"
  sha256sum "${file_path}" > "${file_path}.sha256"
  printf '%s,%s,%s,%s,%s\n' "${service_name}" "${database}" "${host}" "${port}" "$(basename "${file_path}")" >> "${manifest_file}"

  log "[backup] Wrote ${file_path}"
}

run_backup_once() {
  timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
  backup_dir="${BACKUP_ROOT}/${NODE_ENV}/${timestamp}"
  manifest_file="${backup_dir}/manifest.csv"
  failures=0

  mkdir -p "${backup_dir}"
  printf 'service,database,host,port,file\n' > "${manifest_file}"

  backup_target "identity-service" "db-identity" "5432" "${IDENTITY_DB_NAME:-identity_db}" "${POSTGRES_USER:-user}" "${POSTGRES_PASSWORD:-password}" "${timestamp}" "${backup_dir}" "${manifest_file}" || failures=$((failures + 1))
  backup_target "user-service" "db-user" "5432" "${USER_DB_NAME:-user_db}" "${POSTGRES_USER:-user}" "${POSTGRES_PASSWORD:-password}" "${timestamp}" "${backup_dir}" "${manifest_file}" || failures=$((failures + 1))
  backup_target "exam-service" "db-exam" "5432" "${EXAM_DB_NAME:-exam_db}" "${POSTGRES_USER:-user}" "${POSTGRES_PASSWORD:-password}" "${timestamp}" "${backup_dir}" "${manifest_file}" || failures=$((failures + 1))
  backup_target "course-service" "db-course" "5432" "${COURSE_DB_NAME:-course_db}" "${POSTGRES_USER:-user}" "${POSTGRES_PASSWORD:-password}" "${timestamp}" "${backup_dir}" "${manifest_file}" || failures=$((failures + 1))
  backup_target "question-service" "db-question" "5432" "${QUESTION_DB_NAME:-question_db}" "${POSTGRES_USER:-user}" "${POSTGRES_PASSWORD:-password}" "${timestamp}" "${backup_dir}" "${manifest_file}" || failures=$((failures + 1))
  backup_target "notification-service" "db-notification" "5432" "${NOTIFICATION_DB_NAME:-notification_db}" "${POSTGRES_USER:-user}" "${POSTGRES_PASSWORD:-password}" "${timestamp}" "${backup_dir}" "${manifest_file}" || failures=$((failures + 1))
  backup_target "analytics-service" "db-analytics" "5432" "${ANALYTICS_DB_NAME:-analytics_db}" "${POSTGRES_USER:-user}" "${POSTGRES_PASSWORD:-password}" "${timestamp}" "${backup_dir}" "${manifest_file}" || failures=$((failures + 1))
  backup_target "simulation-service" "db-simulation" "5432" "${SIMULATION_DB_NAME:-simulation_db}" "${POSTGRES_USER:-user}" "${POSTGRES_PASSWORD:-password}" "${timestamp}" "${backup_dir}" "${manifest_file}" || failures=$((failures + 1))
  backup_target "media-service" "db-media" "5432" "${MEDIA_DB_NAME:-media_db}" "${POSTGRES_USER:-user}" "${POSTGRES_PASSWORD:-password}" "${timestamp}" "${backup_dir}" "${manifest_file}" || failures=$((failures + 1))
  backup_target "audit-service" "db-audit" "5432" "${AUDIT_DB_NAME:-audit_db}" "${POSTGRES_USER:-user}" "${POSTGRES_PASSWORD:-password}" "${timestamp}" "${backup_dir}" "${manifest_file}" || failures=$((failures + 1))
  backup_target "keycloak" "db-keycloak" "5432" "${KEYCLOAK_DB_NAME:-keycloak_db}" "${KEYCLOAK_DB_USER:-keycloak}" "${KEYCLOAK_DB_PASSWORD:-password}" "${timestamp}" "${backup_dir}" "${manifest_file}" || failures=$((failures + 1))

  find "${BACKUP_ROOT}/${NODE_ENV}" -type f \( -name '*.dump' -o -name '*.sha256' -o -name 'manifest.csv' \) -mtime +"${BACKUP_RETENTION_DAYS}" -delete
  find "${BACKUP_ROOT}/${NODE_ENV}" -type d -empty -delete
  find "${WEEKLY_BACKUP_ROOT}/${NODE_ENV}" -mindepth 1 -maxdepth 1 -type d -mtime +"$((BACKUP_WEEKLY_RETENTION_WEEKS * 7))" -exec rm -rf {} \; 2>/dev/null || true

  if [ "${failures}" -gt 0 ]; then
    log "[backup] Completed with ${failures} failure(s); backup_dir=${backup_dir}"
    return 1
  fi

  if [ "$(date -u +%u)" = "7" ]; then
    weekly_dir="${WEEKLY_BACKUP_ROOT}/${NODE_ENV}/$(date -u +%G-W%V)"
    mkdir -p "$(dirname "${weekly_dir}")"
    rm -rf "${weekly_dir}"
    cp -a "${backup_dir}" "${weekly_dir}"
    log "[backup] Wrote weekly snapshot ${weekly_dir}"
  fi

  log "[backup] Completed successfully; backup_dir=${backup_dir}"
}

while :; do
  if ! run_backup_once; then
    if [ "${BACKUP_RUN_ONCE}" = "true" ]; then
      exit 1
    fi
  fi

  if [ "${BACKUP_RUN_ONCE}" = "true" ]; then
    exit 0
  fi

  log "[backup] Sleeping ${BACKUP_INTERVAL_SECONDS}s before next backup"
  sleep "${BACKUP_INTERVAL_SECONDS}"
done
