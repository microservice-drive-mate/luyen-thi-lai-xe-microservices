# Media Service API Specification

**Base URL qua Kong:** `http://localhost:8000`  
**Service paths:** `/media`, `/admin/media`  
**Direct local:** `http://localhost:3010`  
**Swagger UI:** `http://localhost:3010/docs`  
**Swagger UI qua Kong:** `http://localhost:8000/media-service/docs`  
**OpenAPI JSON:** `http://localhost:3010/docs-json`  
**OpenAPI JSON qua Kong:** `http://localhost:8000/media-service/docs-json`  
**Version:** 1.0.0

## Direct Upload Contract Update

Use this flow for production-style browser upload to private Azure Blob Storage:

```text
1. POST /media/files/init
2. PUT data.uploadUrl directly to Azure Blob Storage
3. POST /media/files/:mediaFileId/complete
4. Attach the file in the business API by sending mediaFileId
5. Render by calling GET /media/files/:mediaFileId/url
```

Important frontend rules:

- `PUT data.uploadUrl` is not a backend/Kong API. It is a direct Azure Blob request.
- Do not send `Authorization`, `x-user-id`, `x-user-role`, or backend correlation headers to Azure.
- Send only the required upload headers: `Content-Type: <file.type>` and `x-ms-blob-type: BlockBlob`.
- `publicUrl` is a stable blob URL for fallback/debug. With a private container, render through `GET /media/files/:id/url`.

File metadata responses now include:

```json
{
  "status": "UNLINKED | UPLOADED | LINKED"
}
```

Status meaning:

| Status | Meaning |
| --- | --- |
| `UNLINKED` | Metadata was created by init, but upload has not been confirmed. |
| `UPLOADED` | Azure blob exists, but no business entity has attached it yet. |
| `LINKED` | File is attached to user avatar, course material, or question image. |

### POST `/media/files/:id/complete`

Confirms that a direct upload has finished. Call this only after the Azure `PUT uploadUrl` request returns success.

**Auth:** valid JWT.

**Response `200 OK`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-06-13T10:00:00.000Z",
  "path": "/media/files/3fa85f64-5717-4562-b3fc-2c963f66afa6/complete",
  "data": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "storageKey": "uploads/2026/06/3fa85f64-5717-4562-b3fc-2c963f66afa6.jpg",
    "originalName": "avatar.jpg",
    "mimeType": "image/jpeg",
    "fileSize": 204800,
    "bucketName": "media",
    "uploadedById": "keycloak-user-uuid",
    "isPublic": false,
    "status": "UPLOADED",
    "createdAt": "2026-06-13T10:00:00.000Z"
  }
}
```

**Error `409 Conflict`**

```json
{
  "success": false,
  "code": "FILE_UPLOAD_NOT_COMPLETED",
  "message": "Upload for file 3fa85f64-5717-4562-b3fc-2c963f66afa6 has not completed",
  "errorCode": "FILE_UPLOAD_NOT_COMPLETED",
  "timestamp": "2026-06-13T10:00:00.000Z",
  "path": "/media/files/3fa85f64-5717-4562-b3fc-2c963f66afa6/complete"
}
```

Frontend example:

```ts
async function uploadMedia(file: File) {
  const init = await api.post('/media/files/init', {
    originalName: file.name,
    mimeType: file.type,
    fileSize: file.size,
  });

  const { mediaFileId, uploadUrl } = init.data.data;

  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type,
      'x-ms-blob-type': 'BlockBlob',
    },
    body: file,
  });

  if (!uploadResponse.ok) {
    throw new Error(`Azure upload failed: ${uploadResponse.status}`);
  }

  await api.post(`/media/files/${mediaFileId}/complete`);

  return { mediaFileId };
}
```

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
| Direct upload | `POST /media/files/init` + `PUT uploadUrl` + `POST /media/files/:id/complete` | KhÃ´ng | Client PUT trá»±c tiáº¿p lÃªn Azure báº±ng SAS URL, rá»“i confirm vá»›i backend |

`storageKey` có dạng: `uploads/YYYY/MM/<uuid>.<ext>`.

## Frontend Contract Quan Trọng

Frontend nên ưu tiên direct upload:

```text
1. Gọi POST /media/files/init qua backend/Kong với Authorization.
2. Lấy data.uploadUrl, data.mediaFileId, data.publicUrl.
3. PUT file trực tiếp lên data.uploadUrl bằng fetch/axios instance sạch.
4. Gá»i POST /media/files/:mediaFileId/complete qua backend/Kong.
5. Gá»i business API tÆ°Æ¡ng á»©ng Ä‘á»ƒ lÆ°u mediaFileId.
6. Khi render áº£nh/file, Æ°u tiÃªn GET /media/files/:mediaFileId/url rá»“i dÃ¹ng data.url.
```

Khi PUT trực tiếp lên Azure Blob Storage:

- Không gửi `Authorization: Bearer ...` lên Azure.
- Không dùng axios/API client chung có interceptor tự gắn token backend.
- Không gửi `x-correlation-id`, `x-user-id`, `x-user-role` lên Azure.
- Chỉ cần các header:

```http
Content-Type: <file.type>
x-ms-blob-type: BlockBlob
```

`publicUrl` là stable blob URL/fallback/debug URL. Nếu Azure container private, frontend không nên render trực tiếp bằng `publicUrl`; hãy dùng `GET /media/files/:id/url` để lấy SAS read URL ngắn hạn.

Azure Blob Storage CORS phải cho origin frontend, ví dụ local Vite:

```text
Origin: http://localhost:5173
Methods: OPTIONS, PUT, GET, HEAD
Allowed headers: content-type, x-ms-blob-type
```

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
  "errorCode": "FILE_NOT_FOUND",
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
|  409 | `FILE_UPLOAD_NOT_COMPLETED` | Gá»i complete nhÆ°ng blob chÆ°a tá»“n táº¡i trÃªn Azure |
|  422 | `FILE_TOO_LARGE`     | File vượt quá giới hạn domain           |
|  422 | `INVALID_MIME_TYPE`  | MIME type không được chấp nhận          |
|  502 | `FILE_UPLOAD_FAILED` | Lỗi upload/giao tiếp với storage        |

---

## Shared Types

### Allowed File Rules

Frontend nên validate trước khi gọi `POST /media/files/init`.

| Rule | Value |
| --- | --- |
| Max file size | `10 MB` |
| Image MIME | `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `image/svg+xml` |
| Document MIME | `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document` |
| Video MIME | `video/mp4`, `video/webm` |
| Audio MIME | `audio/mpeg`, `audio/wav` |

### File Metadata Fields

Response tráº£ `status` Ä‘á»ƒ frontend/admin biáº¿t file Ä‘ang á»Ÿ bÆ°á»›c nÃ o trong direct upload flow.

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
  "status": "UPLOADED",
  "createdAt": "2026-05-14T10:00:00.000Z"
}
```

### FileStatus Trong Domain

| Giá trị    | Ý nghĩa                                                              |
| ---------- | -------------------------------------------------------------------- |
| `UNLINKED` | Metadata Ä‘Æ°á»£c táº¡o cho direct upload nhÆ°ng chÆ°a confirm file Ä‘Ã£ lÃªn Azure |
| `UPLOADED` | Blob Ä‘Ã£ tá»“n táº¡i trÃªn Azure, nhÆ°ng chÆ°a Ä‘Æ°á»£c business entity attach |
| `LINKED`   | File server-upload hoáº·c file Ä‘Ã£ Ä‘Æ°á»£c service khÃ¡c xÃ¡c nháº­n Ä‘ang dÃ¹ng |

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

Ví dụ frontend:

```ts
async function uploadMedia(file: File) {
  const init = await api.post('/media/files/init', {
    originalName: file.name,
    mimeType: file.type,
    fileSize: file.size,
  });

  const { mediaFileId, uploadUrl, publicUrl } = init.data.data;

  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type,
      'x-ms-blob-type': 'BlockBlob',
    },
    body: file,
  });

  if (!uploadResponse.ok) {
    throw new Error(`Azure upload failed: ${uploadResponse.status}`);
  }

  await api.post(`/media/files/${mediaFileId}/complete`);

  return { mediaFileId, publicUrl };
}
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

Media-service lắng nghe trên queue:

- `media_service_events`

| Event                    | Source queue            | Payload tối thiểu           | Xử lý              |
| ------------------------ | ----------------------- | --------------------------- | ------------------ |
| `user.avatar.linked`     | `media_service_events`  | `{ "mediaFileId": "uuid" }` | Mark file `LINKED` |
| `course.material.linked` | `media_service_events`  | `{ "mediaFileId": "uuid" }` | Mark file `LINKED` |
| `question.image.linked`  | `media_service_events`  | `{ "mediaFileId": "uuid" }` | Mark file `LINKED` |

---

## Quick Test Giống Frontend

Ví dụ PowerShell qua Kong:

```powershell
$login = Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:8000/auth/login" `
  -ContentType "application/json" `
  -Body '{"username":"admin@test.com","password":"123456"}'

$token = $login.data.accessToken

$pngPath = Join-Path $env:TEMP "media-frontend-test.png"
$pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="
[IO.File]::WriteAllBytes($pngPath, [Convert]::FromBase64String($pngBase64))
$file = Get-Item $pngPath

$init = Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:8000/media/files/init" `
  -Headers @{ Authorization = "Bearer $token" } `
  -ContentType "application/json" `
  -Body (@{
    originalName = $file.Name
    mimeType = "image/png"
    fileSize = $file.Length
  } | ConvertTo-Json)

$uploadUrl = $init.data.uploadUrl
$mediaFileId = $init.data.mediaFileId

Invoke-WebRequest `
  -Method Put `
  -Uri $uploadUrl `
  -Headers @{ "x-ms-blob-type" = "BlockBlob" } `
  -ContentType "image/png" `
  -InFile $pngPath

Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:8000/media/files/$mediaFileId/complete" `
  -Headers @{ Authorization = "Bearer $token" } |
  ConvertTo-Json -Depth 5

Invoke-RestMethod `
  -Method Get `
  -Uri "http://localhost:8000/media/files/$mediaFileId/url" `
  -Headers @{ Authorization = "Bearer $token" } |
  ConvertTo-Json -Depth 5
```
