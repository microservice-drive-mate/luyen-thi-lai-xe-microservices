# Media Service API Specification

**Base URL (qua Kong):** `http://localhost:8000`
**Service path:** `/media`
**Direct (local dev):** `http://localhost:3010`
**Swagger UI:** `http://localhost:3010/api-docs`
**Version:** 1.1.0

> Frontend integration guide (flow đầy đủ, code example): [frontend-integration-guide.md](./frontend-integration-guide.md)

---

## Tổng quan

`media-service` cung cấp khả năng lưu trữ file tập trung cho toàn hệ thống.
File thực sự được lưu trên **Azure Blob Storage**.
Database PostgreSQL chỉ lưu **metadata** (tên file, MIME type, kích thước, storage key, trạng thái).

**Storage key format:** `uploads/YYYY/MM/<uuid>.<ext>`
Ví dụ: `uploads/2026/05/3fa85f64-5717-4562-b3fc-2c963f66afa6.jpg`

### Hai cách upload

| Cách | Endpoint | File đi qua server? | Khi nào dùng |
|---|---|---|---|
| **A — Server upload** | `POST /media/files` | Có | Upload đơn giản, file nhỏ |
| **B — Direct upload** | `POST /media/files/init` + PUT Azure | Không | File lớn, tối ưu bandwidth |

Cách B (direct upload) là **Gold Standard** cho production — media-service không phải xử lý byte nào của file.

---

## Xác thực

Tất cả endpoint yêu cầu JWT hợp lệ do Keycloak phát hành.

Kong gateway inject headers trước khi forward:
- `x-user-id` — `sub` claim từ JWT (Keycloak user UUID)
- `x-user-role` — role của user

```http
Authorization: Bearer <keycloak_access_token>
```

---

## Response Format

```json
// Thành công
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-11T10:00:00.000Z",
  "path": "/media/files",
  "data": { ... }
}

// Lỗi
{
  "success": false,
  "code": "FILE_NOT_FOUND",
  "message": "File with id \"abc-123\" not found",
  "timestamp": "2026-05-11T10:00:00.000Z",
  "path": "/media/files/abc-123"
}
```

---

## Error Codes

| HTTP | Code | Nguyên nhân |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Request body/query không hợp lệ |
| 400 | `BAD_REQUEST` | Không tìm thấy file trong request multipart |
| 404 | `FILE_NOT_FOUND` | Không tìm thấy file với ID đã cho |
| 422 | `FILE_TOO_LARGE` | Kích thước file vượt quá 10MB |
| 422 | `INVALID_MIME_TYPE` | MIME type không được phép |
| 502 | `FILE_UPLOAD_FAILED` | Lỗi kết nối đến Azure Blob Storage |

---

## MIME Types Được Phép

| Loại | MIME Types |
|---|---|
| Ảnh | `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `image/svg+xml` |
| Tài liệu | `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document` |
| Video | `video/mp4`, `video/webm` |
| Audio | `audio/mpeg`, `audio/wav` |

**Kích thước tối đa:** 10MB per file

---

## File Object (Shared Response Type)

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "storageKey": "uploads/2026/05/3fa85f64-5717-4562-b3fc-2c963f66afa6.jpg",
  "originalName": "avatar.jpg",
  "mimeType": "image/jpeg",
  "fileSize": 204800,
  "bucketName": "media",
  "uploadedById": "keycloak-user-uuid",
  "isPublic": false,
  "status": "UNLINKED",
  "createdAt": "2026-05-11T10:00:00.000Z"
}
```

### FileStatus

| Giá trị | Ý nghĩa |
|---|---|
| `UNLINKED` | File đã được ghi nhận (hoặc đã upload lên Azure) nhưng chưa được gắn với entity nào (user profile, course material...) |
| `LINKED` | File đã được confirm — có entity đang reference đến `mediaFileId` này |

> File có status `UNLINKED` quá 24h sẽ bị cron job tự động xóa (tránh lãng phí storage).

---

## Endpoints

### POST /media/files — Upload trực tiếp qua server

Upload file lên Azure Blob Storage. File đi qua server (server nhận bytes, forward lên Azure).

**Request Headers:**

```http
Authorization: Bearer <jwt>
x-user-id: <uuid>          # Injected by Kong
Content-Type: multipart/form-data
```

**Request Body (multipart/form-data):**

| Field | Type | Required | Mô tả |
|---|---|---|---|
| `file` | binary | Yes | File cần upload (≤10MB) |

**Response 201:**

```json
{
  "success": true,
  "code": "SUCCESS",
  "data": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "storageKey": "uploads/2026/05/3fa85f64-5717-4562-b3fc-2c963f66afa6.jpg",
    "originalName": "avatar.jpg",
    "mimeType": "image/jpeg",
    "fileSize": 204800,
    "bucketName": "media",
    "uploadedById": "keycloak-user-uuid",
    "isPublic": false,
    "status": "LINKED",
    "createdAt": "2026-05-11T10:00:00.000Z"
  }
}
```

> Status là `LINKED` ngay lập tức vì file đã thực sự có trên Azure.

**Events Published:** `media.file.uploaded`

---

### POST /media/files/init — Khởi tạo direct upload (Gold Standard)

Tạo một bản ghi metadata trước, trả về SAS URL để client **PUT file thẳng lên Azure** mà không đi qua server.

**Request Headers:**

```http
Authorization: Bearer <jwt>
x-user-id: <uuid>          # Injected by Kong
Content-Type: application/json
```

**Request Body:**

```json
{
  "originalName": "avatar.jpg",
  "mimeType": "image/jpeg",
  "fileSize": 204800
}
```

| Field | Type | Required | Mô tả |
|---|---|---|---|
| `originalName` | string | Yes | Tên file gốc kể cả extension |
| `mimeType` | string | Yes | MIME type (phải nằm trong whitelist) |
| `fileSize` | number | Yes | Kích thước file tính bằng bytes |

**Response 201:**

```json
{
  "success": true,
  "code": "SUCCESS",
  "data": {
    "mediaFileId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "uploadUrl": "https://mediasvdev2026.blob.core.windows.net/media/uploads/2026/05/3fa85f64.jpg?sv=2023-11-03&se=2026-05-11T11%3A00%3A00Z&sr=b&sp=cw&sig=...",
    "publicUrl": "https://mediasvdev2026.blob.core.windows.net/media/uploads/2026/05/3fa85f64.jpg",
    "expiresAt": "2026-05-11T11:00:00.000Z"
  }
}
```

| Field | Ý nghĩa | Dùng để |
|---|---|---|
| `mediaFileId` | UUID của file trong hệ thống | Truyền vào user-service / course-service |
| `uploadUrl` | SAS URL có quyền write, hết hạn sau 1h | PUT file thẳng lên Azure |
| `publicUrl` | URL vĩnh viễn của blob (không có SAS) | Lưu làm `avatarUrl` / `fileUrl` |
| `expiresAt` | Thời điểm `uploadUrl` hết hạn | Validate trước khi PUT |

**Bước tiếp theo sau khi nhận response:**

```http
PUT <uploadUrl>
Content-Type: image/jpeg          (phải khớp với mimeType đã khai báo)
x-ms-blob-type: BlockBlob         (bắt buộc với Azure Blob Storage)

<file bytes>
```

> Sau khi PUT thành công (HTTP 201), file đã có trên Azure. Tiếp tục gọi user-service / course-service với `mediaFileId` và `publicUrl`.

---

### GET /media/files — Danh sách files

**Query Parameters:**

| Param | Type | Default | Mô tả |
|---|---|---|---|
| `page` | number | 1 | Trang hiện tại |
| `size` | number | 20 | Số items mỗi trang |
| `uploadedById` | string | — | Filter theo user UUID |
| `mimeType` | string | — | Filter theo MIME type prefix (e.g. `image/`) |

**Response 200:**

```json
{
  "success": true,
  "code": "SUCCESS",
  "data": {
    "items": [ /* FileObject[] */ ],
    "total": 100,
    "page": 1,
    "size": 20
  }
}
```

---

### GET /media/files/:id — Metadata của file

**Response 200:** `{ "data": FileObject }`

---

### GET /media/files/:id/url — Presigned download URL

Tạo SAS URL tạm thời để download file trực tiếp từ Azure (hết hạn theo `storage.presignedUrlExpiry`, mặc định 1h).

**Response 200:**

```json
{
  "success": true,
  "code": "SUCCESS",
  "data": {
    "url": "https://mediasvdev2026.blob.core.windows.net/media/uploads/2026/05/abc.jpg?sv=...&sig=...",
    "expiresAt": "2026-05-11T11:00:00.000Z"
  }
}
```

> Dùng URL này để hiển thị ảnh / link download. Không expose `storageKey` hay container name ra client.

---

### DELETE /media/files/:id — Xóa file

Xóa metadata khỏi DB trước, sau đó xóa blob khỏi Azure.

**Request Headers:** `Authorization`, `x-user-id`

**Response 204:** No Content

**Events Published:** `media.file.deleted` → broadcast đến `user_service_events` + `course_service_events`

---

## Domain Events

### Events Published bởi media-service

#### `media.file.uploaded`

```json
{
  "eventName": "media.file.uploaded",
  "fileId": "uuid",
  "storageKey": "uploads/2026/05/abc.jpg",
  "originalName": "avatar.jpg",
  "mimeType": "image/jpeg",
  "fileSize": 204800,
  "uploadedById": "user-uuid"
}
```

#### `media.file.deleted`

Fan-out đến `user_service_events` và `course_service_events`.

```json
{
  "eventName": "media.file.deleted",
  "fileId": "uuid",
  "storageKey": "uploads/2026/05/abc.jpg",
  "deletedById": "user-uuid"
}
```

**Consumers:**
- `user-service` — null-out `avatarUrl` + `mediaFileId` của profile đang dùng file này
- `course-service` — null-out `fileUrl` + `mediaFileId` của course material đang dùng file này

---

### Events Consumed bởi media-service

Nhận qua queue `media_service_events`.

#### `user.avatar.linked`

Published bởi `user-service` sau khi save profile thành công với `mediaFileId`.

```json
{
  "eventName": "user.avatar.linked",
  "userId": "user-uuid",
  "mediaFileId": "file-uuid"
}
```

**Xử lý:** Đánh dấu `FileObject.status = LINKED`

#### `course.material.linked`

Published bởi `course-service` sau khi save course material thành công với `mediaFileId`.

```json
{
  "eventName": "course.material.linked",
  "courseId": "course-uuid",
  "materialId": "material-uuid",
  "mediaFileId": "file-uuid"
}
```

**Xử lý:** Đánh dấu `FileObject.status = LINKED`

---

## Design Patterns

| Pattern | Nơi áp dụng | Lợi ích |
|---|---|---|
| **Port & Adapter (Hexagonal)** | `StoragePort` abstract + `AzureBlobStorageProvider` | Swap storage provider không đụng domain |
| **Repository Pattern** | `FileObjectRepository` abstract + Prisma impl | Domain không biết về Prisma |
| **Factory Method** | `FileObject.create()` / `reconstitute()` | Invariants luôn được kiểm tra khi tạo mới |
| **Observer / Event-Driven** | `media.file.deleted` fan-out; `user.avatar.linked` confirm | Eventual consistency không cần sync call |
| **CQRS (light)** | Commands tách khỏi Queries | Read/write path rõ ràng |

---

## Cấu hình Azure Blob Storage

| Consul Key | Mô tả |
|---|---|
| `storage.accountName` | Tên Storage Account (e.g. `mediasvdev2026`) |
| `storage.accountKey` | Access Key của Storage Account |
| `storage.containerName` | Tên container (mặc định: `media`) |
| `storage.presignedUrlExpiry` | Thời gian hết hạn SAS URL tính bằng giây (mặc định: `3600`) |

Container được tự động tạo khi service khởi động nếu chưa tồn tại.

---

## Testing

```bash
# 1. Khởi động infra + migration
npm run infra:up && npm run consul:seed:local
cd apps/media-service && npm run db:migrate && npm run db:generate

# 2. Chạy service
npm run dev --filter=media-service

# 3a. Upload truyền thống
curl -X POST http://localhost:3010/media/files \
  -H "x-user-id: 00000000-0000-0000-0000-000000000001" \
  -F "file=@avatar.jpg"

# 3b. Khởi tạo direct upload
curl -X POST http://localhost:3010/media/files/init \
  -H "x-user-id: 00000000-0000-0000-0000-000000000001" \
  -H "Content-Type: application/json" \
  -d '{"originalName":"avatar.jpg","mimeType":"image/jpeg","fileSize":204800}'
# → nhận uploadUrl, PUT file lên uploadUrl với header x-ms-blob-type: BlockBlob

# 4. Lấy presigned download URL
curl http://localhost:3010/media/files/<id>/url

# 5. Xóa file
curl -X DELETE http://localhost:3010/media/files/<id> \
  -H "x-user-id: 00000000-0000-0000-0000-000000000001"
```
