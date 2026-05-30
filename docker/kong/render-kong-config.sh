#!/bin/sh
set -eu

template_path="${KONG_TEMPLATE_PATH:-/usr/local/kong/declarative/kong.template.yaml}"
output_path="${KONG_DECLARATIVE_CONFIG:-/usr/local/kong/declarative/kong.yaml}"
cors_origins="${KONG_CORS_ORIGINS:-http://localhost:3000,http://localhost:3001,http://localhost:3009,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:3001,http://127.0.0.1:3009,http://127.0.0.1:5173}"
origins_file="$(mktemp)"

printf '%s' "$cors_origins" \
  | tr ',' '\n' \
  | while IFS= read -r origin; do
    trimmed="$(printf '%s' "$origin" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')"
    if [ -n "$trimmed" ]; then
      printf '        - %s\n' "$trimmed"
    fi
  done > "$origins_file"

mkdir -p "$(dirname "$output_path")"

skipping_origins=0
{
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      "      origins:")
        printf '%s\n' "$line"
        cat "$origins_file"
        skipping_origins=1
        ;;
      "      methods:")
        skipping_origins=0
        printf '%s\n' "$line"
        ;;
      *)
        if [ "$skipping_origins" -eq 0 ]; then
          printf '%s\n' "$line"
        fi
        ;;
    esac
  done < "$template_path"
} > "$output_path"

rm -f "$origins_file"

exec /docker-entrypoint.sh kong docker-start
