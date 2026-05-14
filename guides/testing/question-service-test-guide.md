# Question Service - Huong Dan Test API Chi Tiet

> Tai lieu nay huong dan test API cua `question-service` khi goi truc tiep local port 3005 va khi goi qua Kong.

---

## 1. Khoi dong moi truong

### 1.1 Start infra

```bash
npm run infra:up
npm run consul:seed:local
```

Kiem tra Consul:

```bash
curl http://localhost:8500/v1/status/leader
```

`npm run infra:up` dung `docker-compose.infra.yml` cho hybrid mode, gom:

- PostgreSQL databases: `5432..5440`
- RabbitMQ: `5672`, UI `15672`
- Redis: `6379`
- Consul: `8500`
- Keycloak: `8080`
- Kong dev gateway: proxy `8000`, admin `8001`
- ELK: Elasticsearch `9200`, Logstash `5044`, Kibana `5601`

Kiem tra nhanh:

```bash
docker compose -f docker-compose.infra.yml ps
curl -s http://localhost:8001/services | jq '.data | map(.name)'
curl -s http://localhost:9200/_cluster/health | jq .
curl -I http://localhost:5601
```

Neu chi muon bat rieng ELK:

```bash
docker compose -f docker-compose.infra.yml up -d elasticsearch logstash kibana
```

### 1.2 Generate va migrate database

```bash
cd apps/question-service
npm run db:generate
npm run db:migrate
```

Neu migration da ton tai:

```bash
cd apps/question-service
npm run db:deploy
```

### 1.3 Start question-service

```bash
npm run dev --filter=question-service
```

Kiem tra:

```bash
curl http://localhost:3005/docs-json
```

Swagger UI: http://localhost:3005/docs

---

## 2. Request Flow

```
Client
  |-- DIRECT --> http://localhost:3005
  |              Tu set x-user-id khi can audit user
  |
  |-- KONG ----> http://localhost:8000/questions
                 Kong validate JWT va inject x-user-id/x-user-role
```

Trong local hybrid mode, Kong container `kong-dev` doc `kong/kong.dev.yaml` va forward `/questions` ve `host.docker.internal:3005`. Vi vay frontend/Postman nen test qua `http://localhost:8000` de giong production path hon.

Kiem tra Kong da nap route:

```bash
curl -s http://localhost:8001/routes | jq '.data[] | {name, paths}'
curl -s http://localhost:8001/services/question-service | jq .
```

Kiem tra Swagger qua Kong:

```bash
curl -s http://localhost:8000/question-service/docs-json | jq '.info.title'
```

Kiem tra API qua Kong:

```bash
curl -s "http://localhost:8000/questions?page=1&size=5" | jq .
```

Neu goi qua Kong bi `502`, thu:

```bash
curl -s http://localhost:3005/docs-json | jq '.info.title'
docker logs luyen-thi-lai-xe-microservices-kong-dev-1 --tail 100
```

`502` thuong co nghia question-service local chua chay o port 3005 hoac Kong container khong reach duoc `host.docker.internal`.

---

## 3. Bien moi truong test

```bash
BASE="http://localhost:3005"
KONG_BASE="http://localhost:8000"
ADMIN_ID="550e8400-e29b-41d4-a716-446655440000"
```

---

## 4. Test Topic Endpoints

### 4.1 Tao topic

```bash
TOPIC_ID=$(curl -s -X POST "$BASE/questions/topics" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Bien bao giao thong",
    "description": "Cau hoi ve bien bao"
  }' | jq -r '.data.id')

echo "TOPIC_ID=$TOPIC_ID"
```

Expect `201 Created`, response co `data.id`.

Qua Kong thi doi `$BASE` thanh `$KONG_BASE`:

```bash
curl -s -X POST "$KONG_BASE/questions/topics" \
  -H "Content-Type: application/json" \
  -d '{"name":"Topic via Kong"}' | jq .
```

### 4.2 List topics

```bash
curl -s "$BASE/questions/topics?page=1&size=20" | jq '.data | {total, page, size}'
```

### 4.3 Get topic detail

```bash
curl -s "$BASE/questions/topics/$TOPIC_ID" | jq .data
```

### 4.4 Update topic

```bash
curl -s -X PATCH "$BASE/questions/topics/$TOPIC_ID" \
  -H "Content-Type: application/json" \
  -d '{"description":"Mo ta moi"}' | jq '.data.description'
```

---

## 5. Test Question Endpoints

### 5.1 Tao question

```bash
QUESTION_ID=$(curl -s -X POST "$BASE/questions" \
  -H "Content-Type: application/json" \
  -H "x-user-id: $ADMIN_ID" \
  -d "{
    \"content\": \"Khi gap den do, nguoi lai xe phai lam gi?\",
    \"type\": \"THEORY\",
    \"licenseCategories\": [\"B2\"],
    \"difficulty\": \"EASY\",
    \"explanation\": \"Den do yeu cau dung lai truoc vach dung.\",
    \"mediaFileId\": null,
    \"isCritical\": false,
    \"topicId\": \"$TOPIC_ID\",
    \"options\": [
      { \"content\": \"Dung lai\", \"isCorrect\": true, \"displayOrder\": 1 },
      { \"content\": \"Di tiep\", \"isCorrect\": false, \"displayOrder\": 2 }
    ]
  }" | jq -r '.data.id')

echo "QUESTION_ID=$QUESTION_ID"
```

Tao question qua Kong:

```bash
curl -s -X POST "$KONG_BASE/questions" \
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
curl -s "$BASE/questions/$QUESTION_ID" | jq '.data | {id, version, isActive, isDeleted, correct: [.options[] | select(.isCorrect == true)]}'
```

### 5.2 Validation: khong co dung 1 dap an dung

```bash
curl -s -X POST "$BASE/questions" \
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
curl -s "$BASE/questions?licenseCategory=B2&type=THEORY&page=1&size=10" \
  | jq '.data | {total, items_count: (.items | length)}'
```

Filter booleans:

```bash
curl -s "$BASE/questions?isActive=true&isCritical=false" | jq '.data.items | map({id, isActive, isCritical})'
```

### 5.4 Get question detail

```bash
curl -s "$BASE/questions/$QUESTION_ID" | jq .data
```

### 5.5 Update question voi version dung

```bash
VERSION=$(curl -s "$BASE/questions/$QUESTION_ID" | jq -r '.data.version')

curl -s -X PATCH "$BASE/questions/$QUESTION_ID" \
  -H "Content-Type: application/json" \
  -d "{
    \"version\": $VERSION,
    \"difficulty\": \"MEDIUM\",
    \"explanation\": \"Giai thich da cap nhat\"
  }" | jq '.data | {difficulty, explanation, version}'
```

Expect `version` tang len 1.

### 5.6 Version conflict

```bash
curl -s -X PATCH "$BASE/questions/$QUESTION_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "version": 1,
    "content": "Update bang version cu"
  }' | jq .
```

Expect `409 QUESTION_VERSION_CONFLICT`.

### 5.7 Deactivate question

```bash
VERSION=$(curl -s "$BASE/questions/$QUESTION_ID" | jq -r '.data.version')

curl -s -X PATCH "$BASE/questions/$QUESTION_ID" \
  -H "Content-Type: application/json" \
  -d "{
    \"version\": $VERSION,
    \"isActive\": false
  }" | jq '.data | {isActive, version}'
```

Kiem tra RabbitMQ queue `question_service_publish` co event `question.deactivated`.

### 5.8 Gan anh tu media-service

Upload/initiate file qua media-service truoc de lay `mediaFileId`, sau do tao hoac update question voi `mediaFileId`.

```bash
MEDIA_FILE_ID="550e8400-e29b-41d4-a716-446655440001"
VERSION=$(curl -s "$BASE/questions/$QUESTION_ID" | jq -r '.data.version')

curl -s -X PATCH "$BASE/questions/$QUESTION_ID" \
  -H "Content-Type: application/json" \
  -d "{
    \"version\": $VERSION,
    \"mediaFileId\": \"$MEDIA_FILE_ID\"
  }" | jq '.data | {mediaFileId, version}'
```

Expect question-service publish event `question.image.linked` vao queue `media_service_events`; media-service consume event va mark FileObject `LINKED`. Question-service chi luu UUID reference, khong goi truc tiep Azure Blob.

### 5.9 Question pool

Tao them question active neu question tren da deactivate, sau do:

```bash
curl -s -X POST "$BASE/questions/pool" \
  -H "Content-Type: application/json" \
  -d '{
    "licenseCategory": "B2",
    "size": 10,
    "type": "THEORY"
  }' | jq '.data.items | map({id, isActive, isDeleted, options})'
```

Expect chi tra ve question `isActive=true`, `isDeleted=false`. Pool response co `options[].isCorrect` de exam-service snapshot/grade noi bo.

Qua Kong:

```bash
curl -s -X POST "$KONG_BASE/questions/pool" \
  -H "Content-Type: application/json" \
  -d '{"licenseCategory":"B2","size":5}' | jq '.data.items | length'
```

### 5.10 Soft delete question

```bash
VERSION=$(curl -s "$BASE/questions/$QUESTION_ID" | jq -r '.data.version')

curl -s -X DELETE "$BASE/questions/$QUESTION_ID" \
  -H "Content-Type: application/json" \
  -H "x-user-id: $ADMIN_ID" \
  -d "{\"version\": $VERSION}" | jq '.data | {isDeleted, isActive, deletedById}'
```

Expect `isDeleted=true`, `isActive=false`.

Mac dinh list khong tra ve question da xoa:

```bash
curl -s "$BASE/questions" | jq ".data.items | map(select(.id == \"$QUESTION_ID\"))"
```

Neu can debug:

```bash
curl -s "$BASE/questions?includeDeleted=true" | jq ".data.items | map(select(.id == \"$QUESTION_ID\"))"
```

---

## 6. Test RabbitMQ Events

RabbitMQ UI: http://localhost:15672  
Username/password: `guest` / `guest`

Queues lien quan:

- `question_service_events`: queue consume cua question-service
- `question_service_publish`: queue publish domain events

Sau `POST /questions`, kiem tra `question.created`.

Sau deactivate hoac delete, kiem tra `question.deactivated`.

Sau create/update co `mediaFileId`, kiem tra event `question.image.linked` trong `media_service_events` va FileObject chuyen sang `LINKED`.

---

## 7. Kiem tra Database

### Prisma Studio

```bash
cd apps/question-service
npm run db:studio
```

Mo http://localhost:5555 va xem:

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

### Prisma client chua generate

```bash
cd apps/question-service
npm run db:generate
```

### Database chua san sang

```bash
npm run infra:up
npm run consul:seed:local
```

### `QUESTION_TOPIC_NOT_FOUND`

Tao topic truoc khi tao question, hoac kiem tra `topicId`.

### `QUESTION_VERSION_CONFLICT`

Client dang gui version cu. Goi `GET /questions/:id` de lay version moi nhat roi retry.

### Pool khong co items

Kiem tra question phai:

- `isActive=true`
- `isDeleted=false`
- co `licenseCategories` chua license dang query
- khop `type`, `difficulty`, `topicId` neu co filter

---

## 9. Checklist Happy Path

```bash
BASE="http://localhost:3005"
ADMIN_ID="550e8400-e29b-41d4-a716-446655440000"

TOPIC_ID=$(curl -s -X POST "$BASE/questions/topics" \
  -H "Content-Type: application/json" \
  -d '{"name":"Topic smoke"}' | jq -r '.data.id')
echo "Topic: $TOPIC_ID"

QUESTION_ID=$(curl -s -X POST "$BASE/questions" \
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

curl -s "$BASE/questions?licenseCategory=B2" | jq '.data.total'
curl -s -X POST "$BASE/questions/pool" \
  -H "Content-Type: application/json" \
  -d '{"licenseCategory":"B2","size":5}' | jq '.data.items | length'

VERSION=$(curl -s "$BASE/questions/$QUESTION_ID" | jq -r '.data.version')
curl -s -X DELETE "$BASE/questions/$QUESTION_ID" \
  -H "Content-Type: application/json" \
  -H "x-user-id: $ADMIN_ID" \
  -d "{\"version\": $VERSION}" | jq '.data.isDeleted'
```
