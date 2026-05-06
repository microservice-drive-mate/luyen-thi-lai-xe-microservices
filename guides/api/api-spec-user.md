# User Service API Specification

**Base URL (qua Kong):** `http://localhost:8000`
**Service path:** `/users`
**Version:** 1.0.0

---

## Tổng quan xác thực

Tất cả các endpoint (trừ `POST /users`) đều yêu cầu JWT hợp lệ do Keycloak phát hành.

Kong gateway:

1. Xác thực chữ ký JWT (`exp`, `iss`)
2. Inject các header vào request trước khi forward xuống service:
   - `x-user-id` — `sub` claim từ JWT (Keycloak user UUID)
   - `x-user-role` — role của user (từ Keycloak token claims)

**Header Authorization:**

```
Authorization: Bearer <keycloak_access_token>
```

---

## Response Format

Tất cả response đều theo cấu trúc sau (bao gồm cả lỗi):

```json
// Thành công
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-06T10:00:00.000Z",
  "path": "/users/me",
  "data": { ... }
}

// Lỗi
{
  "success": false,
  "code": "USER_PROFILE_NOT_FOUND",
  "message": "User profile not found: abc-123",
  "timestamp": "2026-05-06T10:00:00.000Z",
  "path": "/users/abc-123"
}
```

---

## Error Codes

| HTTP Status | code                     | Nguyên nhân                                  |
| ----------- | ------------------------ | -------------------------------------------- |
| 400         | `VALIDATION_ERROR`       | Request body/query không hợp lệ              |
| 400         | `USER_NOT_STUDENT`       | Gán license tier cho user không phải STUDENT |
| 401         | `UNAUTHORIZED`           | Thiếu hoặc JWT không hợp lệ                  |
| 404         | `USER_PROFILE_NOT_FOUND` | Không tìm thấy user profile theo ID          |
| 409         | `USER_ALREADY_EXISTS`    | Email đã tồn tại trong hệ thống              |
| 422         | `USER_NOT_STUDENT`       | Xem bên trên                                 |
| 500         | `INTERNAL_ERROR`         | Lỗi server                                   |

---

## Enums

### UserRole

| Value            | Ý nghĩa           |
| ---------------- | ----------------- |
| `ADMIN`          | Quản trị viên     |
| `CENTER_MANAGER` | Quản lý trung tâm |
| `INSTRUCTOR`     | Giáo viên         |
| `STUDENT`        | Học viên          |

### Gender

| Value    | Ý nghĩa |
| -------- | ------- |
| `MALE`   | Nam     |
| `FEMALE` | Nữ      |
| `OTHER`  | Khác    |

### LicenseTier

`A1` | `A2` | `B1` | `B2` | `C` | `D` | `E` | `F`

---

## Shared Types

### UserProfileResponse

```json
{
  "id": "uuid",
  "fullName": "Nguyễn Văn A",
  "email": "a@example.com",
  "phoneNumber": "0912345678",
  "dateOfBirth": "2000-01-15T00:00:00.000Z",
  "avatarUrl": "https://...",
  "gender": "MALE",
  "address": "123 Đường ABC, TP.HCM",
  "role": "STUDENT",
  "isActive": true,
  "createdAt": "2026-01-01T00:00:00.000Z",
  "studentDetail": {
    "licenseTier": "B2",
    "enrolledAt": "2026-01-01T00:00:00.000Z",
    "notes": "Học viên cần ôn thêm phần biển báo"
  }
}
```

> `studentDetail` là `null` nếu `role !== "STUDENT"`.

---

## Endpoints

---

### POST /users

> **Nội bộ** — Tạo user profile. Thường được gọi tự động bởi `MessagingController` khi nhận event `identity.user.created` từ RabbitMQ (do identity-service/Keycloak emit). Endpoint HTTP này chỉ dùng cho testing hoặc trường hợp tạo thủ công.

**Auth:** Yêu cầu JWT (Kong JWT plugin)

**Request Body:**

```json
{
  "id": "keycloak-user-uuid",
  "fullName": "Nguyễn Văn A",
  "email": "a@example.com",
  "role": "STUDENT",
  "phoneNumber": "0912345678",
  "dateOfBirth": "2000-01-15",
  "gender": "MALE",
  "address": "123 Đường ABC, TP.HCM",
  "avatarUrl": "https://...",
  "licenseTier": "B2",
  "enrolledAt": "2026-01-01"
}
```

| Field         | Type        | Required | Validation                                   |
| ------------- | ----------- | -------- | -------------------------------------------- |
| `id`          | string      | ✅       | UUID (= Keycloak user ID)                    |
| `fullName`    | string      | ✅       | Non-empty                                    |
| `email`       | string      | ✅       | Valid email format                           |
| `role`        | UserRole    | ✅       | Một trong các giá trị UserRole               |
| `phoneNumber` | string      | ❌       | SĐT Việt Nam: `0[3-9]XXXXXXXX` hoặc `+84...` |
| `dateOfBirth` | string      | ❌       | ISO date string                              |
| `gender`      | Gender      | ❌       | Một trong các giá trị Gender                 |
| `address`     | string      | ❌       |                                              |
| `avatarUrl`   | string      | ❌       |                                              |
| `licenseTier` | LicenseTier | ❌       | Chỉ có ý nghĩa khi `role = STUDENT`          |
| `enrolledAt`  | string      | ❌       | ISO date string, ngày nhập học               |

**Response `201` — Tạo thành công:**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-06T10:00:00.000Z",
  "path": "/users",
  "data": {
    "id": "keycloak-user-uuid",
    "fullName": "Nguyễn Văn A",
    "email": "a@example.com",
    "role": "STUDENT"
  }
}
```

**Errors:**

| Status | code                  | Nguyên nhân       |
| ------ | --------------------- | ----------------- |
| 400    | `VALIDATION_ERROR`    | Body không hợp lệ |
| 409    | `USER_ALREADY_EXISTS` | Email đã tồn tại  |

---

### GET /users

> Lấy danh sách user có phân trang và lọc. Dành cho admin và center manager.

**Auth:** Yêu cầu JWT

**Query Parameters:**

| Param      | Type     | Default | Validation          | Mô tả                         |
| ---------- | -------- | ------- | ------------------- | ----------------------------- |
| `page`     | number   | 1       | ≥ 1                 | Số trang                      |
| `size`     | number   | 20      | ≥ 1, ≤ 100          | Số item mỗi trang             |
| `role`     | UserRole | —       | Enum UserRole       | Lọc theo role                 |
| `isActive` | boolean  | —       | `true` hoặc `false` | Lọc theo trạng thái hoạt động |
| `search`   | string   | —       |                     | Tìm theo tên, email, SĐT      |

**Response `200`:**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-06T10:00:00.000Z",
  "path": "/users",
  "data": {
    "items": [
      /* UserProfileResponse[] */
    ],
    "total": 42,
    "page": 1,
    "size": 20
  }
}
```

---

### GET /users/me

> Lấy profile của chính user đang đăng nhập. Kong inject `x-user-id` từ JWT sub claim.

**Auth:** Yêu cầu JWT  
**Kong header:** `x-user-id` (auto-injected)

**Response `200`:**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-06T10:00:00.000Z",
  "path": "/users/me",
  "data": {
    /* UserProfileResponse */
  }
}
```

**Errors:**

| Status | code                     | Nguyên nhân                           |
| ------ | ------------------------ | ------------------------------------- |
| 401    | `UNAUTHORIZED`           | JWT thiếu hoặc không hợp lệ           |
| 404    | `USER_PROFILE_NOT_FOUND` | Profile chưa được tạo cho Keycloak ID |

---

### GET /users/:id

> Lấy profile của bất kỳ user nào theo ID. Dành cho admin và center manager.

**Auth:** Yêu cầu JWT

**Path Params:**

| Param | Type   | Mô tả                 |
| ----- | ------ | --------------------- |
| `id`  | string | UUID của user cần lấy |

**Response `200`:**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-06T10:00:00.000Z",
  "path": "/users/abc-uuid",
  "data": {
    /* UserProfileResponse */
  }
}
```

**Errors:**

| Status | code                     | Nguyên nhân         |
| ------ | ------------------------ | ------------------- |
| 404    | `USER_PROFILE_NOT_FOUND` | Không tìm thấy user |

---

### PATCH /users/me

> Cập nhật profile của chính user đang đăng nhập. Kong inject `x-user-id`.

**Auth:** Yêu cầu JWT  
**Kong header:** `x-user-id` (auto-injected)

**Request Body** (tất cả optional — chỉ gửi field cần thay đổi):

```json
{
  "fullName": "Nguyễn Văn B",
  "phoneNumber": "0987654321",
  "dateOfBirth": "2000-05-20",
  "gender": "FEMALE",
  "address": "456 Đường XYZ, Hà Nội",
  "avatarUrl": "https://...",
  "notes": "Ghi chú của học viên"
}
```

| Field         | Type   | Validation                       |
| ------------- | ------ | -------------------------------- |
| `fullName`    | string | Non-empty string                 |
| `phoneNumber` | string | SĐT Việt Nam hợp lệ              |
| `dateOfBirth` | string | ISO date string                  |
| `gender`      | Gender | Enum Gender                      |
| `address`     | string |                                  |
| `avatarUrl`   | string |                                  |
| `notes`       | string | Chỉ áp dụng nếu `role = STUDENT` |

**Response `200`** — Trả về profile đã cập nhật:

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-06T10:00:00.000Z",
  "path": "/users/me",
  "data": {
    /* UserProfileResponse với data mới */
  }
}
```

**Errors:**

| Status | code                     | Nguyên nhân           |
| ------ | ------------------------ | --------------------- |
| 400    | `VALIDATION_ERROR`       | Body không hợp lệ     |
| 404    | `USER_PROFILE_NOT_FOUND` | Profile không tồn tại |

---

### PATCH /users/:id

> Cập nhật profile của bất kỳ user nào. Dành cho admin.

**Auth:** Yêu cầu JWT

**Path Params:**

| Param | Type   | Mô tả                    |
| ----- | ------ | ------------------------ |
| `id`  | string | UUID của user cần update |

**Request Body:** Giống `PATCH /users/me`

**Response `200`** — Trả về profile đã cập nhật:

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-06T10:00:00.000Z",
  "path": "/users/abc-uuid",
  "data": {
    /* UserProfileResponse với data mới */
  }
}
```

**Errors:**

| Status | code                     | Nguyên nhân         |
| ------ | ------------------------ | ------------------- |
| 400    | `VALIDATION_ERROR`       | Body không hợp lệ   |
| 404    | `USER_PROFILE_NOT_FOUND` | Không tìm thấy user |

---

### PATCH /users/:id/lock

> Khóa hoặc mở khóa một tài khoản user. Dành cho admin và center manager.

**Auth:** Yêu cầu JWT

**Path Params:**

| Param | Type   | Mô tả                         |
| ----- | ------ | ----------------------------- |
| `id`  | string | UUID của user cần lock/unlock |

**Request Body:**

```json
{ "lock": true }
```

| Field  | Type    | Required | Mô tả                                                 |
| ------ | ------- | -------- | ----------------------------------------------------- |
| `lock` | boolean | ✅       | `true` = khóa (`isActive = false`); `false` = mở khóa |

**Response `204 No Content`** — Không có body.

**Errors:**

| Status | code                     | Nguyên nhân         |
| ------ | ------------------------ | ------------------- |
| 400    | `VALIDATION_ERROR`       | Body không hợp lệ   |
| 404    | `USER_PROFILE_NOT_FOUND` | Không tìm thấy user |

> **Lưu ý:** Khi user bị khóa (`isActive = false`), Keycloak vẫn có thể phát JWT hợp lệ cho họ. Việc kiểm tra `isActive` ở tầng nghiệp vụ là trách nhiệm của từng service khi xử lý request.

---

### PATCH /users/:id/license-tier

> Gán hạng bằng lái cho một học viên. Ghi nhận audit trail (ai đổi, đổi từ hạng nào sang hạng nào, lúc nào). Emit domain event `user.student.license-assigned` lên RabbitMQ.

**Auth:** Yêu cầu JWT  
**Kong header:** `x-user-id` (auto-injected — dùng làm `changedById` trong audit log)

**Path Params:**

| Param | Type   | Mô tả                          |
| ----- | ------ | ------------------------------ |
| `id`  | string | UUID của học viên cần gán hạng |

**Request Body:**

```json
{ "licenseTier": "B2" }
```

| Field         | Type        | Required | Validation                        |
| ------------- | ----------- | -------- | --------------------------------- |
| `licenseTier` | LicenseTier | ✅       | Một trong các giá trị LicenseTier |

**Response `204 No Content`** — Không có body.

**Errors:**

| Status | code                     | Nguyên nhân                  |
| ------ | ------------------------ | ---------------------------- |
| 400    | `VALIDATION_ERROR`       | Body không hợp lệ            |
| 404    | `USER_PROFILE_NOT_FOUND` | Không tìm thấy user          |
| 422    | `USER_NOT_STUDENT`       | User không có role `STUDENT` |

> **Domain Event phát ra:**
>
> - Event name: `user.student.license-assigned`
> - Payload: `{ studentId, email, fullName, oldLicenseTier, newLicenseTier, changedById, occurredAt }`
> - Consumed bởi: `notification-service` (gửi thông báo), `analytics-service` (cập nhật scope học)

---

## Luồng event từ identity-service

User-service lắng nghe 2 event từ RabbitMQ queue `user_service_events`:

### `identity.user.created`

Phát ra bởi identity-service khi Keycloak tạo user mới.

**Payload:**

```json
{
  "userId": "keycloak-uuid",
  "email": "a@example.com",
  "fullName": "Nguyễn Văn A",
  "role": "STUDENT"
}
```

**Xử lý:** Tạo `UserProfile` (và `StudentDetail` nếu `role = STUDENT`) trong DB.

---

### `identity.user.role-changed`

Phát ra bởi identity-service khi admin đổi role của user trong Keycloak.

**Payload:**

```json
{
  "userId": "keycloak-uuid",
  "newRole": "INSTRUCTOR"
}
```

**Xử lý:** Gọi `UserProfile.syncRole()`:

- Nếu được promote lên `STUDENT` → tạo `StudentDetail`
- Nếu bị demote khỏi `STUDENT` → xóa `StudentDetail`

---

## Rate Limiting

Cấu hình tại Kong (global):

| Giới hạn   | Giá trị         |
| ---------- | --------------- |
| Per second | 5 req/giây/IP   |
| Per hour   | 1000 req/giờ/IP |

Khi vượt quá: `429 Too Many Requests`

---

## Swagger UI

| Môi trường | URL                                                 |
| ---------- | --------------------------------------------------- |
| Local      | `http://localhost:3000/docs`                        |
| Qua Kong   | `http://localhost:8000/user-service/docs` (cần JWT) |

---

## Audit Trail

Mỗi lần gán/thay đổi `licenseTier`, hệ thống tạo một bản ghi `LicenseAssignmentAudit`:

```
LicenseAssignmentAudit
├── id: UUID
├── studentId: UUID (→ user_profiles)
├── oldLicenseTier: LicenseTier | null
├── newLicenseTier: LicenseTier
├── changedById: UUID (Keycloak ID của người thực hiện)
└── changedAt: TIMESTAMPTZ
```

Audit được ghi trong cùng một Prisma transaction với việc update `StudentDetail`, đảm bảo tính nhất quán.
