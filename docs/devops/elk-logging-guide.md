
<!-- Merged from DEV-WORKFLOW-ELK.md -->
# Quy trÃ¬nh lÃ m viá»‡c vá»›i ELK Stack cho Developer

TÃ i liá»‡u nÃ y hÆ°á»›ng dáº«n chi tiáº¿t cÃ¡ch Ä‘á»™i ngÅ© phÃ¡t triá»ƒn (Dev Team) sá»­ dá»¥ng há»‡ thá»‘ng ELK Stack Ä‘á»ƒ theo dÃµi, debug vÃ  quáº£n lÃ½ log hiá»‡u quáº£ trong quÃ¡ trÃ¬nh phÃ¡t triá»ƒn Microservices.

---

## 1. Äá»‹a chá»‰ truy cáº­p há»‡ thá»‘ng

Há»‡ thá»‘ng Logging táº­p trung Ä‘Æ°á»£c quáº£n lÃ½ qua giao diá»‡n **Kibana**:

- **URL**: [http://localhost:5601](http://localhost:5601)
- **Menu chÃ­nh**: Nháº¥n biá»ƒu tÆ°á»£ng 3 gáº¡ch ngang (gÃ³c trÃªn bÃªn trÃ¡i) -> **Analytics** -> **Discover**. ÄÃ¢y lÃ  nÆ¡i báº¡n sáº½ dÃ nh 90% thá»i gian Ä‘á»ƒ xem log.

---

## 2. TÃ¬m kiáº¿m vÃ  Lá»c Log (KQL - Kibana Query Language)

Táº¡i Ã´ tÃ¬m kiáº¿m á»Ÿ trÃªn cÃ¹ng, báº¡n hÃ£y sá»­ dá»¥ng cÃ¡c cÃ¢u lá»‡nh sau Ä‘á»ƒ lá»c dá»¯ liá»‡u nhanh chÃ³ng thay vÃ¬ Ä‘á»c báº±ng máº¯t:

### CÃ¡c vÃ­ dá»¥ tÃ¬m kiáº¿m thÃ´ng dá»¥ng:

| Má»¥c Ä‘Ã­ch                         | CÃ¢u lá»‡nh KQL                                             |
| :------------------------------- | :------------------------------------------------------- |
| **Lá»c theo Service**             | `context : "Identity controller"`                        |
| **Lá»c theo má»©c Ä‘á»™ (Level)**      | `level : "error"` hoáº·c `level : "warn"`                  |
| **TÃ¬m lá»—i trong Service cá»¥ thá»ƒ** | `level : "error" AND context : "Identity controller"`    |
| **TÃ¬m theo ná»™i dung tin nháº¯n**   | `message : "login"` (tÃ¬m cÃ¡c log cÃ³ chá»©a chá»¯ login)      |
| **TÃ¬m theo dá»¯ liá»‡u cáº¥u trÃºc**    | `userId : 123` (Náº¿u báº¡n ghi log dáº¡ng object chá»©a userId) |

> **Máº¹o**: Sá»­ dá»¥ng dáº¥u `*` Ä‘á»ƒ tÃ¬m kiáº¿m tÆ°Æ¡ng Ä‘á»‘i, vÃ­ dá»¥ `message : *auth*` sáº½ tÃ¬m táº¥t cáº£ log cÃ³ tá»« "auth".

---

## 3. Quy trÃ¬nh Debug lá»—i (Workflow)

Khi má»™t tÃ­nh nÄƒng gáº·p lá»—i hoáº·c báº¡n muá»‘n kiá»ƒm tra luá»“ng dá»¯ liá»‡u, hÃ£y lÃ m theo cÃ¡c bÆ°á»›c sau:

### BÆ°á»›c 1: Ghi log cÃ³ cáº¥u trÃºc trong Code

Thay vÃ¬ ghi log dáº¡ng text thuáº§n tÃºy, hÃ£y truyá»n thÃªm má»™t Object chá»©a cÃ¡c thÃ´ng tin quan trá»ng (ID, Request body, v.v.).

```typescript
this.logger.error({
  message: "Lá»—i khi xá»­ lÃ½ Ä‘Äƒng nháº­p",
  userId: user.id,
  ip: request.ip,
  errorDetail: error.message,
});
```

### BÆ°á»›c 2: Thá»±c hiá»‡n hÃ nh Ä‘á»™ng trÃªn App

Cháº¡y API hoáº·c thao tÃ¡c trÃªn UI Ä‘á»ƒ kÃ­ch hoáº¡t dÃ²ng log Ä‘Ã³.

### BÆ°á»›c 3: Kiá»ƒm tra trÃªn Kibana Discover

- Nháº¥n **Refresh** (gÃ³c trÃªn bÃªn pháº£i).
- TÃ¬m dÃ²ng log má»›i nháº¥t. Nháº¥n vÃ o biá»ƒu tÆ°á»£ng **má»Ÿ rá»™ng (>)** á»Ÿ Ä‘áº§u dÃ²ng log Ä‘á»ƒ xem toÃ n bá»™ dá»¯ liá»‡u dÆ°á»›i dáº¡ng JSON.
- Kibana sáº½ tá»± Ä‘á»™ng tÃ¡ch `userId`, `ip`, `errorDetail` thÃ nh cÃ¡c trÆ°á»ng riÃªng biá»‡t Ä‘á»ƒ báº¡n dá»… nhÃ¬n.

---

## 4. CÃ¡c quy táº¯c chung cho Team (Standardization)

Äá»ƒ há»‡ thá»‘ng log thá»±c sá»± há»¯u Ã­ch, toÃ n bá»™ team cáº§n thá»‘ng nháº¥t cÃ¡c quy táº¯c sau:

1. **Sá»­ dá»¥ng Logger chung**: Tuyá»‡t Ä‘á»‘i khÃ´ng dÃ¹ng `console.log()`. HÃ£y sá»­ dá»¥ng `private readonly logger = new Logger(ContextName.name)` cá»§a NestJS.
2. **Chá»n Ä‘Ãºng Log Level**:
   - `Error`: Há»‡ thá»‘ng gáº·p sá»± cá»‘ khÃ´ng thá»ƒ tiáº¿p tá»¥c (VD: Máº¥t káº¿t ná»‘i DB).
   - `Warn`: Sá»± cá»‘ nháº¹, há»‡ thá»‘ng váº«n cháº¡y nhÆ°ng cáº§n lÆ°u Ã½ (VD: Sai máº­t kháº©u quÃ¡ nhiá»u láº§n).
   - `Log/Info`: CÃ¡c sá»± kiá»‡n bÃ¬nh thÆ°á»ng (VD: Khá»Ÿi Ä‘á»™ng service thÃ nh cÃ´ng).
   - `Debug`: CÃ¡c thÃ´ng tin chi tiáº¿t phá»¥c vá»¥ quÃ¡ trÃ¬nh phÃ¡t triá»ƒn (VD: Request payload).
3. **Log Object thay vÃ¬ String**: ELK máº¡nh nháº¥t á»Ÿ kháº£ nÄƒng phÃ¢n tÃ­ch dá»¯ liá»‡u cáº¥u trÃºc. HÃ£y luÃ´n cá»‘ gáº¯ng log dÆ°á»›i dáº¡ng `{ message: string, data: object }`.

---

## 5. Sá»­ dá»¥ng Dashboard (GiÃ¡m sÃ¡t tá»•ng quan)

NgoÃ i viá»‡c xem log chi tiáº¿t, báº¡n cÃ³ thá»ƒ vÃ o má»¥c **Dashboard** Ä‘á»ƒ:

- Theo dÃµi biá»ƒu Ä‘á»“ sá»‘ lÆ°á»£ng Request theo thá»i gian.
- Xem tá»· lá»‡ pháº§n trÄƒm cÃ¡c lá»—i (Error vs Info).
- Thá»‘ng kÃª cÃ¡c API bá»‹ gá»i lá»—i nhiá»u nháº¥t.

---

## 6. LÆ°u Ã½ vá» tÃ i nguyÃªn (Resource)

ELK Stack (Ä‘áº·c biá»‡t lÃ  Elasticsearch) tiÃªu tá»‘n khÃ¡ nhiá»u RAM.

- **Náº¿u mÃ¡y bá»‹ lag**: HÃ£y táº¡m dá»«ng ELK báº±ng lá»‡nh `docker-compose stop elasticsearch logstash kibana`.
- **Dá»n dáº¹p dá»¯ liá»‡u**: Äá»‹nh ká»³, Elasticsearch sáº½ táº¡o nhiá»u Index hÃ ng ngÃ y. Náº¿u á»• cá»©ng bá»‹ Ä‘áº§y, báº¡n cÃ³ thá»ƒ vÃ o **Stack Management** > **Index Management** Ä‘á»ƒ xÃ³a cÃ¡c index cÅ©.

---

_TÃ i liá»‡u nÃ y Ä‘Æ°á»£c táº¡o tá»± Ä‘á»™ng Ä‘á»ƒ há»— trá»£ quy trÃ¬nh phÃ¡t triá»ƒn dá»± Ã¡n._



<!-- Merged from docs/devops/elk-logging-guide.md -->
# Observability - Logging, ELK, Correlation ID, Metrics vÃ  Alerting

TÃ i liá»‡u nÃ y mÃ´ táº£ pháº§n logging táº­p trung báº±ng ELK, truy váº¿t request báº±ng Correlation ID, thu tháº­p metrics báº±ng Prometheus/Grafana, route cáº£nh bÃ¡o báº±ng Alertmanager vÃ  smoke test/runbook váº­n hÃ nh.

## Má»¥c tiÃªu

- CÃ¡c NestJS service dÃ¹ng `AppLoggerModule` tá»« `@repo/common`.
- Log Ä‘Æ°á»£c enrich tá»‘i thiá»ƒu báº±ng `serviceName`, `environment`, `logType`, `timestamp`.
- Access log cÃ³ thÃªm `correlationId`, `method`, `path`, `statusCode`, `latencyMs`, `actorId`, `ipAddress`, `userAgent`.
- Logstash nháº­n log qua HTTP `5044`, parse JSON vÃ  Ä‘áº©y vÃ o Elasticsearch index `microservices-logs-*`.
- Kibana dÃ¹ng Ä‘á»ƒ tÃ¬m log theo service, level, `logType` hoáº·c `correlationId`.
- Kong nháº­n hoáº·c tá»± táº¡o `x-correlation-id`, forward xuá»‘ng service vÃ  echo láº¡i response.
- Correlation ID Ä‘Æ°á»£c giá»¯ trong request context báº±ng `AsyncLocalStorage`, tá»± Ä‘i vÃ o application log vÃ  RabbitMQ event payload.
- Má»—i service expose endpoint `/metrics` theo Ä‘á»‹nh dáº¡ng Prometheus.
- Prometheus scrape CPU, RAM, request rate, tá»· lá»‡ lá»—i vÃ  latency tá»« cÃ¡c service.
- Grafana tá»± provision datasource Prometheus vÃ  dashboard `Microservices Observability`.
- Prometheus rule cáº£nh bÃ¡o khi service down, tá»· lá»‡ lá»—i 5xx cao, latency cao, CPU/RAM cao.
- Alertmanager nháº­n cáº£nh bÃ¡o tá»« Prometheus, gom nhÃ³m vÃ  route tá»›i webhook váº­n hÃ nh.
- CÃ³ script `npm run observability:smoke` Ä‘á»ƒ kiá»ƒm tra nhanh Prometheus, Alertmanager, Grafana, Elasticsearch, Kibana vÃ  endpoint metrics.

## ThÃ nh pháº§n

| ThÃ nh pháº§n | Vai trÃ² | URL local |
| --- | --- | --- |
| `AppLoggerModule` | Winston logger chung cho service | N/A |
| `Logstash` | Nháº­n JSON log qua HTTP vÃ  forward sang Elasticsearch | `http://localhost:5044` |
| `Elasticsearch` | LÆ°u log táº­p trung | `http://localhost:9200` |
| `Kibana` | Truy váº¥n vÃ  visualize log | `http://localhost:5601` |
| `Prometheus` | Thu tháº­p metrics tá»« `/metrics` cá»§a service | `http://localhost:9090` |
| `Alertmanager` | Gom nhÃ³m, chá»‘ng trÃ¹ng láº·p vÃ  route cáº£nh bÃ¡o | `http://localhost:9093` |
| `Grafana` | Dashboard metrics vÃ  tráº¡ng thÃ¡i cáº£nh bÃ¡o | `http://localhost:30000` |

## Luá»“ng log

```text
NestJS service
  -> AppLoggerModule / Winston HTTP transport
  -> Logstash HTTP input :5044
  -> Elasticsearch index microservices-logs-YYYY.MM.dd
  -> Kibana Discover / Dashboard
```

## Luá»“ng Correlation ID

```text
Client
  -> Kong correlation-id plugin
  -> x-correlation-id header
  -> CorrelationIdMiddleware / CorrelationIdInterceptor
  -> AsyncLocalStorage context
  -> application log + access log + audit event
  -> RabbitMQ event payload correlationId
  -> downstream service log cÃ¹ng correlationId
```

Quy táº¯c:

- Náº¿u client gá»­i `x-correlation-id`, há»‡ thá»‘ng giá»¯ nguyÃªn ID Ä‘Ã³.
- Náº¿u client khÃ´ng gá»­i, Kong táº¡o ID má»›i vÃ  service fallback tá»± táº¡o ID náº¿u request khÃ´ng Ä‘i qua Kong.
- Response luÃ´n cÃ³ header `x-correlation-id`.
- Log trong cÃ¹ng HTTP request hoáº·c message handler cÃ³ cÃ¹ng `correlationId`.
- Event publish qua RabbitMQ Ä‘Æ°á»£c enrich thÃªm field `correlationId` Ä‘á»ƒ service nháº­n cÃ³ thá»ƒ tiáº¿p tá»¥c trace.

## Luá»“ng metrics

```text
NestJS service
  -> MetricsModule / prom-client
  -> GET /metrics
  -> Prometheus scrape má»—i 15 giÃ¢y
  -> Prometheus alert rules
  -> Alertmanager notification routing
  -> Grafana dashboard / Alertmanager UI
```

Metrics chÃ­nh:

- `http_requests_total`: tá»•ng sá»‘ HTTP request theo `service`, `method`, `route`, `status_code`, `status_class`.
- `http_request_duration_seconds`: histogram latency HTTP Ä‘á»ƒ tÃ­nh p95/p99.
- `nodejs_process_cpu_seconds_total`: CPU process Node.js.
- `nodejs_process_resident_memory_bytes`: RAM process Node.js.
- `up`: tráº¡ng thÃ¡i Prometheus scrape target.

Endpoint `/metrics` khÃ´ng bá»‹ wrap bá»Ÿi `ApiResponseInterceptor` vÃ¬ Prometheus cáº§n plain text.

## Cháº¡y local

Hybrid mode:

```powershell
npm.cmd run infra:up
npm.cmd run dev
```

`scripts/dev.ts` tá»± set:

```text
LOGSTASH_HOST=127.0.0.1
LOGSTASH_PORT=5044
NODE_ENV=development-local
```

Full Docker mode:

```powershell
npm.cmd run docker:up
```

CÃ¡c service cháº¡y trong Docker dÃ¹ng `LOGSTASH_HOST=logstash`.

Prometheus/Grafana:

```text
Prometheus: http://localhost:9090
Alertmanager: http://localhost:9093
Grafana: http://localhost:30000
Grafana máº·c Ä‘á»‹nh local: admin / admin
```

## Verify nhanh

Gá»­i má»™t request qua Kong:

```powershell
$cid = "demo-observability-" + [guid]::NewGuid().ToString()
curl.exe -H "x-correlation-id: $cid" http://localhost:8000/user-service/health/live
```

Kiá»ƒm tra Elasticsearch:

```powershell
curl.exe "http://localhost:9200/microservices-logs-*/_search?q=correlationId:$cid&pretty"
```

Má»Ÿ Kibana:

```text
http://localhost:5601
```

Táº¡o data view:

```text
microservices-logs-*
```

TrÆ°á»ng thá»i gian:

```text
@timestamp
```

## Query há»¯u Ã­ch trong Kibana

```text
serviceName: "user-service"
```

```text
logType: "access" and statusCode >= 500
```

```text
correlationId: "demo-observability-*"
```

## Verify Correlation ID

Case 1: Client tá»± truyá»n Correlation ID.

```powershell
$cid = "correlation-" + [guid]::NewGuid().ToString()
curl.exe -i -H "x-correlation-id: $cid" http://localhost:8000/user-service/health/live
curl.exe "http://localhost:9200/microservices-logs-*/_search?q=correlationId:$cid&pretty"
```

Ká»³ vá»ng:

- Response header cÃ³ `x-correlation-id` Ä‘Ãºng báº±ng `$cid`.
- Elasticsearch cÃ³ access log vá»›i `correlationId=$cid`.

Case 2: Client khÃ´ng truyá»n Correlation ID.

```powershell
curl.exe -i http://localhost:8000/user-service/health/live
```

Ká»³ vá»ng:

- Kong hoáº·c service tá»± táº¡o `x-correlation-id`.
- DÃ¹ng giÃ¡ trá»‹ header nÃ y Ä‘á»ƒ query trong Kibana/Elasticsearch.

Case 3: Request táº¡o event RabbitMQ.

```powershell
# Gá»i má»™t API cÃ³ publish domain event, vÃ­ dá»¥ luá»“ng identity/user/course tÃ¹y dá»¯ liá»‡u local.
# Sau Ä‘Ã³ query cÃ¹ng correlationId trong log cá»§a service publish vÃ  service consume.
```

Ká»³ vá»ng:

- Service publish log cÃ³ `correlationId`.
- Service consume message cÅ©ng log cÃ¹ng `correlationId`.

## Verify Metrics

Kiá»ƒm tra metrics endpoint cá»§a má»™t service:

```powershell
curl.exe http://localhost:3002/metrics
```

Ká»³ vá»ng:

- Response lÃ  Prometheus text format, khÃ´ng pháº£i JSON `{ success, code, data }`.
- CÃ³ metric `http_requests_total`, `http_request_duration_seconds`, `nodejs_process_resident_memory_bytes`.

Kiá»ƒm tra Prometheus targets:

```text
http://localhost:9090/targets
```

Ká»³ vá»ng:

- Hybrid dev mode dÃ¹ng targets `host.docker.internal:3001..3011`.
- Full Docker/deploy dÃ¹ng targets `identity-service:3000`, `user-service:3000`, ...
- Target cá»§a service Ä‘ang cháº¡y cÃ³ tráº¡ng thÃ¡i `UP`.

Kiá»ƒm tra Prometheus alert rules:

```text
http://localhost:9090/alerts
```

CÃ¡c rule Ä‘Ã£ cáº¥u hÃ¬nh:

- `ServiceMetricsEndpointDown`: Prometheus khÃ´ng scrape Ä‘Æ°á»£c service quÃ¡ 2 phÃºt.
- `HighHttp5xxRate`: tá»· lá»‡ HTTP 5xx cá»§a service vÆ°á»£t 5% trong 5 phÃºt.
- `HighHttpLatencyP95`: p95 latency vÆ°á»£t 1 giÃ¢y trong 5 phÃºt.
- `HighNodeMemoryUsage`: process memory vÆ°á»£t 80% host memory trong 5 phÃºt.
- `HighNodeCpuUsage`: CPU process vÆ°á»£t 80% má»™t core trong 5 phÃºt.

Má»Ÿ Grafana:

```text
http://localhost:30000
```

Dashboard Ä‘Æ°á»£c provision sáºµn:

```text
Microservices / Microservices Observability
```

CÃ¡c panel chÃ­nh:

- Services Up
- Request Rate
- 5xx Error Ratio
- HTTP Latency p95
- Memory Usage
- CPU Usage
- Firing Alerts

## Verify Alerting

Kiá»ƒm tra Prometheus Ä‘Ã£ káº¿t ná»‘i Alertmanager:

```text
http://localhost:9090/status
```

Kiá»ƒm tra Alertmanager:

```text
http://localhost:9093
```

Ká»³ vá»ng:

- Alertmanager UI má»Ÿ Ä‘Æ°á»£c.
- Prometheus cÃ³ alertmanager target `alertmanager:9093`.
- Cáº£nh bÃ¡o firing trong Prometheus Ä‘Æ°á»£c gá»­i sang Alertmanager.

File cáº¥u hÃ¬nh:

- `docker/prometheus/alerts.yml`: rule cáº£nh bÃ¡o.
- `docker/alertmanager/alertmanager.yml`: gom nhÃ³m, inhibit warning khi cÃ³ critical cÃ¹ng service vÃ  route tá»›i webhook.

Webhook local máº·c Ä‘á»‹nh:

```text
http://host.docker.internal:9099/alertmanager
```

Khi triá»ƒn khai tháº­t, thay webhook nÃ y báº±ng Slack/Discord/Teams hoáº·c webhook ná»™i bá»™ cá»§a team.

## Verify Smoke Test vÃ  Runbook

Cháº¡y smoke test cho stack quan sÃ¡t:

```powershell
npm.cmd run observability:smoke
```

Kiá»ƒm tra thÃªm metrics endpoint cá»§a service:

```powershell
$env:OBS_SERVICE_METRICS_URLS = "http://localhost:3002/metrics,http://localhost:3004/metrics"
npm.cmd run observability:smoke
```

Runbook xá»­ lÃ½ sá»± cá»‘ náº±m á»Ÿ:

```text
docs/devops/observability-runbook.md
```

## Deploy staging/production

`docker-compose.deploy.yml` Ä‘Ã£ cÃ³:

- `elasticsearch`
- `logstash`
- `kibana`
- `prometheus`
- `alertmanager`
- `grafana`
- volume `elasticsearch_data`
- volume `prometheus_data`
- volume `alertmanager_data`
- volume `grafana_data`
- biáº¿n logging dÃ¹ng chung cho service: `LOGSTASH_HOST=logstash`, `LOGSTASH_PORT=5044`, `LOG_CONSOLE_FORMAT=json`

CÃ¡c file env máº«u cÃ³ thá»ƒ chá»‰nh port public:

```text
ELASTICSEARCH_PORT=9200
LOGSTASH_HOST_PORT=5044
KIBANA_PORT=5601
ALERTMANAGER_PORT=9093
PROMETHEUS_PORT=9090
GRAFANA_PORT=30000
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=change-me
ES_JAVA_OPTS=-Xms512m -Xmx512m
```

Trong production tháº­t, nÃªn giá»›i háº¡n public access tá»›i Elasticsearch, Logstash vÃ  Kibana báº±ng firewall/VPN/reverse proxy cÃ³ auth.
Vá»›i Grafana/Prometheus cÅ©ng nÃªn giá»›i háº¡n public access tÆ°Æ¡ng tá»±; Ã­t nháº¥t Ä‘á»•i `GRAFANA_ADMIN_PASSWORD` trong file env tháº­t.

## Checklist Logging vÃ  ELK

- `npm run infra:up` hoáº·c `npm run docker:up` khá»Ÿi Ä‘á»™ng Ä‘Æ°á»£c Elasticsearch, Logstash, Kibana.
- Service gá»­i log JSON sang Logstash.
- Elasticsearch cÃ³ index `microservices-logs-*`.
- Kibana query Ä‘Æ°á»£c log theo `serviceName`.
- Access log query Ä‘Æ°á»£c theo `correlationId`.
- Deploy compose cÃ³ ELK vÃ  app services cÃ³ biáº¿n `LOGSTASH_HOST`.

## Checklist Correlation ID

- Kong config cÃ³ `correlation-id` plugin dÃ¹ng header `x-correlation-id`.
- CORS cho phÃ©p request header vÃ  expose response header `x-correlation-id`.
- `CorrelationIdMiddleware` gáº¯n ID vÃ o HTTP request/response.
- `CorrelationIdInterceptor` táº¡o context cho HTTP vÃ  RabbitMQ message handlers.
- `AppLoggerModule` tá»± enrich application log báº±ng correlation ID hiá»‡n táº¡i.
- RabbitMQ event publisher enrich payload báº±ng `correlationId`.
- Audit event fallback láº¥y correlation ID tá»« request context.

## Checklist Metrics vÃ  Dashboard

- `MetricsModule` Ä‘Æ°á»£c dÃ¹ng chung tá»« `@repo/common`.
- Táº¥t cáº£ service expose endpoint `/metrics`.
- `ApiResponseInterceptor` bá» qua `/metrics` Ä‘á»ƒ giá»¯ Prometheus text format.
- Prometheus scrape Ä‘Æ°á»£c service metrics á»Ÿ hybrid mode vÃ  full Docker/deploy mode.
- Prometheus cÃ³ alert rules cho service down, 5xx cao, latency cao, RAM cao, CPU cao.
- Grafana tá»± provision Prometheus datasource.
- Grafana tá»± provision dashboard `Microservices Observability`.
- Deploy script upload Prometheus/Grafana config lÃªn server.

## Checklist Alerting

- Prometheus cÃ³ cáº¥u hÃ¬nh `alerting.alertmanagers`.
- `alertmanager` cháº¡y trong hybrid, full Docker vÃ  deploy compose.
- Deploy script upload `docker/alertmanager/alertmanager.yml`.
- File env máº«u cÃ³ `ALERTMANAGER_PORT`.
- Alertmanager cÃ³ route máº·c Ä‘á»‹nh vÃ  inhibit rule cÆ¡ báº£n Ä‘á»ƒ giáº£m nhiá»…u cáº£nh bÃ¡o.

## Checklist Smoke Test vÃ  Runbook

- CÃ³ script `npm run observability:smoke`.
- Smoke test kiá»ƒm tra Prometheus ready, alert rules, Alertmanager ready, Grafana health, Elasticsearch health vÃ  Kibana status.
- Smoke test há»— trá»£ kiá»ƒm tra thÃªm URL `/metrics` qua biáº¿n `OBS_SERVICE_METRICS_URLS`.
- CÃ³ runbook `docs/devops/observability-runbook.md` cho service down, 5xx cao, latency cao, CPU/RAM cao.


