
<!-- Merged from docs/devops/system-resilience-guide.md -->
# HTTP Client Resilience

TÃ i liá»‡u nÃ y mÃ´ táº£ chuáº©n timeout, retry vÃ  circuit breaker cho cÃ¡c lá»i gá»i HTTP Ä‘á»“ng bá»™ quan trá»ng.

## Má»¥c tiÃªu

- Má»i lá»i gá»i HTTP ná»™i bá»™ hoáº·c external quan trá»ng pháº£i cÃ³ timeout rÃµ rÃ ng.
- Lá»—i táº¡m thá»i Ä‘Æ°á»£c retry cÃ³ giá»›i háº¡n, khÃ´ng retry vÃ´ háº¡n.
- Khi dependency lá»—i liÃªn tá»¥c, circuit breaker má»Ÿ táº¡m thá»i Ä‘á»ƒ trÃ¡nh kÃ©o sáº­p service gá»i.

## Shared Helper

Logic dÃ¹ng chung náº±m trong:

```text
packages/common/src/http/resilient-http-client.ts
```

CÃ¡c API chÃ­nh:

- `resilientFetch()`: wrapper cho `fetch`, há»— trá»£ timeout, retry vÃ  circuit breaker.
- `configureAxiosResilience()`: cáº¥u hÃ¬nh timeout, retry vÃ  circuit breaker cho `AxiosInstance` cá»§a Nest `HttpService`.

Máº·c Ä‘á»‹nh:

| Cáº¥u hÃ¬nh | GiÃ¡ trá»‹ |
| -------- | ------- |
| Timeout | `3000ms` |
| Retry | `2` láº§n |
| Initial backoff | `200ms` |
| Backoff factor | `2` |
| Circuit failure threshold | `5` lá»—i liÃªn tiáº¿p |
| Circuit open window | `30000ms` |

Retry chá»‰ Ã¡p dá»¥ng cho lá»—i network, timeout, HTTP `408`, `429` vÃ  `5xx`. KhÃ´ng retry lá»—i nghiá»‡p vá»¥ `4xx`.

## ÄÃ£ Ã¡p dá»¥ng

CÃ¡c sync call quan trá»ng Ä‘Ã£ dÃ¹ng resilience layer:

| Service | Dependency | CÃ¡ch Ã¡p dá»¥ng |
| ------- | ---------- | ------------ |
| `exam-service` | `question-service` | `resilientFetch()` khi láº¥y question pool |
| `exam-service` | `user-service` | `resilientFetch()` khi láº¥y student profile |
| `exam-service` | `Keycloak` | `resilientFetch()` khi láº¥y service token |
| `identity-service` | `Keycloak` | `resilientFetch()` khi láº¥y public key JWT |
| `identity-service` | `Keycloak Admin API` | `configureAxiosResilience()` cho Nest `HttpService` |

## Quy Æ°á»›c má»Ÿ rá»™ng

Khi thÃªm HTTP client má»›i:

1. KhÃ´ng gá»i `fetch()` hoáº·c `HttpService` trá»±c tiáº¿p náº¿u dependency náº±m ngoÃ i process hiá»‡n táº¡i.
2. DÃ¹ng `resilientFetch()` cho code dÃ¹ng `fetch`.
3. DÃ¹ng `configureAxiosResilience()` má»™t láº§n cho `HttpService.axiosRef` náº¿u dÃ¹ng Axios.
4. Äáº·t `dependencyName` theo service tháº­t Ä‘á»ƒ log/circuit tÃ¡ch biá»‡t.
5. Chá»‰ tÄƒng retry khi operation idempotent hoáº·c backend chá»‹u Ä‘Æ°á»£c retry.



<!-- Merged from docs/devops/system-resilience-guide.md -->
# RabbitMQ Resilience, DLQ, Retry vÃ  Backoff

TÃ i liá»‡u nÃ y mÃ´ táº£ pháº§n gia cá»‘ RabbitMQ Ä‘á»ƒ message lá»—i khÃ´ng lÃ m sáº­p toÃ n bá»™ luá»“ng xá»­ lÃ½.

## Má»¥c tiÃªu

- Má»—i consumer queue cÃ³ má»™t Dead Letter Queue Ä‘á»ƒ há»©ng message lá»—i cuá»‘i cÃ¹ng.
- Message lá»—i khÃ´ng bá»‹ retry vÃ´ háº¡n trong queue chÃ­nh.
- Retry dÃ¹ng backoff theo cÃ¡c retry queue cÃ³ TTL: `5s -> 30s -> 120s`.
- Sau khi vÆ°á»£t quÃ¡ sá»‘ láº§n retry, message Ä‘Æ°á»£c Ä‘Æ°a vÃ o DLQ Ä‘á»ƒ váº­n hÃ nh kiá»ƒm tra hoáº·c replay thá»§ cÃ´ng.
- Consumer dÃ¹ng `noAck: false` vÃ  ack message theo káº¿t quáº£ xá»­ lÃ½.
- Consumer cÃ³ lá»›p idempotency theo `messageId`, `eventId` hoáº·c `metadata.eventId` Ä‘á»ƒ trÃ¡nh xá»­ lÃ½ trÃ¹ng trong retry/redelivery.
- Prometheus/Grafana theo dÃµi retry, DLQ vÃ  RabbitMQ queue depth.
- Alertmanager cáº£nh bÃ¡o khi DLQ cÃ³ message hoáº·c retry backlog tÄƒng cao.

## RabbitMQ Topology

Vá»›i queue chÃ­nh `<service>_service_events`, há»‡ thá»‘ng táº¡o thÃªm:

| ThÃ nh pháº§n | TÃªn queue |
| ---------- | --------- |
| Queue chÃ­nh | `<service>_service_events` |
| Retry láº§n 1 | `<service>_service_events.retry.1` |
| Retry láº§n 2 | `<service>_service_events.retry.2` |
| Retry láº§n 3 | `<service>_service_events.retry.3` |
| Dead Letter Queue | `<service>_service_events.dlq` |

VÃ­ dá»¥ vá»›i `user-service`:

```text
user_service_events
user_service_events.retry.1
user_service_events.retry.2
user_service_events.retry.3
user_service_events.dlq
```

## Retry vÃ  Backoff

```text
Message -> queue chÃ­nh -> handler
  -> thÃ nh cÃ´ng: ack
  -> lá»—i láº§n 1: publish sang .retry.1, ack message gá»‘c
  -> retry.1 háº¿t TTL 5s: RabbitMQ dead-letter vá» queue chÃ­nh
  -> lá»—i láº§n 2: publish sang .retry.2, ack message gá»‘c
  -> retry.2 háº¿t TTL 30s: RabbitMQ dead-letter vá» queue chÃ­nh
  -> lá»—i láº§n 3: publish sang .retry.3, ack message gá»‘c
  -> retry.3 háº¿t TTL 120s: RabbitMQ dead-letter vá» queue chÃ­nh
  -> lá»—i sau retry láº§n 3: publish sang .dlq, ack message gá»‘c
```

CÃ¡c header Ä‘Æ°á»£c gáº¯n thÃªm khi retry/DLQ:

| Header | Ã nghÄ©a |
| ------ | ------- |
| `x-original-queue` | Queue chÃ­nh ban Ä‘áº§u |
| `x-retry-count` | Sá»‘ láº§n retry Ä‘Ã£ thá»±c hiá»‡n |
| `x-last-error` | Lá»—i gáº§n nháº¥t |
| `x-failed-at` | Thá»i Ä‘iá»ƒm lá»—i gáº§n nháº¥t |
| `x-correlation-id` | MÃ£ truy váº¿t request/event náº¿u cÃ³ |

## Shared Resilience Module

Logic RabbitMQ resilience náº±m trong `@repo/common`:

```text
packages/common/src/messaging/rabbitmq-resilience.ts
```

CÃ¡c helper chÃ­nh:

- `assertRabbitMqResilienceTopology()`: táº¡o queue chÃ­nh, retry queues vÃ  DLQ khi service khá»Ÿi Ä‘á»™ng.
- `createRabbitMqConsumerOptions()`: cáº¥u hÃ¬nh RMQ consumer vá»›i `noAck: false`, durable queue vÃ  DLQ routing.
- `createRabbitMqClientOptions()`: cáº¥u hÃ¬nh RMQ producer thá»‘ng nháº¥t vá»›i consumer Ä‘á»ƒ trÃ¡nh lá»‡ch queue arguments.
- `RabbitMqRetryInterceptor`: ack message thÃ nh cÃ´ng, hoáº·c chuyá»ƒn message lá»—i sang retry queue/DLQ.

Consumer thÃ nh cÃ´ng sáº½ Ä‘Æ°á»£c `ack`. Consumer lá»—i sáº½ Ä‘Æ°á»£c publish sang retry queue hoáº·c DLQ rá»“i `ack` message gá»‘c Ä‘á»ƒ trÃ¡nh loop vÃ´ háº¡n trong queue chÃ­nh.

Interceptor cÅ©ng lÆ°u khÃ³a idempotency thÃ nh cÃ´ng trong memory TTL 24 giá». Náº¿u RabbitMQ gá»­i láº¡i cÃ¹ng message trong cá»­a sá»• nÃ y, service sáº½ `ack` vÃ  bá» qua handler Ä‘á»ƒ khÃ´ng táº¡o side effect trÃ¹ng láº·p. KhÃ³a Æ°u tiÃªn theo thá»© tá»±: AMQP `messageId`, payload `eventId`, payload `id`, `metadata.eventId`.

LÆ°u Ã½: cÆ¡ cháº¿ nÃ y chá»‘ng duplicate trong pháº¡m vi instance Ä‘ang cháº¡y. Náº¿u cáº§n exactly-once bá»n vá»¯ng qua restart, tá»«ng service nÃªn bá»• sung báº£ng processed-message riÃªng hoáº·c unique constraint nghiá»‡p vá»¥.

## Service Rollout

- `user-service`
- `course-service`
- `exam-service`
- `question-service`
- `analytics-service`
- `notification-service`
- `media-service`
- `audit-service`

`identity-service` lÃ  producer, khÃ´ng consume RabbitMQ event trong `main.ts`, nhÆ°ng producer client cÅ©ng dÃ¹ng `createRabbitMqClientOptions()`.

CÃ¡c handler cÅ© cÃ³ `try/catch` Ä‘Ã£ Ä‘Æ°á»£c chá»‰nh Ä‘á»ƒ log lá»—i rá»“i `throw` láº¡i. Náº¿u handler nuá»‘t lá»—i, interceptor khÃ´ng thá»ƒ Ä‘Æ°a message vÃ o retry queue hoáº·c DLQ.

## Metrics, Dashboard vÃ  Alert

App metrics expose qua `/metrics`:

| Metric | Ã nghÄ©a |
| ------ | ------- |
| `rabbitmq_messages_processed_total` | Tá»•ng message RabbitMQ theo `queue` vÃ  `outcome` (`success`, `retry`, `dlq`) |
| `rabbitmq_message_retries_total` | Tá»•ng message Ä‘Æ°á»£c Ä‘Æ°a vÃ o retry queue |
| `rabbitmq_messages_dead_lettered_total` | Tá»•ng message Ä‘Æ°á»£c Ä‘Æ°a vÃ o DLQ |

RabbitMQ queue depth láº¥y tá»« RabbitMQ Prometheus plugin:

```text
http://localhost:15692/metrics
```

Prometheus scrape thÃªm job `rabbitmq`. Grafana dashboard `Microservices Observability` cÃ³ thÃªm:

- `RabbitMQ Retry and DLQ Rate`
- `RabbitMQ Retry and DLQ Queue Depth`

Alert Ä‘Ã£ cáº¥u hÃ¬nh:

| Alert | Äiá»u kiá»‡n |
| ----- | --------- |
| `RabbitMqDlqHasMessages` | CÃ³ message trong queue `.dlq` hÆ¡n 2 phÃºt |
| `RabbitMqRetryBacklogHigh` | Queue `.retry.*` cÃ³ hÆ¡n 50 message trong 5 phÃºt |
| `RabbitMqMessagesDeadLettered` | Service Ä‘Æ°a message vÃ o DLQ trong 5 phÃºt gáº§n nháº¥t |
| `RabbitMqRetryRateHigh` | Retry rate vÆ°á»£t 0.2 msg/s trong 5 phÃºt |

## Smoke Test vÃ  Runbook

Sau khi cháº¡y infra vÃ  services:

```bash
npm run rabbitmq:smoke
```

Script kiá»ƒm tra:

- RabbitMQ Management API hoáº¡t Ä‘á»™ng.
- RabbitMQ Prometheus plugin expose metric `rabbitmq_queue_messages_ready`.
- Má»—i consumer queue cÃ³ Ä‘á»§ queue chÃ­nh, `.retry.1`, `.retry.2`, `.retry.3` vÃ  `.dlq`.

Biáº¿n mÃ´i trÆ°á»ng tÃ¹y chá»‰nh:

| Biáº¿n | Máº·c Ä‘á»‹nh |
| ---- | -------- |
| `RABBITMQ_MANAGEMENT_URL` | `http://localhost:15672` |
| `RABBITMQ_PROMETHEUS_URL` | `http://localhost:15692` |
| `RABBITMQ_MANAGEMENT_USER` | `guest` |
| `RABBITMQ_MANAGEMENT_PASSWORD` | `guest` |
| `RABBITMQ_CONSUMER_QUEUES` | Danh sÃ¡ch queue service máº·c Ä‘á»‹nh |

## LÆ°u Ã½ váº­n hÃ nh

RabbitMQ khÃ´ng cho sá»­a argument cá»§a queue Ä‘Ã£ tá»“n táº¡i. Náº¿u mÃ´i trÆ°á»ng local Ä‘Ã£ tá»«ng táº¡o queue cÅ© khÃ´ng cÃ³ DLQ arguments, cáº§n xÃ³a queue cÅ© hoáº·c reset RabbitMQ volume trÆ°á»›c khi cháº¡y láº¡i.

Trong local cÃ³ thá»ƒ lÃ m nhanh báº±ng RabbitMQ UI:

```text
http://localhost:15672
```

Sau Ä‘Ã³ kiá»ƒm tra tab `Queues` Ä‘á»ƒ tháº¥y cÃ¡c queue `.retry.1`, `.retry.2`, `.retry.3` vÃ  `.dlq`.

KhÃ´ng purge DLQ khi chÆ°a Ä‘iá»u tra lá»—i vÃ¬ DLQ lÃ  báº±ng chá»©ng váº­n hÃ nh Ä‘á»ƒ truy váº¿t theo `x-correlation-id`.

## Replay DLQ thá»§ cÃ´ng

Quy trÃ¬nh an toÃ n:

1. Má»Ÿ RabbitMQ UI vÃ  xÃ¡c Ä‘á»‹nh queue `.dlq`.
2. Láº¥y message máº«u, kiá»ƒm tra `x-last-error`, `x-retry-count`, `x-correlation-id`.
3. TÃ¬m log cÃ¹ng `x-correlation-id` trong Kibana Ä‘á»ƒ xÃ¡c Ä‘á»‹nh lá»—i gá»‘c.
4. Sá»­a lá»—i code/config/data trÆ°á»›c khi replay.
5. Publish láº¡i payload sang queue chÃ­nh tÆ°Æ¡ng á»©ng.
6. Chá»‰ purge DLQ sau khi Ä‘Ã£ xÃ¡c nháº­n message Ä‘Æ°á»£c xá»­ lÃ½ thÃ nh cÃ´ng hoáº·c khÃ´ng cÃ²n giÃ¡ trá»‹ nghiá»‡p vá»¥.


