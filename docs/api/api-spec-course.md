# Course Service API Specification

**Base URL qua Kong:** `http://localhost:8000`  
**Service paths:** `/courses`, `/enrollments`, `/admin/courses`  
**Direct local:** `http://localhost:3004`  
**Swagger UI:** `http://localhost:3004/docs`  
**Swagger UI qua Kong:** `http://localhost:8000/course-service/docs`  
**OpenAPI JSON:** `http://localhost:3004/docs-json`  
**OpenAPI JSON qua Kong:** `http://localhost:8000/course-service/docs-json`  
**Version:** 1.0.0

Course list/detail endpoints use Redis cache-aside for high read traffic. Cache TTL is 600 seconds and cache entries are invalidated when course content, lessons, materials, activation state, or enrollment capacity-affecting state changes. If Redis is unavailable, course-service falls back to PostgreSQL and keeps the public response shape unchanged.

Course-service validate JWT/RBAC tại service bằng Keycloak guard. Frontend gọi qua Kong và gửi `Authorization: Bearer <access_token>`. Service lấy actor id từ `JWT.sub`; `x-user-id` chỉ là fallback cho debug/local script cũ.

---

## Authentication

| Endpoint | Role |
| --- | --- |
| `POST /admin/courses` | `ADMIN`, `CENTER_MANAGER`, `INSTRUCTOR` |
| `GET /admin/courses` | `ADMIN`, `CENTER_MANAGER`, `INSTRUCTOR` |
| `GET /admin/courses/:id` | `ADMIN`, `CENTER_MANAGER`, `INSTRUCTOR` |
| `PATCH /admin/courses/:id` | `ADMIN`, `CENTER_MANAGER`, `INSTRUCTOR` |
| `DELETE /admin/courses/:id` | `ADMIN`, `CENTER_MANAGER` |
| `PATCH /admin/courses/:id/activate` | `ADMIN`, `CENTER_MANAGER` |
| `POST /admin/courses/:id/lessons` | `ADMIN`, `CENTER_MANAGER`, `INSTRUCTOR` |
| `DELETE /admin/courses/:id/lessons/:lessonId` | `ADMIN`, `CENTER_MANAGER`, `INSTRUCTOR` |
| `POST /admin/courses/:id/materials` | `ADMIN`, `CENTER_MANAGER`, `INSTRUCTOR` |
| `GET /courses` | JWT hợp lệ |
| `GET /courses/:id` | JWT hợp lệ |
| `POST /courses/:id/enroll` | `STUDENT` |
| `GET /enrollments` | `STUDENT` |
| `GET /enrollments/:id` | `STUDENT`, `ADMIN`, `CENTER_MANAGER` |
| `POST /enrollments/:id/lessons/:lessonId/complete` | `STUDENT` |
| `POST /enrollments/:id/reset-progress` | `STUDENT` (owner), `ADMIN`, `CENTER_MANAGER` |

---

## Response Format

Tất cả HTTP success response được bọc bởi `ApiResponseInterceptor`.

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
  "message": "Course not found: course-uuid",
  "timestamp": "2026-05-14T10:00:00.000Z",
  "path": "/courses/course-uuid"
}
```

---

## Error Codes

| HTTP | Code | Nguyên nhân |
| ---: | --- | --- |
| 400 | `VALIDATION_ERROR` | Body/query không hợp lệ |
| 404 | `COURSE_NOT_FOUND` | Không tìm thấy khóa học |
| 404 | `LESSON_NOT_FOUND` | Không tìm thấy bài học |
| 404 | `ENROLLMENT_NOT_FOUND` | Không tìm thấy enrollment |
| 409 | `ENROLLMENT_ALREADY_EXISTS` | Student đã đăng ký khóa học |
| 409 | `INSTRUCTOR_ALREADY_ASSIGNED` | Instructor đã được gán |
| 422 | `COURSE_NOT_ACTIVE` | Khóa học chưa active |
| 422 | `COURSE_HAS_NO_LESSON` | Khóa học chưa có bài học |
| 422 | `ENROLLMENT_ALREADY_COMPLETED` | Enrollment đã completed |
| 422 | `COURSE_CAPACITY_EXCEEDED` | Vượt quá sức chứa khóa học |
| 422 | `STUDENT_LICENSE_NOT_ASSIGNED` | Course-service chưa có license tier của student từ user-service |
| 422 | `STUDENT_LICENSE_MISMATCH` | License tier của student không khớp `licenseCategory` của khóa học |

---

## Enums

`LicenseCategory`: `A1` | `A2` | `B1` | `B2` | `C` | `D` | `E` | `F`
`CourseStatus`: `DRAFT` | `ACTIVE` | `ARCHIVED`
`EnrollmentStatus`: `ACTIVE` | `COMPLETED` | `DROPPED`

---

## Endpoints

### POST `/admin/courses`

Tạo khóa học mới. `createdById` lấy từ `sub` trong JWT của caller.

**Auth:** `ADMIN`, `CENTER_MANAGER`, `INSTRUCTOR`

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

**Response `201 Created`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "Created",
  "timestamp": "2026-05-14T10:00:00.000Z",
  "path": "/admin/courses",
  "data": {
    "id": "course-uuid",
    "title": "Khóa học B2 cơ bản",
    "description": "Mô tả khóa học",
    "licenseCategory": "B2",
    "totalLessons": 0,
    "duration": "3 tháng",
    "tuitionFee": 5000000,
    "capacity": 30,
    "status": "DRAFT",
    "createdById": "creator-uuid",
    "createdAt": "2026-05-14T10:00:00.000Z",
    "updatedAt": "2026-05-14T10:00:00.000Z",
    "lessons": [],
    "instructorIds": ["550e8400-e29b-41d4-a716-446655440000"],
    "requirement": {
      "id": "requirement-uuid",
      "minAge": 18,
      "prerequisites": "Có GPLX B1",
      "attendanceRate": 80,
      "minPassScore": 80,
      "requiredExams": 2
    },
    "materials": []
  }
}
```

---

### GET `/admin/courses`

Danh sách khóa học cho admin dashboard.

**Auth:** `ADMIN`, `CENTER_MANAGER`, `INSTRUCTOR`

**Query**

| Param | Type | Default | Validation |
| --- | --- | ---: | --- |
| `page` | number | 1 | integer, `>= 1` |
| `size` | number | 20 | integer, `1..100` |
| `licenseCategory` | LicenseCategory | - | enum |
| `status` | CourseStatus | - | enum |

**Response `200 OK`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-14T10:00:00.000Z",
  "path": "/admin/courses",
  "data": {
    "items": [
      {
        "id": "course-uuid",
        "title": "Khóa học B2 cơ bản",
        "description": "Mô tả khóa học",
        "licenseCategory": "B2",
        "totalLessons": 1,
        "duration": "3 tháng",
        "tuitionFee": 5000000,
        "capacity": 30,
        "status": "ACTIVE",
        "createdById": "creator-uuid",
        "createdAt": "2026-05-14T10:00:00.000Z",
        "updatedAt": "2026-05-14T10:00:00.000Z",
        "lessons": [
          {
            "id": "lesson-uuid",
            "courseId": "course-uuid",
            "title": "Bài 1 - Biển báo giao thông",
            "content": "Nội dung markdown",
            "order": 1,
            "createdAt": "2026-05-14T10:00:00.000Z"
          }
        ],
        "instructorIds": ["instructor-uuid"],
        "requirement": null,
        "materials": []
      }
    ],
    "total": 1,
    "page": 1,
    "size": 20
  }
}
```

---

### GET `/admin/courses/:id`

Lấy chi tiết khóa học cho admin dashboard.

**Auth:** `ADMIN`, `CENTER_MANAGER`, `INSTRUCTOR`

**Response `200 OK`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-14T10:00:00.000Z",
  "path": "/admin/courses/course-uuid",
  "data": {
    "id": "course-uuid",
    "title": "Khóa học B2 cơ bản",
    "description": "Mô tả khóa học",
    "licenseCategory": "B2",
    "totalLessons": 1,
    "duration": "3 tháng",
    "tuitionFee": 5000000,
    "capacity": 30,
    "status": "ACTIVE",
    "createdById": "creator-uuid",
    "createdAt": "2026-05-14T10:00:00.000Z",
    "updatedAt": "2026-05-14T10:00:00.000Z",
    "lessons": [
      {
        "id": "lesson-uuid",
        "courseId": "course-uuid",
        "title": "Bài 1 - Biển báo giao thông",
        "content": "Nội dung markdown",
        "order": 1,
        "createdAt": "2026-05-14T10:00:00.000Z"
      }
    ],
    "instructorIds": ["instructor-uuid"],
    "requirement": null,
    "materials": []
  }
}
```

---

### GET `/courses`

Danh sách khóa học có phân trang và filter.

**Auth:** JWT hợp lệ.

**Query:** giống `GET /admin/courses`.

**Response `200 OK`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-14T10:00:00.000Z",
  "path": "/courses",
  "data": {
    "items": [
      {
        "id": "course-uuid",
        "title": "Khóa học B2 cơ bản",
        "description": "Mô tả khóa học",
        "licenseCategory": "B2",
        "totalLessons": 1,
        "duration": "3 tháng",
        "tuitionFee": 5000000,
        "capacity": 30,
        "status": "ACTIVE",
        "createdById": "creator-uuid",
        "createdAt": "2026-05-14T10:00:00.000Z",
        "updatedAt": "2026-05-14T10:00:00.000Z",
        "lessons": [],
        "instructorIds": ["instructor-uuid"],
        "requirement": null,
        "materials": []
      }
    ],
    "total": 1,
    "page": 1,
    "size": 20
  }
}
```

---

### GET `/courses/:id`

Lấy chi tiết khóa học.

**Auth:** JWT hợp lệ.

**Response `200 OK`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-14T10:00:00.000Z",
  "path": "/courses/course-uuid",
  "data": {
    "id": "course-uuid",
    "title": "Khóa học B2 cơ bản",
    "description": "Mô tả khóa học",
    "licenseCategory": "B2",
    "totalLessons": 1,
    "duration": "3 tháng",
    "tuitionFee": 5000000,
    "capacity": 30,
    "status": "ACTIVE",
    "createdById": "creator-uuid",
    "createdAt": "2026-05-14T10:00:00.000Z",
    "updatedAt": "2026-05-14T10:00:00.000Z",
    "lessons": [],
    "instructorIds": ["instructor-uuid"],
    "requirement": null,
    "materials": []
  }
}
```

---

### PATCH `/admin/courses/:id`

Cập nhật thông tin khóa học. Endpoint này không nhận `licenseCategory`, `status`, `thumbnailUrl`, hoặc `instructorIds`.

**Auth:** `ADMIN`, `CENTER_MANAGER`, `INSTRUCTOR`

**Body**

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

**Response `200 OK`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-14T10:00:00.000Z",
  "path": "/admin/courses/course-uuid",
  "data": {
    "id": "course-uuid",
    "title": "Tên khóa học mới",
    "description": "Mô tả mới",
    "licenseCategory": "B2",
    "totalLessons": 1,
    "duration": "4 tháng",
    "tuitionFee": 6000000,
    "capacity": 25,
    "status": "DRAFT",
    "createdById": "creator-uuid",
    "createdAt": "2026-05-14T10:00:00.000Z",
    "updatedAt": "2026-05-14T10:05:00.000Z",
    "lessons": [],
    "instructorIds": ["instructor-uuid"],
    "requirement": {
      "id": "requirement-uuid",
      "minAge": 18,
      "prerequisites": null,
      "attendanceRate": 85,
      "minPassScore": 80,
      "requiredExams": 2
    },
    "materials": []
  }
}
```

---

### PATCH `/admin/courses/:id/activate`

Kích hoạt khóa học từ `DRAFT` sang `ACTIVE`. Domain yêu cầu khóa học có ít nhất một lesson.

**Auth:** `ADMIN`, `CENTER_MANAGER`

**Response `200 OK`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-14T10:00:00.000Z",
  "path": "/admin/courses/course-uuid/activate",
  "data": {
    "id": "course-uuid",
    "title": "Khóa học B2 cơ bản",
    "description": "Mô tả khóa học",
    "licenseCategory": "B2",
    "totalLessons": 1,
    "duration": "3 tháng",
    "tuitionFee": 5000000,
    "capacity": 30,
    "status": "ACTIVE",
    "createdById": "creator-uuid",
    "createdAt": "2026-05-14T10:00:00.000Z",
    "updatedAt": "2026-05-14T10:05:00.000Z",
    "lessons": [
      {
        "id": "lesson-uuid",
        "courseId": "course-uuid",
        "title": "Bài 1 - Biển báo giao thông",
        "content": "Nội dung markdown",
        "order": 1,
        "createdAt": "2026-05-14T10:00:00.000Z"
      }
    ],
    "instructorIds": ["instructor-uuid"],
    "requirement": null,
    "materials": []
  }
}
```

---

### POST `/admin/courses/:id/lessons`

Thêm bài học vào khóa học. DTO hiện tại không nhận `videoUrl` hoặc `durationMinutes`.

**Auth:** `ADMIN`, `CENTER_MANAGER`, `INSTRUCTOR`

**Body**

```json
{
  "title": "Bài 1 - Biển báo giao thông",
  "order": 1,
  "content": "Nội dung markdown"
}
```

**Response `201 Created`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "Created",
  "timestamp": "2026-05-14T10:00:00.000Z",
  "path": "/admin/courses/course-uuid/lessons",
  "data": {
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
    "updatedAt": "2026-05-14T10:05:00.000Z",
    "lessons": [
      {
        "id": "lesson-uuid",
        "courseId": "course-uuid",
        "title": "Bài 1 - Biển báo giao thông",
        "content": "Nội dung markdown",
        "order": 1,
        "createdAt": "2026-05-14T10:05:00.000Z"
      }
    ],
    "instructorIds": ["instructor-uuid"],
    "requirement": null,
    "materials": []
  }
}
```

---

### DELETE `/admin/courses/:id/lessons/:lessonId`

Xóa bài học khỏi khóa học.

**Auth:** `ADMIN`, `CENTER_MANAGER`, `INSTRUCTOR`

**Response `200 OK`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-14T10:00:00.000Z",
  "path": "/admin/courses/course-uuid/lessons/lesson-uuid",
  "data": {
    "id": "course-uuid",
    "title": "Khóa học B2 cơ bản",
    "description": "Mô tả khóa học",
    "licenseCategory": "B2",
    "totalLessons": 0,
    "duration": "3 tháng",
    "tuitionFee": 5000000,
    "capacity": 30,
    "status": "DRAFT",
    "createdById": "creator-uuid",
    "createdAt": "2026-05-14T10:00:00.000Z",
    "updatedAt": "2026-05-14T10:10:00.000Z",
    "lessons": [],
    "instructorIds": ["instructor-uuid"],
    "requirement": null,
    "materials": []
  }
}
```

---

### POST `/admin/courses/:id/materials`

Thêm tài liệu học tập. Nếu có `mediaFileId`, course-service phát event `course.material.linked`.

**Auth:** `ADMIN`, `CENTER_MANAGER`, `INSTRUCTOR`

**Body**

```json
{
  "title": "Giáo trình B2",
  "fileUrl": "https://storage.blob.core.windows.net/media/docs/b2.pdf",
  "mediaFileId": "550e8400-e29b-41d4-a716-446655440000",
  "type": "PDF"
}
```

**Response `201 Created`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "Created",
  "timestamp": "2026-05-14T10:00:00.000Z",
  "path": "/admin/courses/course-uuid/materials",
  "data": {
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
    "updatedAt": "2026-05-14T10:05:00.000Z",
    "lessons": [],
    "instructorIds": ["instructor-uuid"],
    "requirement": null,
    "materials": [
      {
        "id": "material-uuid",
        "title": "Giáo trình B2",
        "fileUrl": "https://storage.blob.core.windows.net/media/docs/b2.pdf",
        "mediaFileId": "550e8400-e29b-41d4-a716-446655440000",
        "type": "PDF",
        "createdAt": "2026-05-14T10:05:00.000Z"
      }
    ]
  }
}
```

**Event published when `mediaFileId` is present:** `course.material.linked`.

---

### POST `/courses/:id/enroll`

Đăng ký khóa học. `studentId` lấy từ `sub` trong JWT của caller; endpoint không cần request body.

Course-service kiểm tra license tier của student từ local read model được đồng bộ bởi event `user.student.license-assigned`. Student chỉ được enroll khóa học khi license tier đã assign trong user-service khớp với `licenseCategory` của khóa học. Nếu event chưa được consume hoặc student chưa được assign license, API trả `STUDENT_LICENSE_NOT_ASSIGNED`; nếu khác hạng, API trả `STUDENT_LICENSE_MISMATCH`.

**Auth:** `STUDENT`

**Response `201 Created`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "Created",
  "timestamp": "2026-05-14T10:00:00.000Z",
  "path": "/courses/course-uuid/enroll",
  "data": {
    "id": "enrollment-uuid",
    "courseId": "course-uuid",
    "studentId": "student-uuid",
    "status": "ACTIVE",
    "progress": 0,
    "enrolledAt": "2026-05-14T10:00:00.000Z",
    "completedAt": null
  }
}
```

**Event published:** `course.enrollment.created`.

---

### GET `/enrollments`

Danh sách enrollment của student hiện tại.

**Auth:** `STUDENT`

**Query**

| Param | Type | Default | Validation |
| --- | --- | ---: | --- |
| `page` | number | 1 | integer, `>= 1` |
| `size` | number | 20 | integer, `1..100` |
| `status` | EnrollmentStatus | - | enum |

**Response `200 OK`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-14T10:00:00.000Z",
  "path": "/enrollments",
  "data": {
    "items": [
      {
        "id": "enrollment-uuid",
        "courseId": "course-uuid",
        "studentId": "student-uuid",
        "status": "ACTIVE",
        "progress": 42,
        "enrolledAt": "2026-05-14T10:00:00.000Z",
        "completedAt": null
      }
    ],
    "total": 1,
    "page": 1,
    "size": 20
  }
}
```

---

### GET `/enrollments/:id`

Lấy chi tiết enrollment.

**Auth:** `STUDENT`, `ADMIN`, `CENTER_MANAGER`

**Response `200 OK`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-14T10:00:00.000Z",
  "path": "/enrollments/enrollment-uuid",
  "data": {
    "id": "enrollment-uuid",
    "courseId": "course-uuid",
    "studentId": "student-uuid",
    "status": "ACTIVE",
    "progress": 42,
    "enrolledAt": "2026-05-14T10:00:00.000Z",
    "completedAt": null
  }
}
```

---

### POST `/enrollments/:id/lessons/:lessonId/complete`

Đánh dấu hoàn thành bài học. Endpoint hiện tại không đọc request body.

**Auth:** `STUDENT`

**Body:** không gửi body.

**Response `200 OK`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-14T10:00:00.000Z",
  "path": "/enrollments/enrollment-uuid/lessons/lesson-uuid/complete",
  "data": {
    "id": "enrollment-uuid",
    "courseId": "course-uuid",
    "studentId": "student-uuid",
    "status": "ACTIVE",
    "progress": 100,
    "enrolledAt": "2026-05-14T10:00:00.000Z",
    "completedAt": "2026-05-14T10:30:00.000Z"
  }
}
```

**Events published:**

| Event | Khi nào |
| --- | --- |
| `course.lesson.completed` | Khi hoàn thành một lesson |
| `course.enrollment.completed` | Khi progress đạt 100% |

---

## Events Consumed

Course-service consume queue `course_service_events`.

### `user.student.license-assigned`

```json
{
  "eventName": "user.student.license-assigned",
  "studentId": "student-uuid",
  "oldLicenseTier": null,
  "newLicenseTier": "B2",
  "changedById": "admin-uuid"
}
```

Course-service lưu event này vào read model `student_license_profiles` để enforce rule enroll theo hạng bằng lái.

### `media.file.deleted`

```json
{
  "eventName": "media.file.deleted",
  "fileId": "media-file-uuid",
  "storageKey": "uploads/2026/05/doc.pdf",
  "deletedById": "user-uuid"
}
```

---

## Events Published

## Security Audit

Access logging is emitted for every HTTP request. Successful audited mutations write `security.audit.recorded` into `course_db.outbox_messages` in the same transaction as the business change. The outbox relay publishes it to RabbitMQ, and `audit-service` persists it into `audit_db.audit_logs`.

Frontend does not call audit-service for write operations. The audit trail is a backend side effect. Admin screens may later query audit-service for investigation/history.

| Endpoint | Audit action | Resource | Metadata |
| --- | --- | --- | --- |
| `POST /admin/courses` | `COURSE_CREATED` | `COURSE/:id` | `{ "title": "...", "licenseCategory": "B1" }` |
| `PATCH /admin/courses/:id` | `COURSE_UPDATED` | `COURSE/:id` | `{ "title": "..." }` |
| `PATCH /admin/courses/:id/activate` | `COURSE_ACTIVATED` | `COURSE/:id` | `{ "status": "ACTIVE" }` |
| `DELETE /admin/courses/:id` | `COURSE_ARCHIVED` | `COURSE/:id` | `{ "status": "ARCHIVED" }` |
| `POST /admin/courses/:id/lessons` | `COURSE_LESSON_ADDED` | `COURSE/:id` | `{ "title": "...", "order": 1 }` |
| `DELETE /admin/courses/:id/lessons/:lessonId` | `COURSE_LESSON_REMOVED` | `COURSE/:id` | `{ "lessonId": "lesson-id" }` |
| `POST /admin/courses/:id/materials` | `COURSE_MATERIAL_ADDED` | `COURSE/:id` | `{ "title": "...", "mediaFileId": "media-file-id" }` |
| `POST /enrollments/:id/reset-progress` | `ENROLLMENT_PROGRESS_RESET` | `COURSE_ENROLLMENT/:id` | `{ "courseId": "course-id" }` |

Example audit event persisted from course-service:

```json
{
  "eventId": "audit-event-uuid",
  "eventName": "security.audit.recorded",
  "schemaVersion": 1,
  "serviceName": "course-service",
  "actorId": "admin-keycloak-sub",
  "actorRole": "ADMIN",
  "action": "COURSE_ARCHIVED",
  "resourceType": "COURSE",
  "resourceId": "course-id",
  "outcome": "SUCCESS",
  "occurredAt": "2026-05-24T10:00:00.000Z",
  "correlationId": "request-correlation-id",
  "requestPath": "/admin/courses/course-id",
  "httpMethod": "DELETE",
  "metadata": {
    "status": "ARCHIVED"
  }
}
```

Verification:

```sql
SELECT payload->>'action' AS action, status, attempts, "publishedAt", "lastError"
FROM outbox_messages
ORDER BY "createdAt" DESC
LIMIT 10;
```

Centralized query:

```http
GET /admin/audit-logs?serviceName=course-service&resourceId=<course-id>
Authorization: Bearer <admin_access_token>
```

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

## ASR Additions: Course Archive And Progress Reset

### DELETE `/admin/courses/{id}`

Archives a course instead of hard deleting it. Archived courses are excluded from list endpoints unless explicitly filtered by status.

Response contains the archived course with `status = "ARCHIVED"`.

**Response `200`**

Same `Course` shape as `GET /admin/courses/:id`, with `status = "ARCHIVED"`.

### POST `/enrollments/{id}/reset-progress`

Role: `STUDENT`, `ADMIN`, `CENTER_MANAGER`.

Resets only the current student's enrollment progress to baseline:

- `progress = 0`
- `status = ACTIVE`
- `completedAt = null`
- historical exam sessions are preserved
- publishes `course.enrollment.progress-reset` for analytics invalidation

**Response `200`**

Same `Enrollment` shape as `GET /enrollments/:id`, with `progress = 0`, `status = "ACTIVE"`, and `completedAt = null`.
## SRS Alignment Additions: Course Code, Version, Soft Delete

`POST /admin/courses` accepts optional `courseCode`. If provided, it must be unique; duplicates return `COURSE_CODE_ALREADY_EXISTS` with HTTP 409.

`PATCH /admin/courses/:id` accepts optional `version`. When supplied, the service compares it with the current aggregate version and returns `COURSE_VERSION_CONFLICT` with HTTP 409 on mismatch.

`DELETE /admin/courses/:id` keeps the existing archive behavior for API compatibility and also records soft-delete metadata: `isDeleted`, `deletedAt`, `deletedBy`. Courses with active/non-dropped enrollments return `COURSE_HAS_ACTIVE_ENROLLMENTS` with HTTP 409.

Course responses include `courseCode`, `version`, `isDeleted`, `deletedAt`, and `deletedBy`.
