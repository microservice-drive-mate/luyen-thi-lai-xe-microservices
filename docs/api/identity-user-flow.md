# Identity And User Service Flow

Tài liệu này mô tả cách `identity-service` và `user-service` phối hợp với nhau trong các flow liên quan đến tài khoản đăng nhập và hồ sơ người dùng.

---

## Trách Nhiệm Service

| Service | Trách nhiệm chính | Không chịu trách nhiệm |
| ------- | ----------------- | ---------------------- |
| `identity-service` | Tạo account Keycloak, đăng nhập, refresh token, quên mật khẩu, role, lock/unlock login, soft delete account. | Không lưu profile chi tiết như ngày sinh, số điện thoại, avatar, hạng bằng lái. |
| `user-service` | Lưu profile hiển thị, thông tin học viên, avatar, `mediaFileId`, hạng giấy phép, trạng thái active của profile. | Không tạo account đăng nhập Keycloak, không cấp token, không đổi password. |

`identity-service` là nguồn đúng cho account đăng nhập và role. `user-service` giữ bản sao role để hiển thị, query, và xử lý nghiệp vụ profile.

---

## ID Chung Giữa Hai Service

Một user có cùng id ở cả hai service:

```text
Keycloak user id = JWT sub = identity_users.userId = user_profiles.id
```

Khi frontend nhận `data.userId` từ `POST /admin/identity-users`, id đó sẽ được dùng để gọi các API profile bên `user-service`.

---

## Flow Tạo User Bình Thường

Flow này dùng cho admin dashboard khi tạo học viên, giáo viên, quản lý trung tâm, admin.

1. Frontend gọi identity-service:

```http
POST /admin/identity-users
```

Body ví dụ:

```json
{
  "email": "student1@gm.uit.edu.vn",
  "fullName": "Nguyễn Văn A",
  "role": "STUDENT",
  "temporaryPassword": "Temp@1234"
}
```

2. Identity-service tạo account Keycloak, assign role, lưu `identity_users`, rồi trả response:

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "Created",
  "data": {
    "userId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "email": "student1@gm.uit.edu.vn",
    "fullName": "Nguyễn Văn A",
    "role": "STUDENT"
  }
}
```

3. Identity-service publish event:

```json
{
  "eventName": "identity.user.created",
  "userId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "email": "student1@gm.uit.edu.vn",
  "fullName": "Nguyễn Văn A",
  "role": "STUDENT"
}
```

4. User-service consume event và tạo profile tối thiểu:

```json
{
  "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "email": "student1@gm.uit.edu.vn",
  "fullName": "Nguyễn Văn A",
  "role": "STUDENT",
  "isActive": true,
  "studentDetail": {
    "licenseTier": null,
    "enrolledAt": "2026-05-14T10:00:00.000Z",
    "notes": null
  }
}
```

5. Frontend gọi user-service để lấy profile:

```http
GET /admin/users/f47ac10b-58cc-4372-a567-0e02b2c3d479
```

Nếu nhận `404` ngay sau khi tạo account, frontend nên retry vài lần trong thời gian ngắn. Lý do là identity-service và user-service đồng bộ qua RabbitMQ nên profile có thể xuất hiện trễ một chút.

6. Frontend cập nhật profile chi tiết:

```http
PATCH /admin/users/f47ac10b-58cc-4372-a567-0e02b2c3d479
```

Body ví dụ:

```json
{
  "phoneNumber": "0912345678",
  "dateOfBirth": "2000-01-15",
  "gender": "MALE",
  "address": "TP.HCM",
  "avatarUrl": "https://storage.blob.core.windows.net/media/uploads/avatar.jpg",
  "mediaFileId": "3fa85f64-5717-4562-b3fc-2c963f66afa6"
}
```

7. Nếu user là học viên, frontend gán hạng giấy phép:

```http
PATCH /admin/users/f47ac10b-58cc-4372-a567-0e02b2c3d479/license-tier
```

Body:

```json
{
  "licenseTier": "B2"
}
```

---

## Flow Backfill Profile

Chỉ dùng flow này khi account Keycloak đã tồn tại nhưng profile bên user-service chưa có, ví dụ dữ liệu cũ hoặc event bị miss.

1. Kiểm tra account đã tồn tại trong identity-service:

```http
GET /admin/identity-users/:userId
```

2. Tạo profile thủ công trong user-service:

```http
POST /admin/users
```

Body:

```json
{
  "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "fullName": "Nguyễn Văn A",
  "email": "student1@gm.uit.edu.vn",
  "role": "STUDENT",
  "licenseTier": "B2"
}
```

Không dùng `POST /admin/users` để tạo account đăng nhập. User tạo bằng endpoint này sẽ không tự có Keycloak account nếu account chưa tồn tại.

---

## Flow Đăng Nhập Và Lấy Profile

1. Frontend gọi identity-service qua Kong:

```http
POST /auth/login
```

Body:

```json
{
  "username": "student1@gm.uit.edu.vn",
  "password": "Temp@1234"
}
```

2. Identity-service trả token:

```json
{
  "success": true,
  "code": "SUCCESS",
  "data": {
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "eyJhbGciOi...",
    "expiresIn": 300,
    "refreshExpiresIn": 1800,
    "tokenType": "Bearer",
    "scope": "openid profile email"
  }
}
```

3. Frontend lưu token và gọi user-service:

```http
GET /users/me
Authorization: Bearer <access_token>
```

4. User-service đọc `sub` trong JWT và trả profile tương ứng.

---

## Flow Cập Nhật Profile Của Chính User

User đang đăng nhập tự cập nhật profile:

```http
PATCH /users/me
Authorization: Bearer <access_token>
```

Body ví dụ:

```json
{
  "fullName": "Nguyễn Văn B",
  "phoneNumber": "0987654321",
  "dateOfBirth": "2000-05-20",
  "gender": "FEMALE",
  "address": "Hà Nội"
}
```

Endpoint này chỉ cập nhật profile trong user-service. Nó không đổi email/password/role trong Keycloak.

---

## Flow Đổi Role

Role nên đổi ở identity-service vì Keycloak là nguồn đúng cho quyền đăng nhập.

1. Frontend gọi:

```http
PATCH /admin/identity-users/:userId/role
```

Body:

```json
{
  "role": "INSTRUCTOR"
}
```

2. Identity-service đổi realm role trong Keycloak và publish event:

```json
{
  "eventName": "identity.user.role-changed",
  "userId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "newRole": "INSTRUCTOR"
}
```

3. User-service consume event và đồng bộ role trong profile.

Nếu đổi từ `STUDENT` sang role khác, user-service có thể xóa hoặc bỏ liên kết `StudentDetail` tùy rule hiện tại trong code. Nếu đổi sang `STUDENT`, user-service tạo `StudentDetail` nếu chưa có.

---

## Flow Khóa Hoặc Mở Khóa User

Có hai loại khóa cần phân biệt:

| API | Tác dụng |
| --- | -------- |
| `PATCH /admin/identity-users/:id/lock` | Khóa/mở khóa account Keycloak. User không đăng nhập được khi bị khóa. |
| `PATCH /admin/users/:id/lock` | Khóa/mở khóa profile trong user-service. Không trực tiếp khóa login Keycloak. |

Flow khuyến nghị:

1. Muốn khóa đăng nhập, gọi identity-service:

```http
PATCH /admin/identity-users/:userId/lock
```

Body:

```json
{
  "locked": true
}
```

2. Identity-service publish event `identity.user.locked`.

3. User-service consume event và set:

```text
isActive = !locked
```

---

## Flow Xóa User

Hiện tại xóa user là soft delete ở identity-service.

1. Frontend gọi:

```http
DELETE /admin/identity-users/:userId
```

Body:

```json
{
  "deletedById": "admin-keycloak-user-id"
}
```

2. Identity-service disable account Keycloak, set `isDeleted=true`, `isActive=false`, `deletedAt`.

3. Identity-service publish event `identity.user.deleted`.

4. User-service consume event và deactivate profile bằng `isActive=false`.

---

## Eventual Consistency Cho Frontend

Các thao tác sau là bất đồng bộ giữa identity-service và user-service:

| Sau khi gọi identity-service | User-service cập nhật qua event |
| ---------------------------- | ------------------------------- |
| `POST /admin/identity-users` | Tạo profile |
| `PATCH /admin/identity-users/:id` | Đồng bộ `email`, `fullName` |
| `PATCH /admin/identity-users/:id/role` | Đồng bộ role |
| `PATCH /admin/identity-users/:id/lock` | Đồng bộ `isActive` |
| `DELETE /admin/identity-users/:id` | Deactivate profile |

Frontend không nên giả định user-service cập nhật ngay lập tức sau response của identity-service. Với các màn hình admin, cách xử lý đơn giản là:

1. Sau khi tạo account, lấy `data.userId`.
2. Gọi `GET /admin/users/:userId`.
3. Nếu `404`, retry sau một khoảng ngắn.
4. Khi profile tồn tại, tiếp tục cập nhật profile chi tiết.

---

## Tóm Tắt Cho Frontend

Flow tạo user thường dùng nhất:

```text
POST /admin/identity-users
  -> lấy data.userId
  -> GET /admin/users/:userId
  -> nếu 404 thì retry
  -> PATCH /admin/users/:userId
  -> nếu STUDENT thì PATCH /admin/users/:userId/license-tier
```

Flow đăng nhập thường dùng nhất:

```text
POST /auth/login
  -> lưu accessToken
  -> GET /users/me với Authorization: Bearer <accessToken>
```

Quy tắc nhớ nhanh:

- Account/login/role/password/lock login: gọi `identity-service`.
- Profile/avatar/student/license tier: gọi `user-service`.
- `userId` từ identity-service chính là `id` của profile bên user-service.
