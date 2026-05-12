# Course Service API Specification

**Base URL (qua Kong):** `http://localhost:8000`
**Service path:** `/courses`, `/enrollments`
**Port local:** `3004`
**Version:** 1.0.0

> **Upload tài liệu khóa học:** Xem [frontend-integration-guide.md](./frontend-integration-guide.md) để biết flow đầy đủ (media-service → course-service).

---

## Tổng quan xác thực

Tất cả endpoint (trừ `GET /courses` và `GET /courses/:id`) yêu cầu JWT hợp lệ do Keycloak phát hành.

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
  "timestamp": "2026-05-07T10:00:00.000Z",
  "path": "/courses",
  "data": { ... }
}

// Lỗi
{
  "success": false,
  "code": "COURSE_NOT_FOUND",
  "message": "Course not found: abc-123",
  "timestamp": "2026-05-07T10:00:00.000Z",
  "path": "/courses/abc-123"
}
```

---

## Error Codes

| HTTP Status | code                          | Nguyên nhân                                   |
| ----------- | ----------------------------- | --------------------------------------------- |
| 400         | `VALIDATION_ERROR`            | Request body/query không hợp lệ               |
| 404         | `COURSE_NOT_FOUND`            | Không tìm thấy khóa học theo ID               |
| 404         | `LESSON_NOT_FOUND`            | Không tìm thấy bài học theo ID                |
| 404         | `ENROLLMENT_NOT_FOUND`        | Không tìm thấy enrollment theo ID             |
| 409         | `ENROLLMENT_ALREADY_EXISTS`   | Student đã đăng ký khóa học này rồi           |
| 409         | `LESSON_ALREADY_COMPLETED`    | Bài học đã được đánh dấu hoàn thành trước đó  |
| 409         | `INSTRUCTOR_ALREADY_ASSIGNED` | Giảng viên đã được phân công vào khóa học này |
| 422         | `COURSE_NOT_ACTIVE`           | Khóa học chưa được kích hoạt (DRAFT)          |
| 422         | `COURSE_HAS_NO_LESSON`        | Khóa học chưa có bài học nào                  |
| 422         | `ENROLLMENT_ALREADY_COMPLETED`| Enrollment đã hoàn thành, không thể thao tác  |
| 422         | `COURSE_CAPACITY_EXCEEDED`    | Khóa học đã đủ số lượng học viên              |
| 500         | `INTERNAL_ERROR`              | Lỗi server                                    |

---

## Enums

### LicenseCategory

| Value | Ý nghĩa       |
| ----- | ------------- |
| `A1`  | Xe máy ≤ 50cc |
| `A2`  | Xe máy > 50cc |
| `B1`  | Ô tô số tự động (không kinh doanh) |
| `B2`  | Ô tô số sàn (không kinh doanh) |
| `C`   | Xe tải ≤ 3,5 tấn |
| `D`   | Xe chở người ≤ 30 chỗ |
| `E`   | Xe chở người > 30 chỗ |
| `F`   | Xe chuyên dùng |

### CourseStatus

| Value    | Ý nghĩa                              |
| -------- | ------------------------------------ |
| `DRAFT`  | Đang soạn thảo, chưa mở đăng ký     |
| `ACTIVE` | Đã kích hoạt, cho phép đăng ký học  |

### EnrollmentStatus

| Value       | Ý nghĩa                        |
| ----------- | ------------------------------ |
| `ACTIVE`    | Đang học                       |
| `COMPLETED` | Đã hoàn thành toàn bộ bài học  |
| `DROPPED`   | Đã bỏ học                      |

---

## Shared Types

### CourseResponse

```json
{
  "id": "uuid",
  "title": "Khóa học B2 – Nâng cao",
  "description": "Mô tả khóa học",
  "licenseCategory": "B2",
  "thumbnailUrl": "https://...",
  "totalLessons": 12,
  "duration": "3 tháng",
  "tuitionFee": 5000000,
  "capacity": 30,
  "status": "ACTIVE",
  "createdById": "uuid-of-instructor",
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z",
  "lessons": [
    {
      "id": "uuid",
      "courseId": "uuid",
      "title": "Bài 1 – Biển báo giao thông",
      "content": "Nội dung markdown...",
      "videoUrl": "https://...",
      "durationMinutes": 45,
      "order": 1,
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ],
  "instructorIds": ["uuid-instructor-1", "uuid-instructor-2"],
  "requirement": {
    "id": "uuid",
    "minAge": 18,
    "prerequisites": "Có giấy phép B1",
    "attendanceRate": 80,
    "minPassScore": 80,
    "requiredExams": 2
  },
  "materials": [
    {
      "id": "uuid",
      "title": "Tài liệu học lý thuyết",
      "fileUrl": "https://...",
      "type": "PDF",
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

> `requirement` là `null` nếu chưa được cài đặt.

### EnrollmentResponse

```json
{
  "id": "uuid",
  "courseId": "uuid",
  "studentId": "uuid",
  "status": "ACTIVE",
  "progress": 42,
  "enrolledAt": "2026-01-01T00:00:00.000Z",
  "completedAt": null,
  "lessonProgress": [
    {
      "id": "uuid",
      "lessonId": "uuid",
      "completedAt": "2026-01-02T00:00:00.000Z",
      "watchedSeconds": 2700,
      "isCompleted": true
    }
  ]
}
```

---

## Endpoints — Courses

---

### POST /courses

> Tạo khóa học mới. `createdById` lấy từ Kong header `x-user-id`.

**Auth:** Yêu cầu JWT (INSTRUCTOR hoặc ADMIN)
**Kong header:** `x-user-id` (auto-injected)

**Request Body:**

```json
{
  "title": "Khóa học B2 – Cơ bản",
  "licenseCategory": "B2",
  "description": "Mô tả khóa học",
  "thumbnailUrl": "https://...",
  "duration": "3 tháng",
  "tuitionFee": 5000000,
  "capacity": 30,
  "instructorIds": ["uuid-instructor-1"],
  "requirement": {
    "minAge": 18,
    "prerequisites": "Có giấy phép B1",
    "attendanceRate": 80,
    "minPassScore": 80,
    "requiredExams": 2
  }
}
```

| Field            | Type              | Required | Validation                        |
| ---------------- | ----------------- | -------- | --------------------------------- |
| `title`          | string            | ✅       | Non-empty                         |
| `licenseCategory`| LicenseCategory   | ✅       | Enum LicenseCategory              |
| `description`    | string            | ❌       |                                   |
| `thumbnailUrl`   | string            | ❌       | URL ảnh thumbnail                 |
| `duration`       | string            | ❌       | Text tự do, vd: "3 tháng"         |
| `tuitionFee`     | number            | ❌       | ≥ 0, mặc định 0                   |
| `capacity`       | number            | ❌       | ≥ 1, null = không giới hạn        |
| `instructorIds`  | string[]          | ❌       | Mảng UUID của giảng viên          |
| `requirement`    | CourseRequirement | ❌       | Yêu cầu đầu vào của khóa học      |

**CourseRequirement fields:**

| Field            | Type   | Default | Validation |
| ---------------- | ------ | ------- | ---------- |
| `minAge`         | number | null    | ≥ 0        |
| `prerequisites`  | string | null    |            |
| `attendanceRate` | number | 80      | ≥ 0        |
| `minPassScore`   | number | 80      | ≥ 0        |
| `requiredExams`  | number | 0       | ≥ 0        |

**Response `201`:**

```json
{
  "success": true,
  "code": "SUCCESS",
  "data": { /* CourseResponse */ }
}
```

> Khóa học mới tạo luôn có `status = DRAFT` và `totalLessons = 0`.

---

### GET /courses

> Danh sách khóa học có phân trang và lọc. Không yêu cầu auth.

**Query Parameters:**

| Param             | Type            | Default | Validation                  | Mô tả                  |
| ----------------- | --------------- | ------- | --------------------------- | ---------------------- |
| `page`            | number          | 1       | ≥ 1                         | Số trang               |
| `size`            | number          | 20      | ≥ 1                         | Số item mỗi trang      |
| `licenseCategory` | LicenseCategory | —       | Enum LicenseCategory        | Lọc theo hạng bằng     |
| `status`          | CourseStatus    | —       | Enum CourseStatus           | Lọc theo trạng thái    |

**Response `200`:**

```json
{
  "success": true,
  "data": {
    "items": [ /* CourseResponse[] */ ],
    "total": 42,
    "page": 1,
    "size": 20
  }
}
```

---

### GET /courses/:id

> Chi tiết khóa học đầy đủ (bao gồm lessons, instructors, requirement, materials).

**Response `200`:**

```json
{
  "success": true,
  "data": { /* CourseResponse đầy đủ */ }
}
```

**Errors:**

| Status | code               | Nguyên nhân             |
| ------ | ------------------ | ----------------------- |
| 404    | `COURSE_NOT_FOUND` | Không tìm thấy khóa học |

---

### PATCH /courses/:id

> Cập nhật thông tin khóa học. Không thay đổi được `licenseCategory` hoặc `status` qua endpoint này.

**Auth:** Yêu cầu JWT (INSTRUCTOR hoặc ADMIN)

**Request Body** (tất cả optional):

```json
{
  "title": "Tên mới",
  "description": "Mô tả mới",
  "thumbnailUrl": "https://...",
  "duration": "4 tháng",
  "tuitionFee": 6000000,
  "capacity": 25,
  "requirement": { ... }
}
```

**Response `200`** — Trả về course đã cập nhật.

**Errors:**

| Status | code               | Nguyên nhân             |
| ------ | ------------------ | ----------------------- |
| 404    | `COURSE_NOT_FOUND` | Không tìm thấy khóa học |

---

### PATCH /courses/:id/activate

> Kích hoạt khóa học từ `DRAFT` → `ACTIVE`. Yêu cầu khóa học phải có ít nhất 1 bài học.

**Auth:** Yêu cầu JWT (INSTRUCTOR hoặc ADMIN)

**Response `200`** — Trả về course đã được activate (`status = ACTIVE`).

**Errors:**

| Status | code                    | Nguyên nhân                      |
| ------ | ----------------------- | -------------------------------- |
| 404    | `COURSE_NOT_FOUND`      | Không tìm thấy khóa học          |
| 422    | `COURSE_HAS_NO_LESSON`  | Chưa có bài học, không thể ACTIVE|

---

### POST /courses/:id/lessons

> Thêm bài học vào khóa học.

**Auth:** Yêu cầu JWT (INSTRUCTOR hoặc ADMIN)

**Request Body:**

```json
{
  "title": "Bài 1 – Biển báo giao thông",
  "order": 1,
  "content": "Nội dung markdown...",
  "videoUrl": "https://...",
  "durationMinutes": 45
}
```

| Field             | Type   | Required | Validation         |
| ----------------- | ------ | -------- | ------------------ |
| `title`           | string | ✅       | Non-empty          |
| `order`           | number | ✅       | ≥ 1, số thứ tự    |
| `content`         | string | ❌       | Markdown text      |
| `videoUrl`        | string | ❌       | URL video          |
| `durationMinutes` | number | ❌       | ≥ 0, mặc định 0   |

**Response `201`** — Trả về course đầy đủ với `totalLessons` tăng lên.

**Errors:**

| Status | code               | Nguyên nhân             |
| ------ | ------------------ | ----------------------- |
| 404    | `COURSE_NOT_FOUND` | Không tìm thấy khóa học |

---

### DELETE /courses/:id/lessons/:lessonId

> Xóa bài học khỏi khóa học.

**Auth:** Yêu cầu JWT (INSTRUCTOR hoặc ADMIN)

**Response `200`** — Trả về course đầy đủ với `totalLessons` giảm đi.

**Errors:**

| Status | code               | Nguyên nhân             |
| ------ | ------------------ | ----------------------- |
| 404    | `COURSE_NOT_FOUND` | Không tìm thấy khóa học |
| 404    | `LESSON_NOT_FOUND` | Không tìm thấy bài học  |

---

### POST /courses/:id/materials

> Thêm tài liệu học tập vào khóa học.

**Auth:** Yêu cầu JWT (INSTRUCTOR hoặc ADMIN)

**Request Body:**

```json
{
  "title": "Giáo trình lý thuyết B2",
  "fileUrl": "https://...",
  "type": "PDF"
}
```

| Field     | Type   | Required | Validation                       |
| --------- | ------ | -------- | -------------------------------- |
| `title`   | string | ✅       | Non-empty                        |
| `fileUrl` | string | ❌       | URL file tài liệu                |
| `type`    | string | ❌       | Loại tài liệu: `PDF`, `VIDEO`, `LINK`, v.v. |

**Response `201`** — Trả về course đầy đủ với materials mới.

**Errors:**

| Status | code               | Nguyên nhân             |
| ------ | ------------------ | ----------------------- |
| 404    | `COURSE_NOT_FOUND` | Không tìm thấy khóa học |

---

### POST /courses/:id/enroll

> Đăng ký khóa học. `studentId` lấy từ Kong header `x-user-id`. Không cần request body.

**Auth:** Yêu cầu JWT (STUDENT)
**Kong header:** `x-user-id` (auto-injected — dùng làm `studentId`)

**Response `201`:**

```json
{
  "success": true,
  "data": { /* EnrollmentResponse */ }
}
```

**Errors:**

| Status | code                        | Nguyên nhân                            |
| ------ | --------------------------- | -------------------------------------- |
| 404    | `COURSE_NOT_FOUND`          | Không tìm thấy khóa học                |
| 409    | `ENROLLMENT_ALREADY_EXISTS` | Student đã đăng ký khóa học này rồi    |
| 422    | `COURSE_NOT_ACTIVE`         | Khóa học chưa ACTIVE                   |
| 422    | `COURSE_CAPACITY_EXCEEDED`  | Đã đủ số lượng học viên theo `capacity`|

> **Domain Event phát ra:**
>
> - Event name: `course.enrollment.created`
> - Payload: `{ enrollmentId, studentId, courseId }`
> - Consumed bởi: `notification-service` (gửi thông báo xác nhận đăng ký)

---

## Endpoints — Enrollments

---

### GET /enrollments

> Danh sách enrollment của student hiện tại (phân trang).

**Auth:** Yêu cầu JWT (STUDENT)
**Kong header:** `x-user-id` (auto-injected — dùng làm `studentId`)

**Query Parameters:**

| Param    | Type             | Default | Mô tả                   |
| -------- | ---------------- | ------- | ----------------------- |
| `page`   | number           | 1       | Số trang                |
| `size`   | number           | 20      | Số item mỗi trang       |
| `status` | EnrollmentStatus | —       | Lọc theo trạng thái     |

**Response `200`:**

```json
{
  "success": true,
  "data": {
    "items": [ /* EnrollmentResponse[] */ ],
    "total": 5,
    "page": 1,
    "size": 20
  }
}
```

---

### GET /enrollments/:id

> Chi tiết enrollment và tiến độ học từng bài.

**Response `200`:**

```json
{
  "success": true,
  "data": { /* EnrollmentResponse đầy đủ với lessonProgress */ }
}
```

**Errors:**

| Status | code                   | Nguyên nhân                  |
| ------ | ---------------------- | ---------------------------- |
| 404    | `ENROLLMENT_NOT_FOUND` | Không tìm thấy enrollment    |

---

### POST /enrollments/:id/lessons/:lessonId/complete

> Đánh dấu hoàn thành một bài học. Tự động tính lại `progress` (0–100). Nếu `progress` đạt 100%, enrollment chuyển sang `COMPLETED`.

**Request Body:**

```json
{ "watchedSeconds": 2700 }
```

| Field           | Type   | Required | Validation |
| --------------- | ------ | -------- | ---------- |
| `watchedSeconds`| number | ❌       | ≥ 0        |

**Response `200`** — Trả về enrollment đã cập nhật.

**Errors:**

| Status | code                           | Nguyên nhân                              |
| ------ | ------------------------------ | ---------------------------------------- |
| 404    | `ENROLLMENT_NOT_FOUND`         | Không tìm thấy enrollment                |
| 404    | `LESSON_NOT_FOUND`             | Bài học không thuộc khóa học này         |
| 409    | `LESSON_ALREADY_COMPLETED`     | Bài học đã được hoàn thành trước đó      |
| 422    | `ENROLLMENT_ALREADY_COMPLETED` | Enrollment đã completed, không thể thao tác |

> **Domain Events phát ra:**
>
> - `course.lesson.completed` — luôn phát (payload: `{ lessonId, studentId, durationMinutes }`)
> - `course.enrollment.completed` — chỉ phát khi `progress = 100%` (payload: `{ enrollmentId, studentId, courseId }`)
> - Consumed bởi: `notification-service`, `analytics-service`

---

## Luồng event từ user-service

Course-service lắng nghe event từ RabbitMQ queue `course_service_events`:

### `user.student.license-assigned`

Phát ra bởi user-service khi admin gán hạng bằng lái cho student.

**Payload:**

```json
{
  "studentId": "uuid",
  "newTier": "B2",
  "oldTier": null
}
```

**Xử lý:** Nhận và ack message (MVP scope — logic mở rộng sau).

---

## Domain Events phát ra

| Event name                     | Trigger                         | Payload                                    |
| ------------------------------ | ------------------------------- | ------------------------------------------ |
| `course.enrollment.created`    | Student đăng ký khóa học        | `{ enrollmentId, studentId, courseId }`    |
| `course.enrollment.completed`  | Hoàn thành 100% bài học         | `{ enrollmentId, studentId, courseId }`    |
| `course.lesson.completed`      | Hoàn thành 1 bài học            | `{ lessonId, studentId, durationMinutes }` |

---

## Swagger UI

| Môi trường    | URL                                                         |
| ------------- | ----------------------------------------------------------- |
| Local         | `http://localhost:3004/docs`                                |
| Qua Kong      | `http://localhost:8000/course-service/docs` (cần JWT)       |
| Centralized   | `http://localhost:3009/docs` (docs-service)                 |
