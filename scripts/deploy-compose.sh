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

ssh_opts=(
  -o StrictHostKeyChecking=no
)

echo "Preparing remote directory on ${DEPLOY_HOST}"
ssh "${ssh_opts[@]}" "${DEPLOY_USER}@${DEPLOY_HOST}" "mkdir -p '${remote_root}' '${remote_kong_dir}'"

echo "Uploading deployment assets"
scp "${ssh_opts[@]}" docker-compose.deploy.yml "${DEPLOY_USER}@${DEPLOY_HOST}:${remote_compose_file}"
scp "${ssh_opts[@]}" kong/kong.yaml "${DEPLOY_USER}@${DEPLOY_HOST}:${remote_kong_file}"

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
  db-course
  db-keycloak
  rabbitmq
  consul
  keycloak
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
  kong
)

compose_cmd=(
  docker compose
  --env-file "${REMOTE_ENV_FILE}"
  -f "${REMOTE_COMPOSE_FILE}"
)

export GHCR_OWNER IMAGE_TAG

"${compose_cmd[@]}" pull
"${compose_cmd[@]}" up -d "${infra_services[@]}"

"${compose_cmd[@]}" run --rm --no-deps identity-service npx prisma migrate deploy --schema ./apps/identity-service/prisma/schema.prisma
"${compose_cmd[@]}" run --rm --no-deps user-service npx prisma migrate deploy --schema ./apps/user-service/prisma/schema.prisma
"${compose_cmd[@]}" run --rm --no-deps course-service npx prisma migrate deploy --schema ./apps/course-service/prisma/schema.prisma

"${compose_cmd[@]}" up -d --remove-orphans "${app_services[@]}"
"${compose_cmd[@]}" ps

printf '%s\n' "${IMAGE_TAG}" > .last-deployed-tag
docker logout ghcr.io || true
EOF
