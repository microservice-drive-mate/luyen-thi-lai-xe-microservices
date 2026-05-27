#!/usr/bin/env bash

set -euo pipefail

required_vars=(
  DEPLOY_ENV
  DEPLOY_HOST
  DEPLOY_USER
  DEPLOY_PATH
  GHCR_OWNER
  GHCR_USERNAME
  GHCR_TOKEN
  IMAGE_TAG
)

for var_name in "${required_vars[@]}"; do
  if [[ -z "${!var_name:-}" ]]; then
    echo "Missing required environment variable: ${var_name}" >&2
    exit 1
  fi
done

if [[ "${DEPLOY_ENV}" != "staging" && "${DEPLOY_ENV}" != "production" ]]; then
  echo "DEPLOY_ENV must be staging or production" >&2
  exit 1
fi

remote_root="${DEPLOY_PATH}"
remote_env_file="${remote_root}/${DEPLOY_ENV}.env"
remote_compose_file="${remote_root}/docker-compose.deploy.yml"
remote_kong_dir="${remote_root}/kong"
remote_kong_file="${remote_kong_dir}/kong.yaml"
remote_consul_dir="${remote_root}/docker/consul"
remote_consul_init_file="${remote_consul_dir}/init.sh"
remote_keycloak_dir="${remote_root}/docker/keycloak"
remote_keycloak_realm_file="${remote_keycloak_dir}/realm-export.json"
remote_logstash_dir="${remote_root}/docker/logstash"
remote_logstash_pipeline_file="${remote_logstash_dir}/logstash.conf"
remote_alertmanager_dir="${remote_root}/docker/alertmanager"
remote_alertmanager_file="${remote_alertmanager_dir}/alertmanager.yml"
remote_prometheus_dir="${remote_root}/docker/prometheus"
remote_prometheus_file="${remote_prometheus_dir}/prometheus.yml"
remote_prometheus_alerts_file="${remote_prometheus_dir}/alerts.yml"
remote_grafana_dir="${remote_root}/docker/grafana"
remote_grafana_datasource_dir="${remote_grafana_dir}/provisioning/datasources"
remote_grafana_dashboard_provider_dir="${remote_grafana_dir}/provisioning/dashboards"
remote_grafana_dashboards_dir="${remote_grafana_dir}/dashboards"
remote_grafana_datasource_file="${remote_grafana_datasource_dir}/prometheus.yml"
remote_grafana_dashboard_provider_file="${remote_grafana_dashboard_provider_dir}/dashboards.yml"
remote_grafana_dashboard_file="${remote_grafana_dashboards_dir}/microservices-observability.json"
remote_apps_dir="${remote_root}/apps"
prisma_cli_version="${PRISMA_CLI_VERSION:-7.8.0}"

migration_services=(
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

ssh_opts=(
  -o StrictHostKeyChecking=no
)

echo "Preparing remote directory on ${DEPLOY_HOST}"
ssh "${ssh_opts[@]}" "${DEPLOY_USER}@${DEPLOY_HOST}" \
  "mkdir -p '${remote_root}' '${remote_apps_dir}' '${remote_kong_dir}' '${remote_consul_dir}' '${remote_keycloak_dir}' '${remote_logstash_dir}' '${remote_alertmanager_dir}' '${remote_prometheus_dir}' '${remote_grafana_datasource_dir}' '${remote_grafana_dashboard_provider_dir}' '${remote_grafana_dashboards_dir}'"

echo "Uploading deployment assets"
scp "${ssh_opts[@]}" docker-compose.deploy.yml "${DEPLOY_USER}@${DEPLOY_HOST}:${remote_compose_file}"
scp "${ssh_opts[@]}" kong/kong.yaml "${DEPLOY_USER}@${DEPLOY_HOST}:${remote_kong_file}"
scp "${ssh_opts[@]}" docker/consul/init.sh "${DEPLOY_USER}@${DEPLOY_HOST}:${remote_consul_init_file}"
scp "${ssh_opts[@]}" docker/keycloak/realm-export.json "${DEPLOY_USER}@${DEPLOY_HOST}:${remote_keycloak_realm_file}"
scp "${ssh_opts[@]}" docker/logstash/logstash.conf "${DEPLOY_USER}@${DEPLOY_HOST}:${remote_logstash_pipeline_file}"
scp "${ssh_opts[@]}" docker/alertmanager/alertmanager.yml "${DEPLOY_USER}@${DEPLOY_HOST}:${remote_alertmanager_file}"
scp "${ssh_opts[@]}" docker/prometheus/prometheus.yml "${DEPLOY_USER}@${DEPLOY_HOST}:${remote_prometheus_file}"
scp "${ssh_opts[@]}" docker/prometheus/alerts.yml "${DEPLOY_USER}@${DEPLOY_HOST}:${remote_prometheus_alerts_file}"
scp "${ssh_opts[@]}" docker/grafana/provisioning/datasources/prometheus.yml "${DEPLOY_USER}@${DEPLOY_HOST}:${remote_grafana_datasource_file}"
scp "${ssh_opts[@]}" docker/grafana/provisioning/dashboards/dashboards.yml "${DEPLOY_USER}@${DEPLOY_HOST}:${remote_grafana_dashboard_provider_file}"
scp "${ssh_opts[@]}" docker/grafana/dashboards/microservices-observability.json "${DEPLOY_USER}@${DEPLOY_HOST}:${remote_grafana_dashboard_file}"

for service in "${migration_services[@]}"; do
  remote_service_dir="${remote_apps_dir}/${service}"
  ssh "${ssh_opts[@]}" "${DEPLOY_USER}@${DEPLOY_HOST}" \
    "rm -rf '${remote_service_dir}/prisma' && mkdir -p '${remote_service_dir}'"
  scp "${ssh_opts[@]}" -r "apps/${service}/prisma" "${DEPLOY_USER}@${DEPLOY_HOST}:${remote_service_dir}/"
done

echo "Deploying ${IMAGE_TAG} to ${DEPLOY_ENV}"
ssh "${ssh_opts[@]}" "${DEPLOY_USER}@${DEPLOY_HOST}" \
  "export DEPLOY_ENV='${DEPLOY_ENV}' GHCR_OWNER='${GHCR_OWNER}' IMAGE_TAG='${IMAGE_TAG}' GHCR_USERNAME='${GHCR_USERNAME}' GHCR_TOKEN='${GHCR_TOKEN}' PRISMA_CLI_VERSION='${prisma_cli_version}' REMOTE_ROOT='${remote_root}' REMOTE_ENV_FILE='${remote_env_file}' REMOTE_COMPOSE_FILE='${remote_compose_file}'; bash -s" <<'EOF'
set -euo pipefail

if [[ ! -f "${REMOTE_ENV_FILE}" ]]; then
  echo "Missing environment file: ${REMOTE_ENV_FILE}" >&2
  exit 1
fi

cd "${REMOTE_ROOT}"

deploy_image_tag="${IMAGE_TAG}"
deploy_ghcr_owner="${GHCR_OWNER}"

set -a
. "${REMOTE_ENV_FILE}"
set +a

export IMAGE_TAG="${deploy_image_tag}"
export GHCR_OWNER="${deploy_ghcr_owner}"

echo "${GHCR_TOKEN}" | docker login ghcr.io -u "${GHCR_USERNAME}" --password-stdin

infra_services=(
  db-identity
  db-user
  db-exam
  db-course
  db-question
  db-notification
  db-analytics
  db-simulation
  db-media
  db-audit
  db-keycloak
  rabbitmq
  redis
  consul
  consul-init
  keycloak
  elasticsearch
  logstash
  kibana
  alertmanager
  prometheus
  grafana
)

app_services=(
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
  kong
)

migration_services=(
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

compose_cmd=(
  docker compose
  --env-file "${REMOTE_ENV_FILE}"
  -f "${REMOTE_COMPOSE_FILE}"
)

export GHCR_OWNER IMAGE_TAG

"${compose_cmd[@]}" pull
"${compose_cmd[@]}" up -d "${infra_services[@]}"

declare -A migration_database_urls=(
  [identity-service]="${SECRET_IDENTITY_DB_URL:-postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db-identity:5432/${IDENTITY_DB_NAME:-identity_db}}"
  [user-service]="${SECRET_USER_DB_URL:-postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db-user:5432/${USER_DB_NAME:-user_db}}"
  [exam-service]="${SECRET_EXAM_DB_URL:-postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db-exam:5432/${EXAM_DB_NAME:-exam_db}}"
  [course-service]="${SECRET_COURSE_DB_URL:-postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db-course:5432/${COURSE_DB_NAME:-course_db}}"
  [question-service]="${SECRET_QUESTION_DB_URL:-postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db-question:5432/${QUESTION_DB_NAME:-question_db}}"
  [notification-service]="${SECRET_NOTIFICATION_DB_URL:-postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db-notification:5432/${NOTIFICATION_DB_NAME:-notification_db}}"
  [analytics-service]="${SECRET_ANALYTICS_DB_URL:-postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db-analytics:5432/${ANALYTICS_DB_NAME:-analytics_db}}"
  [simulation-service]="${SECRET_SIMULATION_DB_URL:-postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db-simulation:5432/${SIMULATION_DB_NAME:-simulation_db}}"
  [media-service]="${SECRET_MEDIA_DB_URL:-postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db-media:5432/${MEDIA_DB_NAME:-media_db}}"
  [audit-service]="${SECRET_AUDIT_DB_URL:-postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db-audit:5432/${AUDIT_DB_NAME:-audit_db}}"
)

for service in "${migration_services[@]}"; do
  echo "[migrate] ${service}"
  "${compose_cmd[@]}" run --rm --no-deps \
    -e DATABASE_URL="${migration_database_urls[${service}]}" \
    migration-runner \
    sh -lc "apk add --no-cache libc6-compat openssl >/dev/null && npm exec --yes --package prisma@${PRISMA_CLI_VERSION} -- prisma migrate deploy --schema './apps/${service}/prisma/schema.prisma'"
done

"${compose_cmd[@]}" up -d --remove-orphans "${app_services[@]}"
"${compose_cmd[@]}" ps

gateway_port="${KONG_PROXY_PORT:-8000}"
health_routes=(
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

check_gateway_route() {
  local service="$1"
  local suffix="$2"
  local url="http://127.0.0.1:${gateway_port}/${service}/health/${suffix}"

  for attempt in $(seq 1 30); do
    if curl --silent --show-error --fail "${url}" > /dev/null; then
      echo "[smoke] ${service} ${suffix} OK"
      return 0
    fi
    sleep 2
  done

  echo "[smoke] ${service} ${suffix} failed via ${url}" >&2
  return 1
}

for service in "${health_routes[@]}"; do
  check_gateway_route "${service}" live
  check_gateway_route "${service}" ready
done

printf '%s\n' "${IMAGE_TAG}" > .last-deployed-tag
docker logout ghcr.io || true
EOF
