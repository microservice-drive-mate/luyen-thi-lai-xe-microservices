# Course Service API Specification

**Base URL qua Kong:** `http://localhost:8000`  
**Service paths:** `/courses`, `/enrollments`, `/admin/courses`  
**Direct local:** `http://localhost:3004`  
**Swagger UI:** `http://localhost:3004/docs`  
**Swagger UI qua Kong:** `http://localhost:8000/course-service/docs`  
**OpenAPI JSON:** `http://localhost:3004/docs-json`  
**OpenAPI JSON qua Kong:** `http://localhost:8000/course-service/docs-json`  
**Version:** 1.0.0

## Auth Update

Course-service hiện validate JWT/RBAC tại service bằng Keycloak guard. Frontend gọi qua Kong và gửi `Authorization: Bearer <access_token>`; Kong forward header này vào service. Service lấy actor id từ `JWT.sub`, còn `x-user-id` chỉ là fallback cho debug/local script cũ.

| Endpoint                                                                                                                                   | Role                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- |
| `POST /admin/courses`, `GET /admin/courses`, `GET /admin/courses/:id`, `PATCH /admin/courses/:id`, `POST /admin/courses/:id/lessons`, `DELETE /admin/courses/:id/lessons/:lessonId`, `POST /admin/courses/:id/materials` | `ADMIN`, `CENTER_MANAGER`, `INSTRUCTOR` |
| `PATCH /admin/courses/:id/activate`                                                                                                              | `ADMIN`, `CENTER_MANAGER`               |
| `POST /courses/:id/enroll`, `GET /enrollments`, `POST /enrollments/:id/lessons/:lessonId/complete`                                         | `STUDENT`                               |
| `GET /enrollments/:id`                                                                                                                     | `STUDENT`, `ADMIN`, `CENTER_MANAGER`    |
| `GET /courses`, `GET /courses/:id`                                                                                                         | JWT hợp lệ                              |

Kong routes `/admin/courses`, `/courses` và `/enrollments` vào course-service. Admin dashboard gọi `/admin/courses/*`; student/public flow gọi `/courses/*` và `/enrollments/*`; Swagger/docs path là `/course-service/docs`.

Swagger tách route theo boundary: `Admin Courses` chứa create/list/detail/update/activate/lessons/materials cho dashboard; `Courses` chỉ còn list/detail/enroll cho student hoặc màn hình xem khóa học.

---

## Response Format

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-14T10:00:00.000Z",
  "path": "/courses",
  "data": {}
}
```

Lỗi domain:

```json
{
  "success": false,
  "code": "COURSE_NOT_FOUND",
  "message": "Course not found: abc",
  "timestamp": "2026-05-14T10:00:00.000Z",
  "path": "/courses/abc"
}
```

---

## Error Codes

| HTTP | Code                           | Nguyên nhân                                                                               |
| ---: | ------------------------------ | ----------------------------------------------------------------------------------------- |
|  400 | `VALIDATION_ERROR`             | Body/query không hợp lệ                                                                   |
|  404 | `COURSE_NOT_FOUND`             | Không tìm thấy khóa học                                                                   |
|  404 | `LESSON_NOT_FOUND`             | Không tìm thấy bài học                                                                    |
|  404 | `ENROLLMENT_NOT_FOUND`         | Không tìm thấy enrollment                                                                 |
|  409 | `ENROLLMENT_ALREADY_EXISTS`    | Student đã đăng ký khóa học                                                               |
|  409 | `LESSON_ALREADY_COMPLETED`     | Bài học đã hoàn thành trước đó _(chưa implement — hiện tại không có per-lesson tracking)_ |
|  409 | `INSTRUCTOR_ALREADY_ASSIGNED`  | Instructor đã được gán                                                                    |
|  422 | `COURSE_NOT_ACTIVE`            | Khóa học chưa active                                                                      |
|  422 | `COURSE_HAS_NO_LESSON`         | Khóa học chưa có bài học                                                                  |
|  422 | `ENROLLMENT_ALREADY_COMPLETED` | Enrollment đã completed                                                                   |
|  422 | `COURSE_CAPACITY_EXCEEDED`     | Vượt quá sức chứa khóa học                                                                |

---

## Enums

### LicenseCategory

`A1` | `A2` | `B1` | `B2` | `C` | `D` | `E` | `F`

### CourseStatus

`DRAFT` | `ACTIVE`

### EnrollmentStatus

`ACTIVE` | `COMPLETED` | `DROPPED`

---

## Shared Types

### CourseResponse

DTO hiện tại **không có `thumbnailUrl`**.

```json
{
  "id": "course-uuid",
  "title": "Khóa học B2 cơ bản",
  "description": "Mô tả khóa học",
  "licenseCategory": "B2",
  "totalLessons": 1,
  "duration": "3 tháng",
  "tuitionFee": 5000000,
  "capacity": 30,
  "status": "DRAFT",
  "createdById": "creator-uuid",
  "createdAt": "2026-05-14T10:00:00.000Z",
  "updatedAt": "2026-05-14T10:00:00.000Z",
  "lessons": [
    {
      "id": "lesson-uuid",
      "courseId": "course-uuid",
      "title": "Bài 1",
      "content": "Nội dung markdown",
      "order": 1,
      "createdAt": "2026-05-14T10:00:00.000Z"
    }
  ],
  "instructorIds": ["instructor-uuid"],
  "requirement": {
    "id": "requirement-uuid",
    "minAge": 18,
    "prerequisites": "Có GPLX B1",
    "attendanceRate": 80,
    "minPassScore": 80,
    "requiredExams": 2
  },
  "materials": [
    {
      "id": "material-uuid",
      "title": "Giáo trình B2",
      "fileUrl": "https://storage.blob.core.windows.net/media/docs/b2.pdf",
      "mediaFileId": "media-file-uuid",
      "type": "PDF",
      "createdAt": "2026-05-14T10:00:00.000Z"
    }
  ]
}
```

### EnrollmentResponse

DTO hiện tại **không trả `lessonProgress`**.

```json
{
  "id": "enrollment-uuid",
  "courseId": "course-uuid",
  "studentId": "student-uuid",
  "status": "ACTIVE",
  "progress": 42,
  "enrolledAt": "2026-05-14T10:00:00.000Z",
  "completedAt": null
}
```

---

## Endpoints - Admin Course Create/Read

### POST `/admin/courses`

Tạo khóa học mới. `createdById` lấy từ `sub` trong JWT của caller.

**Body**

```json
{
  "title": "Khóa học B2 cơ bản",
  "licenseCategory": "B2",
  "description": "Mô tả khóa học",
  "duration": "3 tháng",
  "tuitionFee": 5000000,
  "capacity": 30,
  "instructorIds": ["550e8400-e29b-41d4-a716-446655440000"],
  "requirement": {
    "minAge": 18,
    "prerequisites": "Có GPLX B1",
    "attendanceRate": 80,
    "minPassScore": 80,
    "requiredExams": 2
  }
}
```

| Field             | Type            | Required | Validation        |
| ----------------- | --------------- | -------- | ----------------- |
| `title`           | string          | Yes      | Non-empty         |
| `licenseCategory` | LicenseCategory | Yes      | Enum              |
| `description`     | string          | No       | optional          |
| `duration`        | string          | No       | optional          |
| `tuitionFee`      | number          | No       | `>= 0`            |
| `capacity`        | number          | No       | `>= 1`, nullable  |
| `instructorIds`   | string[]        | No       | UUID v4 each      |
| `requirement`     | object          | No       | nested validation |

**CourseRequirement**

| Field            | Type   | Default | Validation |
| ---------------- | ------ | ------: | ---------- |
| `minAge`         | number |  `null` | `>= 0`     |
| `prerequisites`  | string |  `null` | optional   |
| `attendanceRate` | number |      80 | `>= 0`     |
| `minPassScore`   | number |      80 | `>= 0`     |
| `requiredExams`  | number |       0 | `>= 0`     |

**Response `201 Created`:** `data` là `CourseResponse`.

---

### GET `/admin/courses`

**Auth:** `ADMIN`, `CENTER_MANAGER`, `INSTRUCTOR`

Danh sách khóa học cho admin dashboard. Query và response giống `GET /courses`, nhưng frontend dashboard nên dùng route này để gom các API quản trị dưới `/admin`.

**Query**

| Param             | Type            | Default | Validation      |
| ----------------- | --------------- | ------: | --------------- |
| `page`            | number          |       1 | integer, `>= 1` |
| `size`            | number          |      20 | integer, `>= 1` |
| `licenseCategory` | LicenseCategory |       - | enum            |
| `status`          | CourseStatus    |       - | enum            |

**Response `200 OK`**: `data` là paginated list of `CourseResponse`.

---

### GET `/admin/courses/:id`

**Auth:** `ADMIN`, `CENTER_MANAGER`, `INSTRUCTOR`

**Path params**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | UUID | Yes | Course id. |

Lấy chi tiết khóa học cho admin dashboard.

**Response `200 OK`:** `data` là `CourseResponse`.

---

## Endpoints - Course Read APIs

### GET `/courses`

**Auth:** JWT hop le.

Danh sách khóa học có phân trang và filter.

**Query**

| Param             | Type            | Default | Validation      |
| ----------------- | --------------- | ------: | --------------- |
| `page`            | number          |       1 | integer, `>= 1` |
| `size`            | number          |      20 | integer, `>= 1` |
| `licenseCategory` | LicenseCategory |       - | enum            |
| `status`          | CourseStatus    |       - | enum            |

**Response `200 OK`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "data": {
    "items": [],
    "total": 0,
    "page": 1,
    "size": 20
  }
}
```

---

### GET `/courses/:id`

**Auth:** JWT hop le.

**Path params**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | UUID | Yes | Course id. |

Lấy chi tiết khóa học.

**Response `200 OK`:** `data` là `CourseResponse`.

---

## Endpoints - Admin Course Mutation APIs

### PATCH `/admin/courses/:id`

**Auth:** `ADMIN`, `CENTER_MANAGER`, `INSTRUCTOR`

**Path params**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | UUID | Yes | Course id. |

Cập nhật thông tin khóa học. Endpoint này không nhận `licenseCategory`, `status`, `thumbnailUrl`, hoặc `instructorIds`.

**Body**: tất cả field đều optional.

```json
{
  "title": "Tên khóa học mới",
  "description": "Mô tả mới",
  "duration": "4 tháng",
  "tuitionFee": 6000000,
  "capacity": 25,
  "requirement": {
    "minAge": 18,
    "attendanceRate": 85,
    "minPassScore": 80,
    "requiredExams": 2
  }
}
```

**Response `200 OK`:** `data` là `CourseResponse`.

---

### PATCH `/admin/courses/:id/activate`

**Auth:** `ADMIN`, `CENTER_MANAGER`

**Path params**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | UUID | Yes | Course id. |

Kích hoạt khóa học từ `DRAFT` sang `ACTIVE`. Domain yêu cầu khóa học có ít nhất một lesson.

**Response `200 OK`:** `data` là `CourseResponse`.

---

### POST `/admin/courses/:id/lessons`

Thêm bài học vào khóa học. DTO hiện tại **không nhận `videoUrl` hoặc `durationMinutes`**.

**Body**

```json
{
  "title": "Bài 1 - Biển báo giao thông",
  "order": 1,
  "content": "Nội dung markdown"
}
```

| Field     | Type   | Required | Validation         |
| --------- | ------ | -------- | ------------------ |
| `title`   | string | Yes      | Non-empty          |
| `order`   | number | Yes      | integer, `>= 1`    |
| `content` | string | No       | optional, nullable |

**Response `201 Created`:** `data` là `CourseResponse`.

---

### DELETE `/admin/courses/:id/lessons/:lessonId`

**Auth:** `ADMIN`, `CENTER_MANAGER`, `INSTRUCTOR`

**Path params**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | UUID | Yes | Course id. |
| `lessonId` | UUID | Yes | Lesson id in the course. |

Xóa bài học khỏi khóa học.

**Response `200 OK`:** `data` là `CourseResponse`.

---

### POST `/admin/courses/:id/materials`

**Auth:** `ADMIN`, `CENTER_MANAGER`, `INSTRUCTOR`

**Path params**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | UUID | Yes | Course id. |

Thêm tài liệu học tập. Nếu có `mediaFileId`, course-service phát event `course.material.linked`.

**Body**

```json
{
  "title": "Giáo trình B2",
  "fileUrl": "https://storage.blob.core.windows.net/media/docs/b2.pdf",
  "mediaFileId": "550e8400-e29b-41d4-a716-446655440000",
  "type": "PDF"
}
```

| Field         | Type   | Required | Validation         |
| ------------- | ------ | -------- | ------------------ |
| `title`       | string | Yes      | Non-empty          |
| `fileUrl`     | string | No       | URL, nullable      |
| `mediaFileId` | string | No       | UUID, nullable     |
| `type`        | string | No       | optional, nullable |

**Response `201 Created`:** `data` là `CourseResponse`.

**Event published when `mediaFileId` is present:** `course.material.linked`.

---

## Endpoints - Student Enrollment

### POST `/courses/:id/enroll`

**Auth:** `STUDENT`

**Path params**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | UUID | Yes | Active course id. |

Đăng ký khóa học. `studentId` lấy từ `sub` trong JWT của caller; endpoint không cần request body.

**Response `201 Created`:** `data` là `EnrollmentResponse`.

**Event published:** `course.enrollment.created`.

---

## Endpoints - Enrollments

### GET `/enrollments`

**Auth:** `STUDENT`

Danh sách enrollment của student hiện tại. `studentId` lấy từ `sub` trong JWT của caller.

**Query**

| Param    | Type             | Default | Validation      |
| -------- | ---------------- | ------: | --------------- |
| `page`   | number           |       1 | integer, `>= 1` |
| `size`   | number           |      20 | integer, `>= 1` |
| `status` | EnrollmentStatus |       - | enum            |

**Response `200 OK`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "data": {
    "items": [],
    "total": 0,
    "page": 1,
    "size": 20
  }
}
```

---

### GET `/enrollments/:id`

**Auth:** `STUDENT`, `ADMIN`, `CENTER_MANAGER`

**Path params**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | UUID | Yes | Enrollment id. |

Lấy chi tiết enrollment.

**Response `200 OK`:** `data` là `EnrollmentResponse`.

---

### POST `/enrollments/:id/lessons/:lessonId/complete`

**Auth:** `STUDENT`

**Path params**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | UUID | Yes | Enrollment id owned by current student. |
| `lessonId` | UUID | Yes | Lesson id to complete. |

Đánh dấu hoàn thành bài học. Endpoint hiện tại **không đọc request body**; `CompleteLessonRequestDto` rỗng và controller không truyền `watchedSeconds`.

**Body:** không gửi body.

**Response `200 OK`:** `data` là `EnrollmentResponse`.

**Events published:**

| Event                         | Khi nào                   |
| ----------------------------- | ------------------------- |
| `course.lesson.completed`     | Khi hoàn thành một lesson |
| `course.enrollment.completed` | Khi progress đạt 100%     |

---

## Events Consumed

Course-service consume queue `course_service_events`.

### `user.student.license-assigned`

Handler hiện tại của course-service đọc payload theo shape sau:

```json
{
  "eventName": "user.student.license-assigned",
  "studentId": "student-uuid",
  "newTier": "B2",
  "oldTier": null
}
```

Hiện tại service nhận và ack message, logic mở rộng theo license tier sẽ bổ sung sau.

Lưu ý tích hợp: event class bên user-service hiện publish các field `oldLicenseTier` và `newLicenseTier`. Nếu giữ nguyên code hiện tại, cần mapper/adapter hoặc đổi consumer để đọc đúng tên field.

### `media.file.deleted`

```json
{
  "eventName": "media.file.deleted",
  "fileId": "media-file-uuid",
  "storageKey": "uploads/2026/05/doc.pdf",
  "deletedById": "user-uuid"
}
```

Course-service dùng event này để dọn reference tài liệu liên quan nếu material đang trỏ tới file đã xóa.

---

## Events Published

### `course.material.linked`

```json
{
  "eventName": "course.material.linked",
  "courseId": "course-uuid",
  "materialId": "material-uuid",
  "mediaFileId": "media-file-uuid"
}
```

### `course.enrollment.created`

```json
{
  "eventName": "course.enrollment.created",
  "enrollmentId": "enrollment-uuid",
  "studentId": "student-uuid",
  "courseId": "course-uuid"
}
```

### `course.lesson.completed`

```json
{
  "eventName": "course.lesson.completed",
  "lessonId": "lesson-uuid",
  "studentId": "student-uuid",
  "courseId": "course-uuid"
}
```

### `course.enrollment.completed`

```json
{
  "eventName": "course.enrollment.completed",
  "enrollmentId": "enrollment-uuid",
  "studentId": "student-uuid",
  "courseId": "course-uuid"
}
```
