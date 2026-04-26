#!/bin/sh
# Consul bootstrap script

set -e

CONSUL_URL="${CONSUL_URL:-http://consul:8500}"
MAX_RETRIES=30
RETRY_COUNT=0

echo "[Consul] Waiting for Consul to be ready..."

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if curl -s "$CONSUL_URL/v1/status/leader" > /dev/null 2>&1; then
    echo "[Consul] Consul is ready"
    break
  fi

  RETRY_COUNT=$((RETRY_COUNT + 1))
  echo "[Consul] Waiting... ($RETRY_COUNT/$MAX_RETRIES)"
  sleep 1
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
  echo "[Consul] Consul failed to become ready"
  exit 1
fi

set_kv() {
  key="$1"
  value="$2"
  echo "[Consul] Setting: $key = $value"
  curl -s -X PUT -d "$value" "$CONSUL_URL/v1/kv/$key" > /dev/null
}

echo "[Consul] Loading development configuration..."
set_kv "config/development/shared/log.level" "debug"
set_kv "config/development/shared/log.format" "text"
set_kv "config/development/shared/node_env" "development"
set_kv "config/development/identity-service/port" "3000"
set_kv "config/development/identity-service/database.url" "postgresql://user:password@db-identity:5432/identity_db"
set_kv "config/development/identity-service/database.pool_size" "10"
set_kv "config/development/identity-service/database.connection_timeout" "5000"
set_kv "config/development/identity-service/rabbitmq.url" "amqp://rabbitmq:5672"
set_kv "config/development/identity-service/rabbitmq.username" "guest"
set_kv "config/development/identity-service/rabbitmq.password" "guest"
set_kv "config/development/identity-service/rabbitmq.vhost" "/"
set_kv "config/development/user-service/port" "3000"
set_kv "config/development/user-service/database.url" "postgresql://user:password@db-user:5432/user_db"
set_kv "config/development/user-service/rabbitmq.url" "amqp://rabbitmq:5672"
set_kv "config/development/exam-service/port" "3000"
set_kv "config/development/exam-service/database.url" "postgresql://user:password@db-exam:5432/exam_db"
set_kv "config/development/exam-service/rabbitmq.url" "amqp://rabbitmq:5672"
set_kv "config/development/question-service/port" "3000"
set_kv "config/development/question-service/database.url" "postgresql://user:password@db-question:5432/question_db"
set_kv "config/development/question-service/rabbitmq.url" "amqp://rabbitmq:5672"
set_kv "config/development/course-service/port" "3000"
set_kv "config/development/course-service/database.url" "postgresql://user:password@db-course:5432/course_db"
set_kv "config/development/course-service/rabbitmq.url" "amqp://rabbitmq:5672"
set_kv "config/development/notification-service/port" "3000"
set_kv "config/development/notification-service/database.url" "postgresql://user:password@db-notification:5432/notification_db"
set_kv "config/development/notification-service/rabbitmq.url" "amqp://rabbitmq:5672"
set_kv "config/development/analytics-service/port" "3000"
set_kv "config/development/analytics-service/database.url" "postgresql://user:password@db-analytics:5432/analytics_db"
set_kv "config/development/analytics-service/rabbitmq.url" "amqp://rabbitmq:5672"
set_kv "config/development/simulation-service/port" "3000"
set_kv "config/development/simulation-service/database.url" "postgresql://user:password@db-simulation:5432/simulation_db"
set_kv "config/development/simulation-service/rabbitmq.url" "amqp://rabbitmq:5672"

echo "[Consul] Loading development-local configuration..."
set_kv "config/development-local/shared/log.level" "debug"
set_kv "config/development-local/shared/log.format" "text"
set_kv "config/development-local/shared/node_env" "development-local"
set_kv "config/development-local/identity-service/port" "3001"
set_kv "config/development-local/identity-service/database.url" "postgresql://user:password@localhost:5432/identity_db"
set_kv "config/development-local/identity-service/database.pool_size" "10"
set_kv "config/development-local/identity-service/database.connection_timeout" "5000"
set_kv "config/development-local/identity-service/rabbitmq.url" "amqp://localhost:5672"
set_kv "config/development-local/identity-service/rabbitmq.username" "guest"
set_kv "config/development-local/identity-service/rabbitmq.password" "guest"
set_kv "config/development-local/identity-service/rabbitmq.vhost" "/"
set_kv "config/development-local/user-service/port" "3002"
set_kv "config/development-local/user-service/database.url" "postgresql://user:password@localhost:5433/user_db"
set_kv "config/development-local/user-service/rabbitmq.url" "amqp://localhost:5672"
set_kv "config/development-local/exam-service/port" "3003"
set_kv "config/development-local/exam-service/database.url" "postgresql://user:password@localhost:5434/exam_db"
set_kv "config/development-local/exam-service/rabbitmq.url" "amqp://localhost:5672"
set_kv "config/development-local/question-service/port" "3005"
set_kv "config/development-local/question-service/database.url" "postgresql://user:password@localhost:5436/question_db"
set_kv "config/development-local/question-service/rabbitmq.url" "amqp://localhost:5672"
set_kv "config/development-local/course-service/port" "3004"
set_kv "config/development-local/course-service/database.url" "postgresql://user:password@localhost:5435/course_db"
set_kv "config/development-local/course-service/rabbitmq.url" "amqp://localhost:5672"
set_kv "config/development-local/notification-service/port" "3006"
set_kv "config/development-local/notification-service/database.url" "postgresql://user:password@localhost:5437/notification_db"
set_kv "config/development-local/notification-service/rabbitmq.url" "amqp://localhost:5672"
set_kv "config/development-local/analytics-service/port" "3007"
set_kv "config/development-local/analytics-service/database.url" "postgresql://user:password@localhost:5438/analytics_db"
set_kv "config/development-local/analytics-service/rabbitmq.url" "amqp://localhost:5672"
set_kv "config/development-local/simulation-service/port" "3008"
set_kv "config/development-local/simulation-service/database.url" "postgresql://user:password@localhost:5439/simulation_db"
set_kv "config/development-local/simulation-service/rabbitmq.url" "amqp://localhost:5672"
set_kv "config/development-local/docs-service/port" "3009"
set_kv "config/development-local/docs-service/swagger.services" "user-service:3002,exam-service:3003,course-service:3004,question-service:3005,notification-service:3006,analytics-service:3007,simulation-service:3008"

echo "[Consul] Configuration seeding completed"
echo "[Consul] Access Consul UI: http://localhost:8500"
