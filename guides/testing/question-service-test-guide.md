# Question Service - Hướng Dẫn Test API Chi Tiết

> Tài liệu này hướng dẫn test API của `question-service` khi gọi trực tiếp local port 3005 và khi gọi qua Kong.

---

## 1. Khởi động môi trường

### 1.1 Start infra

```bash
npm run infra:up
npm run consul:seed:local
```

Kiểm tra Consul:

```bash
curl http://localhost:8500/v1/status/leader
```

`npm run infra:up` dùng `docker-compose.infra.yml` cho hybrid mode, gồm:

- PostgreSQL databases: `5432..5440`
- RabbitMQ: `5672`, UI `15672`
- Redis: `6379`
- Consul: `8500`
- Keycloak: `8080`
- Kong dev gateway: proxy `8000`, admin `8001`
- ELK: Elasticsearch `9200`, Logstash `5044`, Kibana `5601`

Kiểm tra nhanh:

```bash
docker compose -f docker-compose.infra.yml ps
curl -s http://localhost:8001/services | jq '.data | map(.name)'
curl -s http://localhost:9200/_cluster/health | jq .
curl -I http://localhost:5601
```

Nếu chỉ muốn bật riêng ELK:

```bash
docker compose -f docker-compose.infra.yml up -d elasticsearch logstash kibana
```

### 1.2 Generate và migrate database

```bash
cd apps/question-service
npm run db:generate
npm run db:migrate
```

Nếu migration đã tồn tại:

```bash
cd apps/question-service
npm run db:deploy
```

### 1.3 Start question-service

```bash
npm run dev --filter=question-service
```

Kiểm tra:

```bash
curl http://localhost:3005/docs-json
```

Swagger UI: http://localhost:3005/docs

---

## 2. Request Flow

```
Client
  |-- DIRECT --> http://localhost:3005
  |              Tự set x-user-id khi cần audit user
  |
  |-- KONG ----> http://localhost:8000/admin/questions
                 Kong validate JWT và inject x-user-id/x-user-role
```

Trong local hybrid mode, Kong container `kong-dev` đọc `kong/kong.dev.yaml` và forward `/admin/questions` về `host.docker.internal:3005`. Vì vậy frontend/Postman nên test qua `http://localhost:8000` để giống production path hơn.

Kiểm tra Kong đã nạp route:

```bash
curl -s http://localhost:8001/routes | jq '.data[] | {name, paths}'
curl -s http://localhost:8001/services/question-service | jq .
```

Kiểm tra Swagger qua Kong:

```bash
curl -s http://localhost:8000/question-service/docs-json | jq '.info.title'
```

Kiểm tra API qua Kong:

```bash
curl -s "http://localhost:8000/admin/questions?page=1&size=5" | jq .
```

Nếu gọi qua Kong bị `502`, thử:

```bash
curl -s http://localhost:3005/docs-json | jq '.info.title'
docker logs luyen-thi-lai-xe-microservices-kong-dev-1 --tail 100
```

`502` thường có nghĩa question-service local chưa chạy ở port 3005 hoặc Kong container không reach được `host.docker.internal`.

---

## 3. Biến môi trường test

```bash
BASE="http://localhost:3005"
KONG_BASE="http://localhost:8000"
ADMIN_ID="550e8400-e29b-41d4-a716-446655440000"
```

---

## 4. Test Topic Endpoints

### 4.1 Tạo topic

```bash
TOPIC_ID=$(curl -s -X POST "$BASE/admin/questions/topics" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Biển báo giao thông",
    "description": "Câu hỏi về biển báo"
  }' | jq -r '.data.id')

echo "TOPIC_ID=$TOPIC_ID"
```

Expect `201 Created`, response có `data.id`.

Qua Kong thì đổi `$BASE` thành `$KONG_BASE`:

```bash
curl -s -X POST "$KONG_BASE/admin/questions/topics" \
  -H "Content-Type: application/json" \
  -d '{"name":"Topic via Kong"}' | jq .
```

### 4.2 List topics

```bash
curl -s "$BASE/admin/questions/topics?page=1&size=20" | jq '.data | {total, page, size}'
```

### 4.3 Get topic detail

```bash
curl -s "$BASE/admin/questions/topics/$TOPIC_ID" | jq .data
```

### 4.4 Update topic

```bash
curl -s -X PATCH "$BASE/admin/questions/topics/$TOPIC_ID" \
  -H "Content-Type: application/json" \
  -d '{"description":"Mô tả mới"}' | jq '.data.description'
```

---

## 5. Test Question Endpoints

### 5.1 Tạo question

```bash
QUESTION_ID=$(curl -s -X POST "$BASE/admin/questions" \
  -H "Content-Type: application/json" \
  -H "x-user-id: $ADMIN_ID" \
  -d "{
    \"content\": \"Khi gặp đèn đỏ, người lái xe phải làm gì?\",
    \"type\": \"THEORY\",
    \"licenseCategories\": [\"B2\"],
    \"difficulty\": \"EASY\",
    \"explanation\": \"Đèn đỏ yêu cầu dừng lại trước vạch dừng.\",
    \"mediaFileId\": null,
    \"isCritical\": false,
    \"topicId\": \"$TOPIC_ID\",
    \"options\": [
      { \"content\": \"Dừng lại\", \"isCorrect\": true, \"displayOrder\": 1 },
      { \"content\": \"Đi tiếp\", \"isCorrect\": false, \"displayOrder\": 2 }
    ]
  }" | jq -r '.data.id')

echo "QUESTION_ID=$QUESTION_ID"
```

Tạo question qua Kong:

```bash
curl -s -X POST "$KONG_BASE/admin/questions" \
  -H "Content-Type: application/json" \
  -H "x-user-id: $ADMIN_ID" \
  -d "{
    \"content\": \"Kong smoke question?\",
    \"type\": \"THEORY\",
    \"licenseCategories\": [\"B2\"],
    \"difficulty\": \"EASY\",
    \"explanation\": \"Smoke via Kong\",
    \"topicId\": \"$TOPIC_ID\",
    \"options\": [
      { \"content\": \"A\", \"isCorrect\": true, \"displayOrder\": 1 },
      { \"content\": \"B\", \"isCorrect\": false, \"displayOrder\": 2 }
    ]
  }" | jq .
```

Expect:

```bash
curl -s "$BASE/admin/questions/$QUESTION_ID" | jq '.data | {id, version, isActive, isDeleted, correct: [.options[] | select(.isCorrect == true)]}'
```

### 5.2 Validation: không có đúng 1 đáp án đúng

```bash
curl -s -X POST "$BASE/admin/questions" \
  -H "Content-Type: application/json" \
  -H "x-user-id: $ADMIN_ID" \
  -d "{
    \"content\": \"Invalid question\",
    \"type\": \"THEORY\",
    \"licenseCategories\": [\"B2\"],
    \"difficulty\": \"EASY\",
    \"explanation\": \"Invalid\",
    \"topicId\": \"$TOPIC_ID\",
    \"options\": [
      { \"content\": \"A\", \"isCorrect\": true, \"displayOrder\": 1 },
      { \"content\": \"B\", \"isCorrect\": true, \"displayOrder\": 2 }
    ]
  }" | jq .
```

Expect `400 INVALID_QUESTION`.

### 5.3 Search/list questions

```bash
curl -s "$BASE/admin/questions?licenseCategory=B2&type=THEORY&page=1&size=10" \
  | jq '.data | {total, items_count: (.items | length)}'
```

Filter booleans:

```bash
curl -s "$BASE/admin/questions?isActive=true&isCritical=false" | jq '.data.items | map({id, isActive, isCritical})'
```

### 5.4 Get question detail

```bash
curl -s "$BASE/admin/questions/$QUESTION_ID" | jq .data
```

### 5.5 Update question với version đúng

```bash
VERSION=$(curl -s "$BASE/admin/questions/$QUESTION_ID" | jq -r '.data.version')

curl -s -X PATCH "$BASE/admin/questions/$QUESTION_ID" \
  -H "Content-Type: application/json" \
  -d "{
    \"version\": $VERSION,
    \"difficulty\": \"MEDIUM\",
    \"explanation\": \"Giải thích đã cập nhật\"
  }" | jq '.data | {difficulty, explanation, version}'
```

Expect `version` tăng lên 1.

### 5.6 Version conflict

```bash
curl -s -X PATCH "$BASE/admin/questions/$QUESTION_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "version": 1,
    "content": "Update bằng version cũ"
  }' | jq .
```

Expect `409 QUESTION_VERSION_CONFLICT`.

### 5.7 Deactivate question

```bash
VERSION=$(curl -s "$BASE/admin/questions/$QUESTION_ID" | jq -r '.data.version')

curl -s -X PATCH "$BASE/admin/questions/$QUESTION_ID" \
  -H "Content-Type: application/json" \
  -d "{
    \"version\": $VERSION,
    \"isActive\": false
  }" | jq '.data | {isActive, version}'
```

Kiểm tra RabbitMQ queue `question_service_publish` có event `question.deactivated`.

### 5.8 Gắn ảnh từ media-service

Upload/initiate file qua media-service trước để lấy `mediaFileId`, sau đó tạo hoặc update question với `mediaFileId`.

```bash
MEDIA_FILE_ID="550e8400-e29b-41d4-a716-446655440001"
VERSION=$(curl -s "$BASE/admin/questions/$QUESTION_ID" | jq -r '.data.version')

curl -s -X PATCH "$BASE/admin/questions/$QUESTION_ID" \
  -H "Content-Type: application/json" \
  -d "{
    \"version\": $VERSION,
    \"mediaFileId\": \"$MEDIA_FILE_ID\"
  }" | jq '.data | {mediaFileId, version}'
```

Expect question-service publish event `question.image.linked` vào queue `media_service_events`; media-service consume event và mark FileObject `LINKED`. Question-service chỉ lưu UUID reference, không gọi trực tiếp Azure Blob.

### 5.9 Question pool

Tạo thêm question active nếu question trên đã deactivate, sau đó:

```bash
curl -s -X POST "$BASE/admin/questions/pool" \
  -H "Content-Type: application/json" \
  -d '{
    "licenseCategory": "B2",
    "size": 10,
    "type": "THEORY"
  }' | jq '.data.items | map({id, isActive, isDeleted, options})'
```

Expect chỉ trả về question `isActive=true`, `isDeleted=false`. Pool response có `options[].isCorrect` để exam-service snapshot/grade nội bộ.

Qua Kong:

```bash
curl -s -X POST "$KONG_BASE/admin/questions/pool" \
  -H "Content-Type: application/json" \
  -d '{"licenseCategory":"B2","size":5}' | jq '.data.items | length'
```

### 5.10 Soft delete question

```bash
VERSION=$(curl -s "$BASE/admin/questions/$QUESTION_ID" | jq -r '.data.version')

curl -s -X DELETE "$BASE/admin/questions/$QUESTION_ID" \
  -H "Content-Type: application/json" \
  -H "x-user-id: $ADMIN_ID" \
  -d "{\"version\": $VERSION}" | jq '.data | {isDeleted, isActive, deletedById}'
```

Expect `isDeleted=true`, `isActive=false`.

Mặc định list không trả về question đã xóa:

```bash
curl -s "$BASE/admin/questions" | jq ".data.items | map(select(.id == \"$QUESTION_ID\"))"
```

Nếu cần debug:

```bash
curl -s "$BASE/admin/questions?includeDeleted=true" | jq ".data.items | map(select(.id == \"$QUESTION_ID\"))"
```

---

## 6. Test RabbitMQ Events

RabbitMQ UI: http://localhost:15672  
Username/password: `guest` / `guest`

Queues liên quan:

- `question_service_events`: queue consume của question-service
- `question_service_publish`: queue publish domain events

Sau `POST /admin/questions`, kiểm tra `question.created`.

Sau deactivate hoặc delete, kiểm tra `question.deactivated`.

Sau create/update có `mediaFileId`, kiểm tra event `question.image.linked` trong `media_service_events` và FileObject chuyển sang `LINKED`.

---

## 7. Kiểm tra Database

### Prisma Studio

```bash
cd apps/question-service
npm run db:studio
```

Mở http://localhost:5555 và xem:

- `QuestionTopic`
- `Question`
- `QuestionOption`

### psql

```bash
psql postgresql://user:password@localhost:5436/question_db
```

```sql
SELECT id, content, type, "licenseCategories", difficulty, "isActive", "isDeleted", version
FROM questions
ORDER BY "createdAt" DESC;

SELECT id, "questionId", content, "isCorrect", "displayOrder"
FROM question_options
ORDER BY "questionId", "displayOrder";
```

---

## 8. Troubleshooting

### Prisma client chưa generate

```bash
cd apps/question-service
npm run db:generate
```

### Database chưa sẵn sàng

```bash
npm run infra:up
npm run consul:seed:local
```

### `QUESTION_TOPIC_NOT_FOUND`

Tạo topic trước khi tạo question, hoặc kiểm tra `topicId`.

### `QUESTION_VERSION_CONFLICT`

Client đang gửi version cũ. Gọi `GET /admin/questions/:id` để lấy version mới nhất rồi retry.

### Pool không có items

Kiểm tra question phải:

- `isActive=true`
- `isDeleted=false`
- có `licenseCategories` chứa license đang query
- khớp `type`, `difficulty`, `topicId` nếu có filter

---

## 9. Checklist Happy Path

```bash
BASE="http://localhost:3005"
ADMIN_ID="550e8400-e29b-41d4-a716-446655440000"

TOPIC_ID=$(curl -s -X POST "$BASE/admin/questions/topics" \
  -H "Content-Type: application/json" \
  -d '{"name":"Topic smoke"}' | jq -r '.data.id')
echo "Topic: $TOPIC_ID"

QUESTION_ID=$(curl -s -X POST "$BASE/admin/questions" \
  -H "Content-Type: application/json" \
  -H "x-user-id: $ADMIN_ID" \
  -d "{
    \"content\":\"Smoke question?\",
    \"type\":\"THEORY\",
    \"licenseCategories\":[\"B2\"],
    \"difficulty\":\"EASY\",
    \"explanation\":\"Smoke explanation\",
    \"topicId\":\"$TOPIC_ID\",
    \"options\":[
      {\"content\":\"A\",\"isCorrect\":true,\"displayOrder\":1},
      {\"content\":\"B\",\"isCorrect\":false,\"displayOrder\":2}
    ]
  }" | jq -r '.data.id')
echo "Question: $QUESTION_ID"

curl -s "$BASE/admin/questions?licenseCategory=B2" | jq '.data.total'
curl -s -X POST "$BASE/admin/questions/pool" \
  -H "Content-Type: application/json" \
  -d '{"licenseCategory":"B2","size":5}' | jq '.data.items | length'

VERSION=$(curl -s "$BASE/admin/questions/$QUESTION_ID" | jq -r '.data.version')
curl -s -X DELETE "$BASE/admin/questions/$QUESTION_ID" \
  -H "Content-Type: application/json" \
  -H "x-user-id: $ADMIN_ID" \
  -d "{\"version\": $VERSION}" | jq '.data.isDeleted'
```
