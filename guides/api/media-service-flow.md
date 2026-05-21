# Media Service Flow And Integration Guide

Tài liệu này mô tả cách `media-service` hoạt động, từng API chính dùng để làm gì, và cách các service khác như `user-service`, `course-service`, `question-service`, `exam-service` nên tích hợp khi cần lưu ảnh/file.

---

## Vai Trò Của Media-Service

`media-service` quản lý metadata file và thao tác với Azure Blob Storage.

Service này chịu trách nhiệm:

- Tạo metadata file trong `media_db.file_objects`.
- Upload file lên Azure Blob Storage.
- Sinh SAS URL để client upload trực tiếp lên Azure.
- Sinh presigned download URL để frontend render ảnh/file từ container private.
- Xóa file khỏi Azure và database.
- Nhận event từ service khác để đánh dấu file đã được link vào business entity.

Service này không chịu trách nhiệm:

- Không tự biết file đó là avatar, tài liệu khóa học, hay ảnh câu hỏi.
- Không lưu business reference như `user.avatarUrl`, `course.materials`, `question.imageUrl`.
- Không gọi ngược trực tiếp sang user/course/question để update entity.

Business service khác chỉ lưu:

```json
{
  "mediaFileId": "media-file-uuid",
  "avatarUrl": "https://.../blob.jpg",
  "fileUrl": "https://.../file.pdf",
  "imageUrl": "https://.../question.jpg"
}
```

`mediaFileId` là khóa chính để lấy URL đọc file về sau. `avatarUrl`, `fileUrl`, `imageUrl` chỉ là stable blob URL/fallback; nếu Azure container private thì frontend không nên dùng trực tiếp các field này để render.

---

## Database Model

Media-service lưu metadata trong bảng `file_objects`.

```text
file_objects
├── id             UUID PK
├── storage_key    TEXT UNIQUE
├── original_name  TEXT
├── mime_type      TEXT
├── file_size      INT
├── bucket_name    TEXT
├── uploaded_by_id UUID/string ref Keycloak user id
├── is_public      BOOLEAN
├── status         UNLINKED | LINKED
├── created_at
└── updated_at
```

API response hiện tại không trả `status`, nhưng domain vẫn dùng `status` để phân biệt file vừa init upload và file đã được business entity xác nhận sử dụng.

---

## File Status

| Status | Ý nghĩa |
| --- | --- |
| `UNLINKED` | Metadata đã được tạo cho direct upload, nhưng chưa có entity nào xác nhận dùng file này. |
| `LINKED` | File đã được upload qua server upload, hoặc đã được service khác gắn vào entity và gửi event xác nhận. |

Server upload `POST /media/files` tạo file với `LINKED`.

Direct upload `POST /media/files/init` tạo file với `UNLINKED`; sau khi user/course/question lưu `mediaFileId`, service đó phải publish event để media-service chuyển sang `LINKED`.

---

## Allowed File Rules

Giới hạn hiện tại trong domain:

| Rule | Giá trị |
| --- | --- |
| Max file size | `10 MB` |
| Allowed image MIME | `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `image/svg+xml` |
| Allowed document MIME | `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document` |
| Allowed video MIME | `video/mp4`, `video/webm` |
| Allowed audio MIME | `audio/mpeg`, `audio/wav` |

Nếu file không hợp lệ:

```json
{
  "success": false,
  "code": "INVALID_MIME_TYPE",
  "message": "Invalid MIME type: ...",
  "timestamp": "2026-05-18T10:00:00.000Z",
  "path": "/media/files/init"
}
```

Nếu vượt size:

```json
{
  "success": false,
  "code": "FILE_TOO_LARGE",
  "message": "File size ... exceeds maximum ...",
  "timestamp": "2026-05-18T10:00:00.000Z",
  "path": "/media/files"
}
```

---

## API Summary

| API | Mục đích | Auth |
| --- | --- | --- |
| `POST /media/files` | Upload file qua media-service bằng multipart | JWT hợp lệ |
| `POST /media/files/init` | Tạo metadata và SAS URL để frontend upload trực tiếp lên Azure | JWT hợp lệ |
| `GET /media/files/:id` | Lấy metadata file | JWT hợp lệ |
| `GET /media/files/:id/url` | Lấy presigned download URL để browser render/download | JWT hợp lệ |
| `GET /admin/media/files` | Admin list metadata file | `ADMIN`, `CENTER_MANAGER` |
| `DELETE /admin/media/files/:id` | Xóa file khỏi Azure và database | `ADMIN`, `CENTER_MANAGER` |

Tất cả HTTP success response được bọc bởi `ApiResponseInterceptor`:

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-18T10:00:00.000Z",
  "path": "/media/files/:id",
  "data": {}
}
```

---

## API Details

### POST `/media/files`

Upload file qua media-service. File bytes đi qua backend NestJS, media-service nhận multipart file rồi upload lên Azure.

Nên dùng khi:

- File nhỏ.
- Muốn flow đơn giản.
- Admin dashboard upload tài liệu nhẹ.
- Không ngại traffic file đi qua service.

Không nên dùng khi:

- File lớn hơn hoặc gần 10MB.
- Upload nhiều file liên tục.
- Muốn giảm tải backend.

**Request**

```http
POST /media/files
Authorization: Bearer <access_token>
Content-Type: multipart/form-data
```

Form-data:

| Field | Type | Required |
| --- | --- | --- |
| `file` | binary | Yes |

**Response `201 Created`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "Created",
  "timestamp": "2026-05-18T10:00:00.000Z",
  "path": "/media/files",
  "data": {
    "id": "media-file-uuid",
    "storageKey": "uploads/2026/05/media-file-uuid.jpg",
    "originalName": "avatar.jpg",
    "mimeType": "image/jpeg",
    "fileSize": 204800,
    "bucketName": "media",
    "uploadedById": "keycloak-user-uuid",
    "isPublic": false,
    "createdAt": "2026-05-18T10:00:00.000Z"
  }
}
```

Sau response này, service khác dùng:

```text
mediaFileId = data.id
url fallback = https://<account>.blob.core.windows.net/<container>/<storageKey>
```

Lưu ý: API này không trả `publicUrl`. Nếu cần URL fallback, frontend/backend có thể tự dựng từ config Azure, hoặc ưu tiên dùng direct upload flow vì `POST /media/files/init` trả sẵn `publicUrl`.

---

### POST `/media/files/init`

Tạo metadata file và trả SAS upload URL để frontend PUT file trực tiếp lên Azure Blob Storage.

Đây là flow khuyến nghị cho frontend.

**Request**

```http
POST /media/files/init
Authorization: Bearer <access_token>
Content-Type: application/json
```

Body:

```json
{
  "originalName": "avatar.jpg",
  "mimeType": "image/jpeg",
  "fileSize": 204800
}
```

**Response `201 Created`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "Created",
  "timestamp": "2026-05-18T10:00:00.000Z",
  "path": "/media/files/init",
  "data": {
    "mediaFileId": "media-file-uuid",
    "uploadUrl": "https://account.blob.core.windows.net/media/uploads/2026/05/media-file-uuid.jpg?sv=...",
    "publicUrl": "https://account.blob.core.windows.net/media/uploads/2026/05/media-file-uuid.jpg",
    "expiresAt": "2026-05-18T11:00:00.000Z"
  }
}
```

Sau đó frontend upload file trực tiếp:

```http
PUT <data.uploadUrl>
Content-Type: image/jpeg
x-ms-blob-type: BlockBlob

<file bytes>
```

Sau khi PUT thành công, frontend gọi business service tương ứng để lưu `mediaFileId` và URL fallback.

Ví dụ avatar:

```http
PATCH /users/me
Authorization: Bearer <access_token>
Content-Type: application/json
```

```json
{
  "avatarUrl": "https://account.blob.core.windows.net/media/uploads/2026/05/media-file-uuid.jpg",
  "mediaFileId": "media-file-uuid"
}
```

User-service sẽ publish:

```json
{
  "eventName": "user.avatar.linked",
  "userId": "user-uuid",
  "mediaFileId": "media-file-uuid"
}
```

Media-service consume event này và đổi status file sang `LINKED`.

---

### GET `/media/files/:id`

Lấy metadata file.

**Response `200 OK`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-18T10:00:00.000Z",
  "path": "/media/files/media-file-uuid",
  "data": {
    "id": "media-file-uuid",
    "storageKey": "uploads/2026/05/media-file-uuid.jpg",
    "originalName": "avatar.jpg",
    "mimeType": "image/jpeg",
    "fileSize": 204800,
    "bucketName": "media",
    "uploadedById": "keycloak-user-uuid",
    "isPublic": false,
    "createdAt": "2026-05-18T10:00:00.000Z"
  }
}
```

Frontend thường không cần API này để render ảnh. Để render ảnh, dùng `GET /media/files/:id/url`.

---

### GET `/media/files/:id/url`

Sinh presigned download URL. Đây là API frontend nên dùng để render ảnh/file khi Azure container private.

**Response `200 OK`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-18T10:00:00.000Z",
  "path": "/media/files/media-file-uuid/url",
  "data": {
    "url": "https://account.blob.core.windows.net/media/uploads/2026/05/media-file-uuid.jpg?sv=...",
    "expiresAt": "2026-05-18T11:00:00.000Z"
  }
}
```

Frontend dùng:

```html
<img src="<data.url>" />
```

Frontend nên cache URL theo `mediaFileId` đến gần `expiresAt`. Khi URL hết hạn, gọi lại `GET /media/files/:id/url`.

Không nên cache vĩnh viễn presigned URL vì SAS URL có thời hạn.

---

### GET `/admin/media/files`

Admin list metadata file.

**Query**

| Param | Type | Default | Ghi chú |
| --- | --- | ---: | --- |
| `page` | number | 1 | Trang |
| `size` | number | 20 | Số item |
| `uploadedById` | string | - | Lọc theo uploader |
| `mimeType` | string | - | Lọc theo prefix/type, ví dụ `image/` |

**Response `200 OK`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-18T10:00:00.000Z",
  "path": "/admin/media/files",
  "data": {
    "items": [
      {
        "id": "media-file-uuid",
        "storageKey": "uploads/2026/05/media-file-uuid.jpg",
        "originalName": "avatar.jpg",
        "mimeType": "image/jpeg",
        "fileSize": 204800,
        "bucketName": "media",
        "uploadedById": "keycloak-user-uuid",
        "isPublic": false,
        "createdAt": "2026-05-18T10:00:00.000Z"
      }
    ],
    "total": 1,
    "page": 1,
    "size": 20
  }
}
```

---

### DELETE `/admin/media/files/:id`

Xóa file khỏi metadata DB và Azure Blob Storage.

**Response `204 No Content`**

Không có body.

Sau khi xóa, media-service publish:

```json
{
  "eventName": "media.file.deleted",
  "fileId": "media-file-uuid",
  "storageKey": "uploads/2026/05/media-file-uuid.jpg",
  "deletedById": "admin-user-uuid"
}
```

Hiện tại event này được broadcast tới:

- `user-service`
- `course-service`

User-service sẽ clear avatar nếu profile đang dùng file đó:

```json
{
  "avatarUrl": null,
  "mediaFileId": null
}
```

Course-service sẽ clear material reference nếu material đang dùng file đó:

```json
{
  "fileUrl": null,
  "mediaFileId": null
}
```

Lưu ý hiện tại: question-service chưa có consumer `media.file.deleted`, nên nếu xóa ảnh câu hỏi từ media-service thì cần bổ sung consumer hoặc xử lý manual để clear `questions.imageUrl` và `questions.mediaFileId`.

---

## Recommended Frontend Flow

### Flow Khuyến Nghị: Direct Upload

Áp dụng cho avatar, tài liệu khóa học, ảnh câu hỏi, ảnh/tài liệu nói chung.

```text
1. Frontend chọn file.
2. Frontend gọi POST /media/files/init.
3. Media-service trả mediaFileId, uploadUrl, publicUrl, expiresAt.
4. Frontend PUT file bytes trực tiếp lên uploadUrl.
5. PUT thành công thì frontend gọi business API để lưu mediaFileId + publicUrl.
6. Business service publish *.linked event.
7. Media-service consume event và mark FileObject = LINKED.
8. Khi cần render, frontend gọi GET /media/files/:mediaFileId/url.
9. Frontend dùng data.url làm src/href.
```

Ưu điểm:

- File bytes không đi qua NestJS service.
- Ít tải backend hơn.
- Phù hợp container private.
- `mediaFileId` là reference ổn định.

Nhược điểm:

- Frontend phải xử lý 2 bước: init rồi PUT Azure.
- Nếu PUT thành công nhưng chưa gọi business API, file sẽ còn trạng thái `UNLINKED`.

---

### Flow Đơn Giản: Server Upload

```text
1. Frontend gửi multipart POST /media/files.
2. Media-service upload Azure và tạo metadata LINKED.
3. Frontend lấy data.id làm mediaFileId.
4. Frontend gọi business API để lưu mediaFileId.
5. Business service vẫn nên publish *.linked event nếu aggregate đang hỗ trợ.
```

Flow này đơn giản hơn, nhưng file bytes đi qua media-service.

---

## Integration Với User-Service Avatar

### Upload avatar bằng direct upload

1. Init upload:

```http
POST /media/files/init
```

```json
{
  "originalName": "avatar.jpg",
  "mimeType": "image/jpeg",
  "fileSize": 204800
}
```

2. PUT file lên `data.uploadUrl`.

3. Update profile:

```http
PATCH /users/me
```

```json
{
  "avatarUrl": "https://account.blob.core.windows.net/media/uploads/2026/05/media-file-uuid.jpg",
  "mediaFileId": "media-file-uuid"
}
```

Hoặc admin update profile:

```http
PATCH /admin/users/:id
```

4. User-service publish:

```json
{
  "eventName": "user.avatar.linked",
  "userId": "user-uuid",
  "mediaFileId": "media-file-uuid"
}
```

5. Khi frontend render avatar:

```text
GET /media/files/:mediaFileId/url
```

Dùng `data.url` cho `<img src>`.

---

## Integration Với Course-Service Materials

Áp dụng cho PDF, DOC/DOCX, ảnh, video, audio nằm trong allowed MIME types.

1. Init upload:

```http
POST /media/files/init
```

```json
{
  "originalName": "giao-trinh-b2.pdf",
  "mimeType": "application/pdf",
  "fileSize": 1048576
}
```

2. PUT file lên Azure qua `data.uploadUrl`.

3. Add course material:

```http
POST /admin/courses/:id/materials
```

```json
{
  "title": "Giáo trình B2",
  "fileUrl": "https://account.blob.core.windows.net/media/uploads/2026/05/media-file-uuid.pdf",
  "mediaFileId": "media-file-uuid",
  "type": "PDF"
}
```

4. Course-service publish:

```json
{
  "eventName": "course.material.linked",
  "courseId": "course-uuid",
  "materialId": "material-uuid",
  "mediaFileId": "media-file-uuid"
}
```

5. Khi frontend mở tài liệu:

```text
GET /media/files/:mediaFileId/url
```

Dùng `data.url` làm `href` hoặc viewer URL.

---

## Integration Với Question-Service Images

Áp dụng cho ảnh câu hỏi hoặc ảnh biển báo/tình huống.

1. Init upload:

```http
POST /media/files/init
```

```json
{
  "originalName": "question-301.png",
  "mimeType": "image/png",
  "fileSize": 153600
}
```

2. PUT file lên Azure qua `data.uploadUrl`.

3. Create/update question:

```http
POST /admin/questions
```

hoặc:

```http
PATCH /admin/questions/:id
```

Body field liên quan:

```json
{
  "imageUrl": "https://account.blob.core.windows.net/media/uploads/2026/05/media-file-uuid.png",
  "mediaFileId": "media-file-uuid"
}
```

4. Question-service publish:

```json
{
  "eventName": "question.image.linked",
  "questionId": "question-uuid",
  "mediaFileId": "media-file-uuid"
}
```

5. Media-service consume event và mark file `LINKED`.

6. Exam-service khi start session snapshot `imageUrl` và `mediaFileId` từ question pool. Student exam UI render ảnh bằng:

```text
GET /media/files/:mediaFileId/url
```

---

## Integration Với Exam-Service

Exam-service không upload file. Nó chỉ nhận `imageUrl` và `mediaFileId` từ question-service khi tạo exam session snapshot.

Student exam response có:

```json
{
  "questionId": "question-uuid",
  "content": "Nội dung câu hỏi",
  "imageUrl": "https://account.blob.core.windows.net/media/uploads/2026/05/media-file-uuid.png",
  "mediaFileId": "media-file-uuid"
}
```

Frontend exam screen nên:

1. Nếu `mediaFileId != null`, gọi `GET /media/files/:mediaFileId/url`.
2. Dùng `data.url` làm `<img src>`.
3. Cache URL theo `mediaFileId` đến gần `expiresAt`.
4. Chỉ dùng `imageUrl` nếu container public hoặc để debug/fallback.

---

## Presigned URL Vs Stable Blob URL

| Field | Đến từ đâu | Dùng để làm gì | Có render trực tiếp được không |
| --- | --- | --- | --- |
| `publicUrl` | `POST /media/files/init` | Stable blob URL fallback/debug | Chỉ được nếu container/blob public |
| `avatarUrl` | user-service profile | Stable blob URL đã lưu vào profile | Chỉ được nếu container/blob public |
| `fileUrl` | course material | Stable blob URL đã lưu vào material | Chỉ được nếu container/blob public |
| `imageUrl` | question/exam | Stable blob URL đã lưu vào question snapshot | Chỉ được nếu container/blob public |
| `data.url` từ `GET /media/files/:id/url` | media-service | Presigned/SAS read URL ngắn hạn | Có, đây là đường chính cho private container |

Contract frontend nên nhớ:

```text
Có mediaFileId -> gọi media-service lấy presigned URL -> render bằng data.url
Không có mediaFileId nhưng có imageUrl/avatarUrl/fileUrl -> chỉ dùng fallback nếu URL public
```

---

## Event Flow

### Events Media-Service Publishes

`media.file.uploaded` khi server upload thành công:

```json
{
  "eventName": "media.file.uploaded",
  "fileId": "media-file-uuid",
  "storageKey": "uploads/2026/05/media-file-uuid.jpg",
  "originalName": "avatar.jpg",
  "mimeType": "image/jpeg",
  "fileSize": 204800,
  "uploadedById": "user-uuid"
}
```

`media.file.deleted` khi admin delete file:

```json
{
  "eventName": "media.file.deleted",
  "fileId": "media-file-uuid",
  "storageKey": "uploads/2026/05/media-file-uuid.jpg",
  "deletedById": "admin-user-uuid"
}
```

### Events Media-Service Consumes

| Event | Source | Effect |
| --- | --- | --- |
| `user.avatar.linked` | user-service | Mark file `LINKED` |
| `course.material.linked` | course-service | Mark file `LINKED` |
| `question.image.linked` | question-service | Mark file `LINKED` |

Minimal payload:

```json
{
  "mediaFileId": "media-file-uuid"
}
```

Nếu media-service không tìm thấy file khi nhận event linked, nó chỉ log warning và ack, không throw.

---

## Deletion Flow And Caveats

Khi gọi:

```http
DELETE /admin/media/files/:id
```

media-service thực hiện:

```text
1. Find FileObject.
2. Add media.file.deleted domain event.
3. Delete metadata khỏi media_db.
4. Delete blob khỏi Azure.
5. Publish media.file.deleted.
6. Broadcast event tới user-service và course-service.
```

Tradeoff trong code hiện tại: service xóa DB trước rồi xóa Azure. Nếu Azure delete fail sau khi DB đã xóa, blob có thể bị orphan. Cách này tránh dangling DB record trỏ tới file không còn tồn tại.

Caveat hiện tại:

- User avatar cleanup đã có.
- Course material cleanup đã có.
- Question image cleanup khi media file bị xóa chưa có consumer tương ứng trong question-service.

---

## Frontend Implementation Pattern

Pseudo-code direct upload:

```ts
async function uploadViaMedia(file: File) {
  const init = await api.post('/media/files/init', {
    originalName: file.name,
    mimeType: file.type,
    fileSize: file.size,
  });

  await fetch(init.data.uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type,
      'x-ms-blob-type': 'BlockBlob',
    },
    body: file,
  });

  return {
    mediaFileId: init.data.mediaFileId,
    publicUrl: init.data.publicUrl,
  };
}
```

Pseudo-code render:

```ts
const mediaUrlCache = new Map<string, { url: string; expiresAt: string }>();

async function getRenderableMediaUrl(mediaFileId: string) {
  const cached = mediaUrlCache.get(mediaFileId);
  if (cached && new Date(cached.expiresAt).getTime() - Date.now() > 60_000) {
    return cached.url;
  }

  const response = await api.get(`/media/files/${mediaFileId}/url`);
  mediaUrlCache.set(mediaFileId, response.data);
  return response.data.url;
}
```

---

## Backend Integration Checklist

Khi một service mới cần dùng media-service:

1. Thêm field `mediaFileId` vào entity/DTO response.
2. Nếu cần fallback URL, thêm field semantic như `avatarUrl`, `fileUrl`, hoặc `imageUrl`.
3. Không tạo FK cross-service tới `media_db`; chỉ lưu UUID string.
4. Khi entity lưu `mediaFileId`, publish event `<service>.<entity>.linked` với payload tối thiểu `{ mediaFileId }`.
5. Thêm handler trong media-service `MessagingController` cho event mới.
6. Nếu file deletion cần cleanup reference, subscribe `media.file.deleted` trong service đó.
7. API response cho frontend phải trả `mediaFileId` để frontend gọi `GET /media/files/:id/url`.

---

## Recommended Defaults

- Upload mới từ frontend: dùng `POST /media/files/init` + PUT Azure.
- Render ảnh/file: luôn ưu tiên `mediaFileId -> GET /media/files/:id/url`.
- Lưu business entity: lưu cả `mediaFileId` và stable URL fallback nếu field hiện có hỗ trợ.
- Delete file: chỉ cho admin/center manager; cân nhắc cleanup ở service đang reference file.
- Không expose raw question/admin response chứa đáp án đúng cho student chỉ vì có image metadata; exam-service đã snapshot và strip đáp án đúng cho student flow.
