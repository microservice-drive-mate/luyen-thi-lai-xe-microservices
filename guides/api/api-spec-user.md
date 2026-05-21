# User Service API Specification

**Base URL qua Kong:** `http://localhost:8000`  
**Service paths:** `/users`, `/admin/users`  
**Direct local:** `http://localhost:3002`  
**Swagger UI:** `http://localhost:3002/docs`  
**Swagger UI qua Kong:** `http://localhost:8000/user-service/docs`  
**OpenAPI JSON:** `http://localhost:3002/docs-json`  
**OpenAPI JSON qua Kong:** `http://localhost:8000/user-service/docs-json`  
**Version:** 1.0.0

Business API path là `/users/*` cho self-service profile và `/admin/users/*` cho admin dashboard quản lý profile. Swagger/docs path là `/user-service/docs`.

In this bounded context, `/users` means user profiles: display information, student detail, license tier, avatar, and profile active state. Account/Keycloak user lifecycle belongs to `identity-service /admin/identity-users/*`.

---

## Frontend Account/Profile Flow

Frontend cần hiểu `identity-service` và `user-service` là 2 bước khác nhau:

| Service | Gọi khi nào |
| ------- | ----------- |
| `identity-service` | Khi cần tạo account đăng nhập, login, refresh token, đổi role, khóa/mở khóa đăng nhập, xóa account. |
| `user-service` | Khi cần đọc/cập nhật profile, avatar, thông tin học viên, hạng bằng lái. |

Flow tạo user bình thường:

1. Admin dashboard gọi `POST /admin/identity-users` bên identity-service.
2. Lấy `data.userId` từ response. `userId` này là Keycloak `sub` và cũng là `id` của profile bên user-service.
3. Identity-service publish event `identity.user.created`.
4. User-service tự tạo profile tối thiểu từ event.
5. Admin dashboard gọi `GET /admin/users/:userId` để đọc profile. Nếu nhận `404` ngay sau khi tạo account, retry vài lần vì RabbitMQ đồng bộ bất đồng bộ.
6. Gọi `PATCH /admin/users/:userId` để cập nhật profile.
7. Nếu user là học viên, gọi `PATCH /admin/users/:userId/license-tier` để gán hạng giấy phép.
8. Khi user đăng nhập app, gọi `POST /auth/login`, lưu access token, rồi gọi `GET /users/me` để lấy profile của chính user.

Không dùng `POST /admin/users` để tạo account đăng nhập. Endpoint này chỉ dùng cho backfill/manual profile khi account Keycloak đã tồn tại nhưng profile chưa có.

Role là nguồn đúng từ identity-service. User-service chỉ giữ bản sao role để query/profile và sẽ đồng bộ qua event.

---

## Tổng Quan Xác Thực

User-service dùng `nest-keycloak-connect`.

| Endpoint                        | Auth hiện tại            |
| ------------------------------- | ------------------------ |
| `POST /admin/users`             | `ADMIN`, `CENTER_MANAGER` |
| `GET /admin/users`              | `ADMIN`, `CENTER_MANAGER` |
| `GET /users/me`                 | JWT hợp lệ               |
| `GET /admin/users/:id`          | `ADMIN`, `CENTER_MANAGER` |
| `PATCH /users/me`               | JWT hợp lệ               |
| `PATCH /admin/users/:id`        | `ADMIN`                  |
| `PATCH /admin/users/:id/lock`   | `ADMIN`, `CENTER_MANAGER` |
| `PATCH /admin/users/:id/license-tier` | `ADMIN`, `CENTER_MANAGER` |

Các endpoint `me` lấy user hiện tại từ `@AuthenticatedUser()` (`sub` trong JWT), không đọc trực tiếp `x-user-id`.

| Event                        | User-service behavior                                |
| ---------------------------- | ---------------------------------------------------- |
| `identity.user.created`      | Tạo `UserProfile` idempotent theo Keycloak user id   |
| `identity.user.updated`      | Đồng bộ `email`, `fullName`                          |
| `identity.user.role-changed` | Đồng bộ role và tạo/xóa `StudentDetail` nếu cần      |
| `identity.user.locked`       | Set `isActive = !locked`                             |
| `identity.user.deleted`      | Soft-deactivate profile bằng `isActive = false`      |

---

## Response Format

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-14T10:00:00.000Z",
  "path": "/users/me",
  "data": {}
}
```

Lỗi domain:

```json
{
  "success": false,
  "code": "USER_PROFILE_NOT_FOUND",
  "message": "User profile not found: abc",
  "timestamp": "2026-05-14T10:00:00.000Z",
  "path": "/users/abc"
}
```

---

## Error Codes

| HTTP | Code                     | Nguyên nhân                                  |
| ---: | ------------------------ | -------------------------------------------- |
|  400 | `VALIDATION_ERROR`       | Body/query không hợp lệ                      |
|  401 | `UNAUTHORIZED`           | Thiếu hoặc sai JWT                           |
|  403 | `FORBIDDEN`              | Role không đủ quyền                          |
|  404 | `USER_PROFILE_NOT_FOUND` | Không tìm thấy user profile                  |
|  409 | `USER_ALREADY_EXISTS`    | User/email đã tồn tại                        |
|  422 | `USER_NOT_STUDENT`       | Thao tác chỉ áp dụng cho user role `STUDENT` |

---

## Enums

### UserRole

`ADMIN` | `CENTER_MANAGER` | `INSTRUCTOR` | `STUDENT`

### Gender

`MALE` | `FEMALE` | `OTHER`

### LicenseTier

`A1` | `A2` | `B1` | `B2` | `C` | `D` | `E` | `F`

---

## Shared Response Shape

User profile object:

```json
{
  "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "fullName": "Nguyễn Văn A",
  "email": "a@example.com",
  "phoneNumber": "0912345678",
  "dateOfBirth": "2000-01-15T00:00:00.000Z",
  "avatarUrl": "https://storage.blob.core.windows.net/media/uploads/2026/05/avatar.jpg",
  "mediaFileId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "gender": "MALE",
  "address": "TP.HCM",
  "role": "STUDENT",
  "isActive": true,
  "createdAt": "2026-05-14T10:00:00.000Z",
  "studentDetail": {
    "licenseTier": "B2",
    "enrolledAt": "2026-05-14T10:00:00.000Z",
    "notes": "Ghi chú"
  }
}
```

`studentDetail` là `null` nếu user không có role `STUDENT`.

---

## Endpoints

### POST `/admin/users`

Tạo user profile cho một identity user đã tồn tại trong Keycloak/identity-service. Endpoint này cần `ADMIN` hoặc `CENTER_MANAGER`.

Best practice: không dùng endpoint này để tạo account đăng nhập. Tạo account qua identity-service trước, lấy `userId`, rồi dùng id đó làm `id` trong body nếu cần tạo profile trực tiếp. Nếu profile đã được tạo bởi event, dùng `PATCH /admin/users/:id` và `PATCH /admin/users/:id/license-tier` để bổ sung thông tin.

**Body**

```json
{
  "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "fullName": "Nguyễn Văn A",
  "email": "a@example.com",
  "role": "STUDENT",
  "phoneNumber": "0912345678",
  "dateOfBirth": "2000-01-15",
  "gender": "MALE",
  "address": "TP.HCM",
  "avatarUrl": "https://storage.blob.core.windows.net/media/uploads/2026/05/avatar.jpg",
  "mediaFileId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "licenseTier": "B2",
  "enrolledAt": "2026-05-14"
}
```

| Field         | Type        | Required | Validation                       |
| ------------- | ----------- | -------- | -------------------------------- |
| `id`          | string      | Yes      | Non-empty string                 |
| `fullName`    | string      | Yes      | Non-empty                        |
| `email`       | string      | Yes      | Email                            |
| `role`        | UserRole    | Yes      | Enum                             |
| `phoneNumber` | string      | No       | Vietnamese phone number          |
| `dateOfBirth` | date        | No       | Converted by `class-transformer` |
| `gender`      | Gender      | No       | Enum                             |
| `address`     | string      | No       | -                                |
| `avatarUrl`   | string      | No       | URL                              |
| `mediaFileId` | string      | No       | UUID                             |
| `licenseTier` | LicenseTier | No       | Enum                             |
| `enrolledAt`  | date        | No       | Converted by `class-transformer` |

**Response `201 Created`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "Created",
  "data": {
    "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "fullName": "Nguyễn Văn A",
    "email": "a@example.com",
    "role": "STUDENT"
  }
}
```

---

### GET `/admin/users`

Danh sách user có phân trang và filter.

**Auth:** `ADMIN`, `CENTER_MANAGER`

**Query**

| Param      | Type     | Default | Validation        |
| ---------- | -------- | ------: | ----------------- |
| `page`     | number   |       1 | integer, `>= 1`   |
| `size`     | number   |      20 | integer, `1..100` |
| `role`     | UserRole |       - | enum              |
| `isActive` | boolean  |       - | boolean           |
| `search`   | string   |       - | optional          |

**Response `200 OK`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "data": {
    "items": [
      {
        "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        "fullName": "Nguyễn Văn A",
        "email": "a@example.com",
        "phoneNumber": "0912345678",
        "dateOfBirth": "2000-01-15T00:00:00.000Z",
        "avatarUrl": "https://storage.blob.core.windows.net/media/uploads/2026/05/avatar.jpg",
        "mediaFileId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "gender": "MALE",
        "address": "TP.HCM",
        "role": "STUDENT",
        "isActive": true,
        "createdAt": "2026-05-14T10:00:00.000Z",
        "studentDetail": {
          "licenseTier": "B2",
          "enrolledAt": "2026-05-14T10:00:00.000Z",
          "notes": "Ghi chú"
        }
      }
    ],
    "total": 1,
    "page": 1,
    "size": 20
  }
}
```

---

### GET `/users/me`

Lấy profile của user đang đăng nhập. `userId = JWT.sub`.

**Auth:** JWT hợp lệ.

**Response `200 OK`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "data": {
    "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "fullName": "Nguyễn Văn A",
    "email": "a@example.com",
    "phoneNumber": "0912345678",
    "dateOfBirth": "2000-01-15T00:00:00.000Z",
    "avatarUrl": "https://storage.blob.core.windows.net/media/uploads/2026/05/avatar.jpg",
    "mediaFileId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "gender": "MALE",
    "address": "TP.HCM",
    "role": "STUDENT",
    "isActive": true,
    "createdAt": "2026-05-14T10:00:00.000Z",
    "studentDetail": {
      "licenseTier": "B2",
      "enrolledAt": "2026-05-14T10:00:00.000Z",
      "notes": "Ghi chú"
    }
  }
}
```

---

### GET `/admin/users/:id`

Lấy profile theo id.

**Auth:** `ADMIN`, `CENTER_MANAGER`.

**Response `200 OK`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "data": {
    "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "fullName": "Nguyễn Văn A",
    "email": "a@example.com",
    "phoneNumber": "0912345678",
    "dateOfBirth": "2000-01-15T00:00:00.000Z",
    "avatarUrl": "https://storage.blob.core.windows.net/media/uploads/2026/05/avatar.jpg",
    "mediaFileId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "gender": "MALE",
    "address": "TP.HCM",
    "role": "STUDENT",
    "isActive": true,
    "createdAt": "2026-05-14T10:00:00.000Z",
    "studentDetail": {
      "licenseTier": "B2",
      "enrolledAt": "2026-05-14T10:00:00.000Z",
      "notes": "Ghi chú"
    }
  }
}
```

---

### PATCH `/users/me`

Cập nhật profile của user đang đăng nhập. `userId = JWT.sub`.

**Body:** tất cả field đều optional.

```json
{
  "fullName": "Nguyễn Văn B",
  "phoneNumber": "0987654321",
  "dateOfBirth": "2000-05-20",
  "gender": "FEMALE",
  "address": "Hà Nội",
  "avatarUrl": "https://storage.blob.core.windows.net/media/uploads/2026/05/avatar.jpg",
  "mediaFileId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "notes": "Ghi chú mới"
}
```

| Field         | Type   | Validation              |
| ------------- | ------ | ----------------------- |
| `fullName`    | string | optional                |
| `phoneNumber` | string | Vietnamese phone number |
| `dateOfBirth` | date   | converted               |
| `gender`      | Gender | enum                    |
| `address`     | string | optional                |
| `avatarUrl`   | string | URL                     |
| `mediaFileId` | string | UUID                    |
| `notes`       | string | optional                |

**Response `200 OK`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "data": {
    "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "fullName": "Nguyễn Văn B",
    "email": "a@example.com",
    "phoneNumber": "0987654321",
    "dateOfBirth": "2000-05-20T00:00:00.000Z",
    "avatarUrl": "https://storage.blob.core.windows.net/media/uploads/2026/05/avatar.jpg",
    "mediaFileId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "gender": "FEMALE",
    "address": "Hà Nội",
    "role": "STUDENT",
    "isActive": true,
    "createdAt": "2026-05-14T10:00:00.000Z",
    "studentDetail": {
      "licenseTier": "B2",
      "enrolledAt": "2026-05-14T10:00:00.000Z",
      "notes": "Ghi chú mới"
    }
  }
}
```

Nếu body có `mediaFileId`, user-service phát event `user.avatar.linked`.

---

### PATCH `/admin/users/:id`

Cập nhật profile theo id.

**Auth:** `ADMIN`.

**Body:** giống `PATCH /users/me`.

**Response `200 OK`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "data": {
    "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "fullName": "Nguyễn Văn B",
    "email": "a@example.com",
    "phoneNumber": "0987654321",
    "dateOfBirth": "2000-05-20T00:00:00.000Z",
    "avatarUrl": "https://storage.blob.core.windows.net/media/uploads/2026/05/avatar.jpg",
    "mediaFileId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "gender": "FEMALE",
    "address": "Hà Nội",
    "role": "STUDENT",
    "isActive": true,
    "createdAt": "2026-05-14T10:00:00.000Z",
    "studentDetail": {
      "licenseTier": "B2",
      "enrolledAt": "2026-05-14T10:00:00.000Z",
      "notes": "Ghi chú mới"
    }
  }
}
```

---

### PATCH `/admin/users/:id/lock`

Khóa hoặc mở khóa user profile trong user-service.

**Auth:** `ADMIN`, `CENTER_MANAGER`.

**Body**

```json
{
  "lock": true
}
```

| Field  | Type    | Required | Mô tả                                                 |
| ------ | ------- | -------- | ----------------------------------------------------- |
| `lock` | boolean | Yes      | `true` = khóa/deactivate, `false` = mở khóa/activate |

**Response `204 No Content`**

Không có body.

---

### PATCH `/admin/users/:id/license-tier`

Gán hạng giấy phép cho học viên và ghi audit trail. `changedById = JWT.sub`.

**Auth:** `ADMIN`, `CENTER_MANAGER`.

**Body**

```json
{
  "licenseTier": "B2"
}
```

**Response `204 No Content`**

Không có body.

**Event published:** `user.student.license-assigned`.

```json
{
  "eventName": "user.student.license-assigned",
  "studentId": "student-uuid",
  "studentEmail": "a@example.com",
  "studentFullName": "Nguyễn Văn A",
  "oldLicenseTier": null,
  "newLicenseTier": "B2",
  "changedById": "admin-uuid"
}
```

---

## Events Consumed

User-service consume queue `user_service_events`.

### `identity.user.created`

```json
{
  "eventName": "identity.user.created",
  "userId": "keycloak-uuid",
  "email": "a@example.com",
  "fullName": "Nguyễn Văn A",
  "role": "STUDENT"
}
```

Tạo `UserProfile`; nếu role là `STUDENT` thì tạo `StudentDetail`.

### `identity.user.role-changed`

```json
{
  "eventName": "identity.user.role-changed",
  "userId": "keycloak-uuid",
  "newRole": "INSTRUCTOR"
}
```

Đồng bộ role cho `UserProfile`; tạo hoặc xóa `StudentDetail` tùy role mới.

### `identity.user.updated`

```json
{
  "eventName": "identity.user.updated",
  "userId": "keycloak-uuid",
  "email": "new-email@example.com",
  "fullName": "New Name"
}
```

Đồng bộ `email` và `fullName` cho `UserProfile`.

### `identity.user.locked`

```json
{
  "eventName": "identity.user.locked",
  "userId": "keycloak-uuid",
  "locked": true
}
```

Set `isActive = !locked`.

### `identity.user.deleted`

```json
{
  "eventName": "identity.user.deleted",
  "userId": "keycloak-uuid",
  "deletedById": "admin-keycloak-user-id"
}
```

Soft-deactivate profile bằng `isActive = false`.

### `media.file.deleted`

```json
{
  "eventName": "media.file.deleted",
  "fileId": "media-file-uuid",
  "storageKey": "uploads/2026/05/avatar.jpg",
  "deletedById": "user-uuid"
}
```

Nếu profile nào đang dùng `mediaFileId = fileId`, user-service set `avatarUrl = null` và `mediaFileId = null`.

---

## Events Published

### `user.avatar.linked`

```json
{
  "eventName": "user.avatar.linked",
  "userId": "user-uuid",
  "mediaFileId": "media-file-uuid"
}
```

Media-service dùng event này để mark file `LINKED`.

### `user.student.license-assigned`

Payload xem endpoint `PATCH /admin/users/:id/license-tier`.
