#!/bin/sh
set -eu

KEYCLOAK_URL="${KEYCLOAK_URL:-http://keycloak:8080}"
KEYCLOAK_REALM="${KEYCLOAK_REALM:-luyen-thi-lai-xe-realm}"
KEYCLOAK_ADMIN="${KEYCLOAK_ADMIN:-admin}"
KEYCLOAK_ADMIN_PASSWORD="${KEYCLOAK_ADMIN_PASSWORD:-admin}"

KEYCLOAK_SMTP_HOST="${KEYCLOAK_SMTP_HOST:-mailpit}"
KEYCLOAK_SMTP_PORT="${KEYCLOAK_SMTP_PORT:-1025}"
KEYCLOAK_SMTP_FROM="${KEYCLOAK_SMTP_FROM:-no-reply@luyen-thi-lai-xe.local}"
KEYCLOAK_SMTP_FROM_DISPLAY_NAME="${KEYCLOAK_SMTP_FROM_DISPLAY_NAME:-Luyen Thi Lai Xe}"
KEYCLOAK_SMTP_REPLY_TO="${KEYCLOAK_SMTP_REPLY_TO:-$KEYCLOAK_SMTP_FROM}"
KEYCLOAK_SMTP_REPLY_TO_DISPLAY_NAME="${KEYCLOAK_SMTP_REPLY_TO_DISPLAY_NAME:-$KEYCLOAK_SMTP_FROM_DISPLAY_NAME}"
KEYCLOAK_SMTP_AUTH="${KEYCLOAK_SMTP_AUTH:-false}"
KEYCLOAK_SMTP_USER="${KEYCLOAK_SMTP_USER:-}"
KEYCLOAK_SMTP_PASSWORD="${KEYCLOAK_SMTP_PASSWORD:-}"
KEYCLOAK_SMTP_SSL="${KEYCLOAK_SMTP_SSL:-false}"
KEYCLOAK_SMTP_STARTTLS="${KEYCLOAK_SMTP_STARTTLS:-false}"

MAX_RETRIES="${MAX_RETRIES:-60}"
RETRY_COUNT=0

echo "[Keycloak SMTP] Waiting for Keycloak at $KEYCLOAK_URL..."
while [ "$RETRY_COUNT" -lt "$MAX_RETRIES" ]; do
  if /opt/keycloak/bin/kcadm.sh config credentials \
    --server "$KEYCLOAK_URL" \
    --realm master \
    --user "$KEYCLOAK_ADMIN" \
    --password "$KEYCLOAK_ADMIN_PASSWORD" >/dev/null 2>&1; then
    break
  fi

  RETRY_COUNT=$((RETRY_COUNT + 1))
  echo "[Keycloak SMTP] Waiting... ($RETRY_COUNT/$MAX_RETRIES)"
  sleep 2
done

if [ "$RETRY_COUNT" -eq "$MAX_RETRIES" ]; then
  echo "[Keycloak SMTP] ERROR: Keycloak did not become ready"
  exit 1
fi

echo "[Keycloak SMTP] Updating SMTP settings for realm $KEYCLOAK_REALM"
echo "[Keycloak SMTP] SMTP host=$KEYCLOAK_SMTP_HOST port=$KEYCLOAK_SMTP_PORT auth=$KEYCLOAK_SMTP_AUTH ssl=$KEYCLOAK_SMTP_SSL starttls=$KEYCLOAK_SMTP_STARTTLS"
echo "[Keycloak SMTP] SMTP from=$KEYCLOAK_SMTP_FROM replyTo=$KEYCLOAK_SMTP_REPLY_TO user=${KEYCLOAK_SMTP_USER:-<empty>} passwordLength=${#KEYCLOAK_SMTP_PASSWORD}"

/opt/keycloak/bin/kcadm.sh update "realms/$KEYCLOAK_REALM" \
  -s resetPasswordAllowed=true \
  -s "smtpServer.host=$KEYCLOAK_SMTP_HOST" \
  -s "smtpServer.port=$KEYCLOAK_SMTP_PORT" \
  -s "smtpServer.from=$KEYCLOAK_SMTP_FROM" \
  -s "smtpServer.fromDisplayName=$KEYCLOAK_SMTP_FROM_DISPLAY_NAME" \
  -s "smtpServer.replyTo=$KEYCLOAK_SMTP_REPLY_TO" \
  -s "smtpServer.replyToDisplayName=$KEYCLOAK_SMTP_REPLY_TO_DISPLAY_NAME" \
  -s "smtpServer.auth=$KEYCLOAK_SMTP_AUTH" \
  -s "smtpServer.user=$KEYCLOAK_SMTP_USER" \
  -s "smtpServer.password=$KEYCLOAK_SMTP_PASSWORD" \
  -s "smtpServer.ssl=$KEYCLOAK_SMTP_SSL" \
  -s "smtpServer.starttls=$KEYCLOAK_SMTP_STARTTLS"

echo "[Keycloak SMTP] SMTP settings updated"
