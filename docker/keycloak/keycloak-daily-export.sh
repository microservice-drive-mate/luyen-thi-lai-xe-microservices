#!/bin/sh
set -eu

KEYCLOAK_URL="${KEYCLOAK_URL:-http://keycloak:8080}"
KEYCLOAK_REALM="${KEYCLOAK_REALM:-luyen-thi-lai-xe-realm}"
KEYCLOAK_ADMIN="${KEYCLOAK_ADMIN:-admin}"
KEYCLOAK_ADMIN_PASSWORD="${KEYCLOAK_ADMIN_PASSWORD:-admin}"
KEYCLOAK_EXPORT_ROOT="${KEYCLOAK_EXPORT_ROOT:-/backups/keycloak}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
BACKUP_WEEKLY_RETENTION_WEEKS="${BACKUP_WEEKLY_RETENTION_WEEKS:-4}"
BACKUP_INTERVAL_SECONDS="${BACKUP_INTERVAL_SECONDS:-86400}"
BACKUP_RUN_ONCE="${BACKUP_RUN_ONCE:-false}"
KEYCLOAK_WEEKLY_EXPORT_ROOT="${KEYCLOAK_WEEKLY_EXPORT_ROOT:-${KEYCLOAK_EXPORT_ROOT}/weekly}"
NODE_ENV="${NODE_ENV:-development-local}"

log() {
  printf '%s %s\n' "$(date '+%Y-%m-%dT%H:%M:%S%z')" "$*"
}

wait_for_keycloak() {
  retries="${KEYCLOAK_BACKUP_MAX_RETRIES:-60}"
  count=0

  while [ "${count}" -lt "${retries}" ]; do
    if /opt/keycloak/bin/kcadm.sh config credentials \
      --server "${KEYCLOAK_URL}" \
      --realm master \
      --user "${KEYCLOAK_ADMIN}" \
      --password "${KEYCLOAK_ADMIN_PASSWORD}" >/dev/null 2>&1; then
      return 0
    fi

    count=$((count + 1))
    log "[keycloak-backup] Waiting for Keycloak... (${count}/${retries})"
    sleep 2
  done

  log "[keycloak-backup] ERROR: Keycloak did not become ready"
  return 1
}

export_realm_once() {
  timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
  backup_dir="${KEYCLOAK_EXPORT_ROOT}/${NODE_ENV}/${timestamp}"
  manifest_file="${backup_dir}/manifest.csv"

  mkdir -p "${backup_dir}"
  printf 'artifact,file\n' > "${manifest_file}"

  wait_for_keycloak

  log "[keycloak-backup] Exporting realm ${KEYCLOAK_REALM}"
  /opt/keycloak/bin/kcadm.sh get "realms/${KEYCLOAK_REALM}" > "${backup_dir}/realm.json"
  /opt/keycloak/bin/kcadm.sh get "users" -r "${KEYCLOAK_REALM}" --offset 0 --limit 10000 > "${backup_dir}/users.json"
  /opt/keycloak/bin/kcadm.sh get "clients" -r "${KEYCLOAK_REALM}" > "${backup_dir}/clients.json"
  /opt/keycloak/bin/kcadm.sh get "roles" -r "${KEYCLOAK_REALM}" > "${backup_dir}/roles.json"

  sha256sum "${backup_dir}"/*.json > "${backup_dir}/SHA256SUMS"
  printf 'realm,realm.json\nusers,users.json\nclients,clients.json\nroles,roles.json\nchecksums,SHA256SUMS\n' >> "${manifest_file}"

  find "${KEYCLOAK_EXPORT_ROOT}/${NODE_ENV}" -type f \( -name '*.json' -o -name 'SHA256SUMS' -o -name 'manifest.csv' \) -mtime +"${BACKUP_RETENTION_DAYS}" -delete
  find "${KEYCLOAK_EXPORT_ROOT}/${NODE_ENV}" -type d -empty -delete
  find "${KEYCLOAK_WEEKLY_EXPORT_ROOT}/${NODE_ENV}" -mindepth 1 -maxdepth 1 -type d -mtime +"$((BACKUP_WEEKLY_RETENTION_WEEKS * 7))" -exec rm -rf {} \; 2>/dev/null || true

  if [ "$(date -u +%u)" = "7" ]; then
    weekly_dir="${KEYCLOAK_WEEKLY_EXPORT_ROOT}/${NODE_ENV}/$(date -u +%G-W%V)"
    mkdir -p "$(dirname "${weekly_dir}")"
    rm -rf "${weekly_dir}"
    cp -a "${backup_dir}" "${weekly_dir}"
    log "[keycloak-backup] Wrote weekly snapshot ${weekly_dir}"
  fi

  log "[keycloak-backup] Completed successfully; backup_dir=${backup_dir}"
}

while :; do
  if ! export_realm_once; then
    if [ "${BACKUP_RUN_ONCE}" = "true" ]; then
      exit 1
    fi
  fi

  if [ "${BACKUP_RUN_ONCE}" = "true" ]; then
    exit 0
  fi

  log "[keycloak-backup] Sleeping ${BACKUP_INTERVAL_SECONDS}s before next export"
  sleep "${BACKUP_INTERVAL_SECONDS}"
done
