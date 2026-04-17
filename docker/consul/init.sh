#!/bin/bash
# Consul Bootstrap Script
# Waits for Consul to be ready, then seeds configuration KV store

set -e

CONSUL_URL="${CONSUL_URL:-http://consul:8500}"
MAX_RETRIES=30
RETRY_COUNT=0

echo "[Consul] Waiting for Consul to be ready..."

# Wait for Consul to be ready
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if curl -s "$CONSUL_URL/v1/status/leader" > /dev/null 2>&1; then
    echo "[Consul] ✓ Consul is ready!"
    break
  fi
  RETRY_COUNT=$((RETRY_COUNT + 1))
  echo "[Consul] Waiting... (attempt $RETRY_COUNT/$MAX_RETRIES)"
  sleep 1
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
  echo "[Consul] ✗ Consul failed to become ready"
  exit 1
fi

echo "[Consul] Seeding configuration KV store..."

# Helper function to set KV value
set_kv() {
  local key=$1
  local value=$2
  echo "[Consul] Setting: $key = $value"
  curl -s -X PUT -d "$value" "$CONSUL_URL/v1/kv/$key" > /dev/null
}

# ========== DEVELOPMENT CONFIGURATION ==========
echo "[Consul] Loading DEVELOPMENT configuration..."

# Shared configuration
set_kv "config/development/shared/log.level" "debug"
set_kv "config/development/shared/log.format" "text"
set_kv "config/development/shared/node_env" "development"

# Identity Service
set_kv "config/development/identity-service/port" "3000"
set_kv "config/development/identity-service/database.url" "postgresql://user:password@db-identity:5432/identity_db"
set_kv "config/development/identity-service/database.pool_size" "10"
set_kv "config/development/identity-service/database.connection_timeout" "5000"
set_kv "config/development/identity-service/rabbitmq.url" "amqp://rabbitmq:5672"
set_kv "config/development/identity-service/rabbitmq.username" "guest"
set_kv "config/development/identity-service/rabbitmq.password" "guest"
set_kv "config/development/identity-service/rabbitmq.vhost" "/"

# User Service
set_kv "config/development/user-service/port" "3000"
set_kv "config/development/user-service/database.url" "postgresql://user:password@db-user:5432/user_db"
set_kv "config/development/user-service/rabbitmq.url" "amqp://rabbitmq:5672"

# Exam Service
set_kv "config/development/exam-service/port" "3000"
set_kv "config/development/exam-service/database.url" "postgresql://user:password@db-exam:5432/exam_db"
set_kv "config/development/exam-service/rabbitmq.url" "amqp://rabbitmq:5672"

# Question Service
set_kv "config/development/question-service/port" "3000"
set_kv "config/development/question-service/database.url" "postgresql://user:password@db-question:5432/question_db"
set_kv "config/development/question-service/rabbitmq.url" "amqp://rabbitmq:5672"

# Course Service
set_kv "config/development/course-service/port" "3000"
set_kv "config/development/course-service/database.url" "postgresql://user:password@db-course:5432/course_db"
set_kv "config/development/course-service/rabbitmq.url" "amqp://rabbitmq:5672"

# Notification Service
set_kv "config/development/notification-service/port" "3000"
set_kv "config/development/notification-service/database.url" "postgresql://user:password@db-notification:5432/notification_db"
set_kv "config/development/notification-service/rabbitmq.url" "amqp://rabbitmq:5672"

# Analytics Service
set_kv "config/development/analytics-service/port" "3000"
set_kv "config/development/analytics-service/database.url" "postgresql://user:password@db-analytics:5432/analytics_db"
set_kv "config/development/analytics-service/rabbitmq.url" "amqp://rabbitmq:5672"

# Simulation Service
set_kv "config/development/simulation-service/port" "3000"
set_kv "config/development/simulation-service/database.url" "postgresql://user:password@db-simulation:5432/simulation_db"
set_kv "config/development/simulation-service/rabbitmq.url" "amqp://rabbitmq:5672"

echo "[Consul] ✓ Configuration seeding completed!"
echo "[Consul] Access Consul UI: http://localhost:8500"
