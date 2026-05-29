#!/bin/sh
set -eu

template_path="${ALERTMANAGER_TEMPLATE_PATH:-/etc/alertmanager/alertmanager.template.yml}"
output_path="${ALERTMANAGER_CONFIG_PATH:-/etc/alertmanager/alertmanager.yml}"
webhook_url="${ALERTMANAGER_WEBHOOK_URL:-http://host.docker.internal:9099/alertmanager}"
escaped_webhook_url="$(printf '%s' "$webhook_url" | sed 's/[&|]/\\&/g')"

mkdir -p "$(dirname "$output_path")"
sed "s|http://host.docker.internal:9099/alertmanager|${escaped_webhook_url}|g" "$template_path" > "$output_path"

exec /bin/alertmanager \
  --config.file="$output_path" \
  --storage.path="${ALERTMANAGER_STORAGE_PATH:-/alertmanager}"
