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

ssh_opts=(
  -o StrictHostKeyChecking=no
)

echo "Preparing remote directory on ${DEPLOY_HOST}"
ssh "${ssh_opts[@]}" "${DEPLOY_USER}@${DEPLOY_HOST}" \
  "mkdir -p '${remote_root}' '${remote_kong_dir}' '${remote_consul_dir}' '${remote_keycloak_dir}' '${remote_logstash_dir}'"

echo "Uploading deployment assets"
scp "${ssh_opts[@]}" docker-compose.deploy.yml "${DEPLOY_USER}@${DEPLOY_HOST}:${remote_compose_file}"
scp "${ssh_opts[@]}" kong/kong.yaml "${DEPLOY_USER}@${DEPLOY_HOST}:${remote_kong_file}"
scp "${ssh_opts[@]}" docker/consul/init.sh "${DEPLOY_USER}@${DEPLOY_HOST}:${remote_consul_init_file}"
scp "${ssh_opts[@]}" docker/keycloak/realm-export.json "${DEPLOY_USER}@${DEPLOY_HOST}:${remote_keycloak_realm_file}"
scp "${ssh_opts[@]}" docker/logstash/logstash.conf "${DEPLOY_USER}@${DEPLOY_HOST}:${remote_logstash_pipeline_file}"

echo "Deploying ${IMAGE_TAG} to ${DEPLOY_ENV}"
ssh "${ssh_opts[@]}" "${DEPLOY_USER}@${DEPLOY_HOST}" \
  "export DEPLOY_ENV='${DEPLOY_ENV}' GHCR_OWNER='${GHCR_OWNER}' IMAGE_TAG='${IMAGE_TAG}' GHCR_USERNAME='${GHCR_USERNAME}' GHCR_TOKEN='${GHCR_TOKEN}' REMOTE_ROOT='${remote_root}' REMOTE_ENV_FILE='${remote_env_file}' REMOTE_COMPOSE_FILE='${remote_compose_file}'; bash -s" <<'EOF'
set -euo pipefail

if [[ ! -f "${REMOTE_ENV_FILE}" ]]; then
  echo "Missing environment file: ${REMOTE_ENV_FILE}" >&2
  exit 1
fi

cd "${REMOTE_ROOT}"

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

for service in "${migration_services[@]}"; do
  "${compose_cmd[@]}" run --rm --no-deps "${service}" \
    npx prisma migrate deploy --schema "./apps/${service}/prisma/schema.prisma"
done

"${compose_cmd[@]}" up -d --remove-orphans "${app_services[@]}"
"${compose_cmd[@]}" ps

set -a
. "${REMOTE_ENV_FILE}"
set +a

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
