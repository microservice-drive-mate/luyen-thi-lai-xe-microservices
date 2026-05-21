# Media Service API Specification

**Base URL qua Kong:** `http://localhost:8000`  
**Service paths:** `/media`, `/admin/media`  
**Direct local:** `http://localhost:3010`  
**Swagger UI:** `http://localhost:3010/docs`  
**Swagger UI qua Kong:** `http://localhost:8000/media-service/docs`  
**OpenAPI JSON:** `http://localhost:3010/docs-json`  
**OpenAPI JSON qua Kong:** `http://localhost:8000/media-service/docs-json`  
**Version:** 1.0.0

## Auth Update

Media-service hiện validate JWT/RBAC tại service bằng Keycloak guard. Frontend gọi qua Kong và gửi `Authorization: Bearer <access_token>`; Kong forward header này vào service. Upload/init upload lấy `uploadedById` từ `JWT.sub`, còn `x-user-id` chỉ là fallback cho debug/local script cũ.

| Endpoint                                                                                          | Role                      |
| ------------------------------------------------------------------------------------------------- | ------------------------- |
| `POST /media/files`, `POST /media/files/init`, `GET /media/files/:id`, `GET /media/files/:id/url` | JWT hợp lệ                |
| `GET /admin/media/files`, `DELETE /admin/media/files/:id`                                                     | `ADMIN`, `CENTER_MANAGER` |

Business API path là `/media/*` cho upload/read có JWT và `/admin/media/*` cho admin dashboard quản lý file; Swagger/docs path là `/media-service/docs`.

---

## Tổng Quan

`media-service` quản lý metadata file và lưu file thật trên Azure Blob Storage. Service hỗ trợ 2 luồng upload:

| Luồng         | Endpoint                                   | File bytes đi qua media-service? | Ghi chú                                                   |
| ------------- | ------------------------------------------ | -------------------------------: | --------------------------------------------------------- |
| Server upload | `POST /media/files`                        |                               Có | Upload đơn giản, service nhận multipart rồi đẩy lên Azure |
| Direct upload | `POST /media/files/init` + `PUT uploadUrl` |                            Không | Client PUT trực tiếp lên Azure bằng SAS URL               |

`storageKey` có dạng: `uploads/YYYY/MM/<uuid>.<ext>`.

---

## Response Format

Tất cả HTTP response được bọc bởi `ApiResponseInterceptor`.

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-14T10:00:00.000Z",
  "path": "/media/files",
  "data": {}
}
```

Lỗi domain được trả theo format:

```json
{
  "success": false,
  "code": "FILE_NOT_FOUND",
  "message": "File with id \"abc\" not found",
  "timestamp": "2026-05-14T10:00:00.000Z",
  "path": "/media/files/abc"
}
```

---

## Error Codes

| HTTP | Code                 | Nguyên nhân                             |
| ---: | -------------------- | --------------------------------------- |
|  400 | `VALIDATION_ERROR`   | Body/query không hợp lệ                 |
|  400 | `BAD_REQUEST`        | Multipart request không có field `file` |
|  404 | `FILE_NOT_FOUND`     | Không tìm thấy file                     |
|  422 | `FILE_TOO_LARGE`     | File vượt quá giới hạn domain           |
|  422 | `INVALID_MIME_TYPE`  | MIME type không được chấp nhận          |
|  502 | `FILE_UPLOAD_FAILED` | Lỗi upload/giao tiếp với storage        |

---

## Shared Types

### File Metadata Fields

Response hiện tại **không trả `status`**, dù domain vẫn có `FileStatus`.

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
  "createdAt": "2026-05-14T10:00:00.000Z"
}
```

### FileStatus Trong Domain

| Giá trị    | Ý nghĩa                                                              |
| ---------- | -------------------------------------------------------------------- |
| `LINKED`   | File server-upload hoặc file đã được service khác xác nhận đang dùng |
| `UNLINKED` | Metadata được tạo cho direct upload nhưng chưa nhận event confirm    |

---

## Endpoints

### POST `/media/files`

Upload file bằng `multipart/form-data`. `uploadedById` lấy từ `sub` trong JWT của caller.

**Body**

| Field  | Type   | Required |
| ------ | ------ | -------- |
| `file` | binary | Yes      |

**Response `201 Created`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "Created",
  "timestamp": "2026-05-14T10:00:00.000Z",
  "path": "/media/files",
  "data": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "storageKey": "uploads/2026/05/3fa85f64-5717-4562-b3fc-2c963f66afa6.jpg",
    "originalName": "avatar.jpg",
    "mimeType": "image/jpeg",
    "fileSize": 204800,
    "bucketName": "media",
    "uploadedById": "keycloak-user-uuid",
    "isPublic": false,
    "createdAt": "2026-05-14T10:00:00.000Z"
  }
}
```

**Event published:** `media.file.uploaded`.

---

### POST `/media/files/init`

Tạo metadata và SAS URL để client upload trực tiếp lên Azure Blob Storage.

**Body**

```json
{
  "originalName": "avatar.jpg",
  "mimeType": "image/jpeg",
  "fileSize": 204800
}
```

| Field          | Type   | Required | Validation                                  |
| -------------- | ------ | -------- | ------------------------------------------- |
| `originalName` | string | Yes      | Non-empty                                   |
| `mimeType`     | string | Yes      | Non-empty, kiểm tra ở domain                |
| `fileSize`     | number | Yes      | Integer, `>= 1`, kiểm tra giới hạn ở domain |

**Response `201 Created`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "Created",
  "timestamp": "2026-05-14T10:00:00.000Z",
  "path": "/media/files/init",
  "data": {
    "mediaFileId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "uploadUrl": "https://storage.blob.core.windows.net/media/uploads/2026/05/file.jpg?sv=...",
    "publicUrl": "https://storage.blob.core.windows.net/media/uploads/2026/05/file.jpg",
    "expiresAt": "2026-05-14T11:00:00.000Z"
  }
}
```

Sau đó client PUT file lên `uploadUrl`:

```http
PUT <uploadUrl>
Content-Type: image/jpeg
x-ms-blob-type: BlockBlob

<file bytes>
```

Khi entity khác đã lưu `mediaFileId`, service đó phát event `user.avatar.linked`, `course.material.linked`, hoặc `question.image.linked`; media-service sẽ chuyển file sang trạng thái `LINKED`.

---

### GET `/admin/media/files`

**Auth:** `ADMIN`, `CENTER_MANAGER`

Liệt kê metadata file.

**Query**

| Param          | Type   | Default | Validation      | Mô tả                                |
| -------------- | ------ | ------: | --------------- | ------------------------------------ |
| `page`         | number |       1 | integer, `>= 1` | Trang                                |
| `size`         | number |      20 | integer, `>= 1` | Số item mỗi trang                    |
| `uploadedById` | string |       - | optional        | Lọc theo uploader                    |
| `mimeType`     | string |       - | optional        | Lọc theo prefix/type, ví dụ `image/` |

**Response `200 OK`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-14T10:00:00.000Z",
  "path": "/admin/media/files",
  "data": {
    "items": [
      {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "storageKey": "uploads/2026/05/3fa85f64-5717-4562-b3fc-2c963f66afa6.jpg",
        "originalName": "avatar.jpg",
        "mimeType": "image/jpeg",
        "fileSize": 204800,
        "bucketName": "media",
        "uploadedById": "keycloak-user-uuid",
        "isPublic": false,
        "createdAt": "2026-05-14T10:00:00.000Z"
      }
    ],
    "total": 1,
    "page": 1,
    "size": 20
  }
}
```

---

### GET `/media/files/:id`

**Auth:** JWT hop le.

**Path params**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | UUID | Yes | Media file id. |

Lấy metadata theo file id.

**Response `200 OK`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-14T10:00:00.000Z",
  "path": "/media/files/3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "data": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "storageKey": "uploads/2026/05/3fa85f64-5717-4562-b3fc-2c963f66afa6.jpg",
    "originalName": "avatar.jpg",
    "mimeType": "image/jpeg",
    "fileSize": 204800,
    "bucketName": "media",
    "uploadedById": "keycloak-user-uuid",
    "isPublic": false,
    "createdAt": "2026-05-14T10:00:00.000Z"
  }
}
```

---

### GET `/media/files/:id/url`

**Auth:** JWT hop le.

**Path params**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | UUID | Yes | Media file id. |

Tạo presigned download URL.

**Response `200 OK`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-14T10:00:00.000Z",
  "path": "/media/files/3fa85f64-5717-4562-b3fc-2c963f66afa6/url",
  "data": {
    "url": "https://storage.blob.core.windows.net/media/uploads/2026/05/file.jpg?sv=...",
    "expiresAt": "2026-05-14T11:00:00.000Z"
  }
}
```

---

### DELETE `/admin/media/files/:id`

**Auth:** `ADMIN`, `CENTER_MANAGER`

**Path params**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | UUID | Yes | Media file id. |

Xóa file khỏi storage và database. `deletedById` lấy từ `sub` trong JWT của caller.

**Response `204 No Content`**

Không có body.

**Event published:** `media.file.deleted`, được broadcast tới user-service và course-service.

---

## Domain Events

### Published

#### `media.file.uploaded`

```json
{
  "eventName": "media.file.uploaded",
  "fileId": "uuid",
  "storageKey": "uploads/2026/05/file.jpg",
  "originalName": "avatar.jpg",
  "mimeType": "image/jpeg",
  "fileSize": 204800,
  "uploadedById": "user-uuid"
}
```

#### `media.file.deleted`

```json
{
  "eventName": "media.file.deleted",
  "fileId": "uuid",
  "storageKey": "uploads/2026/05/file.jpg",
  "deletedById": "user-uuid"
}
```

### Consumed

Media-service lắng nghe trên 2 queue riêng biệt:

- `user_service_events` — nhận events từ user-service
- `course_service_events` — nhận events từ course-service

| Event                    | Source queue            | Payload tối thiểu           | Xử lý              |
| ------------------------ | ----------------------- | --------------------------- | ------------------ |
| `user.avatar.linked`     | `user_service_events`   | `{ "mediaFileId": "uuid" }` | Mark file `LINKED` |
| `course.material.linked` | `course_service_events` | `{ "mediaFileId": "uuid" }` | Mark file `LINKED` |
| `question.image.linked`  | `media_service_events`  | `{ "mediaFileId": "uuid" }` | Mark file `LINKED` |

---

## Quick Test

```bash
curl -X POST http://localhost:3010/media/files/init \  -H "Content-Type: application/json" \
  -d '{"originalName":"avatar.jpg","mimeType":"image/jpeg","fileSize":204800}'
```
