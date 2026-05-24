# HTTP Client Resilience

Tài liệu này mô tả chuẩn timeout, retry và circuit breaker cho các lời gọi HTTP đồng bộ quan trọng.

## Mục tiêu

- Mọi lời gọi HTTP nội bộ hoặc external quan trọng phải có timeout rõ ràng.
- Lỗi tạm thời được retry có giới hạn, không retry vô hạn.
- Khi dependency lỗi liên tục, circuit breaker mở tạm thời để tránh kéo sập service gọi.

## Shared Helper

Logic dùng chung nằm trong:

```text
packages/common/src/http/resilient-http-client.ts
```

Các API chính:

- `resilientFetch()`: wrapper cho `fetch`, hỗ trợ timeout, retry và circuit breaker.
- `configureAxiosResilience()`: cấu hình timeout, retry và circuit breaker cho `AxiosInstance` của Nest `HttpService`.

Mặc định:

| Cấu hình | Giá trị |
| -------- | ------- |
| Timeout | `3000ms` |
| Retry | `2` lần |
| Initial backoff | `200ms` |
| Backoff factor | `2` |
| Circuit failure threshold | `5` lỗi liên tiếp |
| Circuit open window | `30000ms` |

Retry chỉ áp dụng cho lỗi network, timeout, HTTP `408`, `429` và `5xx`. Không retry lỗi nghiệp vụ `4xx`.

## Đã áp dụng

Các sync call quan trọng đã dùng resilience layer:

| Service | Dependency | Cách áp dụng |
| ------- | ---------- | ------------ |
| `exam-service` | `question-service` | `resilientFetch()` khi lấy question pool |
| `exam-service` | `user-service` | `resilientFetch()` khi lấy student profile |
| `exam-service` | `Keycloak` | `resilientFetch()` khi lấy service token |
| `identity-service` | `Keycloak` | `resilientFetch()` khi lấy public key JWT |
| `identity-service` | `Keycloak Admin API` | `configureAxiosResilience()` cho Nest `HttpService` |

## Quy ước mở rộng

Khi thêm HTTP client mới:

1. Không gọi `fetch()` hoặc `HttpService` trực tiếp nếu dependency nằm ngoài process hiện tại.
2. Dùng `resilientFetch()` cho code dùng `fetch`.
3. Dùng `configureAxiosResilience()` một lần cho `HttpService.axiosRef` nếu dùng Axios.
4. Đặt `dependencyName` theo service thật để log/circuit tách biệt.
5. Chỉ tăng retry khi operation idempotent hoặc backend chịu được retry.
