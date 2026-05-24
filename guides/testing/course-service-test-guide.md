# Course Service — Hướng Dẫn Test API Chi Tiết

> Tài liệu này hướng dẫn test toàn bộ API của `course-service`, cả khi gọi **trực tiếp** (bỏ qua Kong, dùng cho dev/debug) lẫn khi gọi **qua Kong** (production path).

---

## Mục lục

1. [Khởi động môi trường](#1-khởi-động-môi-trường)
2. [Kiến trúc luồng request](#2-kiến-trúc-luồng-request)
3. [Chuẩn bị — Tạo dữ liệu mẫu](#3-chuẩn-bị--tạo-dữ-liệu-mẫu)
4. [Test Course endpoints](#4-test-course-endpoints)
5. [Test Enrollment endpoints](#5-test-enrollment-endpoints)
6. [Test luồng RabbitMQ event](#6-test-luồng-rabbitmq-event)
7. [Kiểm tra Database trực tiếp](#7-kiểm-tra-database-trực-tiếp)
8. [Test Security Audit Và Outbox](#8-test-security-audit-và-outbox)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Khởi động môi trường

### Bước 1.1 — Start infrastructure

```bash
# Từ root của project
npm run infra:up
```

Chờ khoảng 10-15 giây để Consul khởi động và seed xong.

**Kiểm tra Consul healthy:**

```bash
curl http://localhost:8500/v1/status/leader
# Kết quả mong đợi: "..." (địa chỉ leader node)
```

**Consul UI:** http://localhost:8500/ui

### Bước 1.2 — Seed config vào Consul

```bash
npm run consul:seed:local
```

Sau khi seed, kiểm tra config course-service:

```bash
npm run consul:list
npm run consul:get -- config/development-local/course-service/redis.url
# Expected: redis://localhost:6379
# Tìm các key: config/development-local/course-service/...
```

### Bước 1.3 — Migrate database

```bash
cd apps/course-service
npm run db:generate
npm run db:migrate
```

Hoặc nếu migration đã tồn tại:

```bash
cd apps/course-service
npm run db:deploy
```

**Kiểm tra schema:**

```bash
npm run db:studio
# Mở browser tại http://localhost:5555
```

### Bước 1.4 — Start course-service

```bash
# Từ root
npm run dev --filter=course-service
```

**Kiểm tra service đang chạy:**

```bash
curl http://localhost:3004/docs-json
# Kết quả: OpenAPI JSON spec
```

**Swagger UI:** http://localhost:3004/docs

---

## 2. Kiến trúc luồng request

```
Client (curl/Postman)
    │
    ├─── DIRECT (dev/debug) ──→ http://localhost:3004  ←── Port course-service local
    │                            (Ưu tiên JWT thật; x-user-id chỉ là fallback legacy)
    │
    └─── VIA KONG ────────────→ http://localhost:8000  ←── Kong gateway
                                 (Cần JWT hợp lệ từ Keycloak)
                                 Service đọc actor từ JWT.sub
```

> **Lưu ý:** course-service hiện validate JWT/RBAC tại service và đọc user từ `@AuthenticatedUser()`. Các lệnh `x-user-id` trong guide này chỉ còn dùng cho debug legacy khi endpoint vẫn có fallback; frontend và demo chuẩn phải gửi `Authorization: Bearer <access_token>`.

---

## 3. Chuẩn bị — Tạo dữ liệu mẫu

### ID mẫu dùng xuyên suốt tài liệu này

```
INSTRUCTOR_ID = instructor-uuid-0001
STUDENT_ID    = student-uuid-0002
ADMIN_ID      = admin-uuid-0003
```

> Đây chỉ là UUID giả (user-service không cần chạy vì cross-service ref không có FK).

---

## 4. Test Course endpoints

> Course list/detail uses Redis cache-aside with 600-second TTL. If Redis is unavailable, requests fall back to PostgreSQL and keep the same response shape.

> Tất cả các lệnh curl sau gọi **trực tiếp** vào course-service (port 3004). Khi demo chuẩn, thay các header `x-user-id` bằng `Authorization: Bearer <access_token>` lấy từ Keycloak.

---

### 4.1 POST /admin/courses — Tạo khóa học

**Happy path — tạo khóa học đầy đủ:**

```bash
curl -s -X POST http://localhost:3004/admin/courses \
  -H "Content-Type: application/json" \
  -H "x-user-id: instructor-uuid-0001" \
  -d '{
    "title": "Khóa học B2 – Cơ bản",
    "licenseCategory": "B2",
    "description": "Khóa học lý thuyết và thực hành thi bằng B2",
    "duration": "3 tháng",
    "tuitionFee": 5000000,
    "capacity": 30,
    "instructorIds": ["instructor-uuid-0001"],
    "requirement": {
      "minAge": 18,
      "prerequisites": "Có giấy phép B1",
      "attendanceRate": 80,
      "minPassScore": 80,
      "requiredExams": 2
    }
  }' | jq .
```

**Kết quả mong đợi (201):**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "Created",
  "timestamp": "2026-05-14T10:00:00.000Z",
  "path": "/courses",
  "data": {
    "id": "<course-uuid>",
    "title": "Khóa học B2 – Cơ bản",
    "description": "Khóa học lý thuyết và thực hành thi bằng B2",
    "licenseCategory": "B2",
    "status": "DRAFT",
    "totalLessons": 0,
    "duration": "3 tháng",
    "tuitionFee": 5000000,
    "capacity": 30,
    "createdById": "instructor-uuid-0001",
    "createdAt": "2026-05-14T10:00:00.000Z",
    "updatedAt": "2026-05-14T10:00:00.000Z",
    "lessons": [],
    "instructorIds": ["instructor-uuid-0001"],
    "requirement": {
      "id": "<requirement-uuid>",
      "minAge": 18,
      "prerequisites": "Có giấy phép B1",
      "attendanceRate": 80,
      "minPassScore": 80,
      "requiredExams": 2
    },
    "materials": []
  }
}
```

> **Lưu ý:** Lưu lại `course-uuid` từ response để dùng cho các bước tiếp theo.

```bash
# Lưu course ID
COURSE_ID=$(curl -s -X POST http://localhost:3004/admin/courses \
  -H "Content-Type: application/json" \
  -H "x-user-id: instructor-uuid-0001" \
  -d '{"title":"Test Course","licenseCategory":"B1"}' \
  | jq -r '.data.id')
echo "COURSE_ID=$COURSE_ID"
```

**Tạo thêm course A1 để test list/filter:**

```bash
curl -s -X POST http://localhost:3004/admin/courses \
  -H "Content-Type: application/json" \
  -H "x-user-id: instructor-uuid-0001" \
  -d '{
    "title": "Khóa học A1 – Xe máy 50cc",
    "licenseCategory": "A1",
    "tuitionFee": 2000000
  }' | jq '.data.id'
```

**Case: Thiếu field bắt buộc (expect 400):**

```bash
curl -s -X POST http://localhost:3004/admin/courses \
  -H "Content-Type: application/json" \
  -H "x-user-id: instructor-uuid-0001" \
  -d '{"title": "Không có licenseCategory"}' | jq .
```

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "message": "Validation failed",
  "timestamp": "...",
  "path": "/courses",
  "errors": ["licenseCategory should not be empty"]
}
```

---

### 4.2 GET /courses — Danh sách khóa học

**Lấy tất cả:**

```bash
curl -s "http://localhost:3004/admin/courses" | jq '.data | {total, page, size}'
```

**Lọc theo hạng bằng:**

```bash
curl -s "http://localhost:3004/courses?licenseCategory=B2" | jq '.data.items | length'
```

**Lọc theo status:**

```bash
curl -s "http://localhost:3004/courses?status=DRAFT" | jq '.data.items | map(.status)'
curl -s "http://localhost:3004/courses?status=ACTIVE" | jq '.data.items | map(.title)'
```

**Phân trang:**

```bash
curl -s "http://localhost:3004/courses?page=1&size=1" | jq '.data | {total, page, size, items_count: (.items | length)}'
```

**Kết hợp filter:**

```bash
curl -s "http://localhost:3004/courses?licenseCategory=B2&status=DRAFT" | jq .
```

---

### 4.3 GET /courses/:id — Chi tiết khóa học

```bash
curl -s "http://localhost:3004/courses/$COURSE_ID" | jq .data
```

**Case: ID không tồn tại (expect 404):**

```bash
curl -s "http://localhost:3004/courses/non-existent-uuid" | jq .
```

```json
{
  "success": false,
  "code": "COURSE_NOT_FOUND",
  "message": "Course with id non-existent-uuid not found",
  "timestamp": "...",
  "path": "/courses/non-existent-uuid"
}
```

---

### 4.4 PATCH /admin/courses/:id — Cập nhật khóa học

**Cập nhật metadata:**

```bash
curl -s -X PATCH "http://localhost:3004/courses/$COURSE_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Khóa học B2 – Nâng cao",
    "tuitionFee": 6000000,
    "duration": "4 tháng"
  }' | jq '.data | {title, tuitionFee, duration}'
```

**Cập nhật requirement:**

```bash
curl -s -X PATCH "http://localhost:3004/courses/$COURSE_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "requirement": {
      "minAge": 21,
      "attendanceRate": 90,
      "minPassScore": 85,
      "requiredExams": 3
    }
  }' | jq '.data.requirement'
```

---

### 4.5 POST /admin/courses/:id/lessons — Thêm bài học

**Thêm bài học 1:**

```bash
curl -s -X POST "http://localhost:3004/admin/courses/$COURSE_ID/lessons" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Bài 1 – Biển báo giao thông",
    "order": 1,
    "content": "# Biển báo\nNội dung markdown..."
  }' | jq '.data | {totalLessons, lessons_count: (.lessons | length)}'
```

**Thêm bài học 2:**

```bash
curl -s -X POST "http://localhost:3004/admin/courses/$COURSE_ID/lessons" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Bài 2 – Kỹ năng lái xe",
    "order": 2
  }' | jq '.data.totalLessons'
# Kết quả mong đợi: 2
```

**Thêm bài học 3 (để test complete enrollment):**

```bash
LESSON_1_ID=$(curl -s -X POST "http://localhost:3004/admin/courses/$COURSE_ID/lessons" \
  -H "Content-Type: application/json" \
  -d '{"title":"Lesson A","order":1}' | jq -r '.data.lessons[0].id')

# Lấy lesson IDs từ course
curl -s "http://localhost:3004/courses/$COURSE_ID" | jq '.data.lessons | map({id, title, order})'
```

> **Lưu ý:** Lưu các `lesson_id` từ response để dùng cho test complete-lesson.

**Case: Thiếu field bắt buộc (expect 400):**

```bash
curl -s -X POST "http://localhost:3004/admin/courses/$COURSE_ID/lessons" \
  -H "Content-Type: application/json" \
  -d '{"content": "Không có title và order"}' | jq .
```

---

### 4.6 PATCH /admin/courses/:id/activate — Kích hoạt khóa học

**Case: Kích hoạt khi chưa có lesson (expect 422):**

```bash
# Tạo course rỗng rồi thử activate
EMPTY_COURSE_ID=$(curl -s -X POST http://localhost:3004/admin/courses \
  -H "Content-Type: application/json" \
  -H "x-user-id: instructor-uuid-0001" \
  -d '{"title":"Empty Course","licenseCategory":"C"}' | jq -r '.data.id')

curl -s -X PATCH "http://localhost:3004/admin/courses/$EMPTY_COURSE_ID/activate" | jq .
```

```json
{
  "success": false,
  "code": "COURSE_HAS_NO_LESSON",
  "message": "Course must have at least one lesson before activation",
  "timestamp": "...",
  "path": "/courses/.../activate"
}
```

**Happy path — Kích hoạt course có lesson:**

```bash
curl -s -X PATCH "http://localhost:3004/admin/courses/$COURSE_ID/activate" | jq '.data.status'
# Kết quả mong đợi: "ACTIVE"
```

**Xác nhận filter status=ACTIVE:**

```bash
curl -s "http://localhost:3004/courses?status=ACTIVE" | jq '.data.items | map(.title)'
# Phải thấy course vừa activate
```

---

### 4.7 DELETE /admin/courses/:id/lessons/:lessonId — Xóa bài học

```bash
# Lấy lessonId từ course
LESSON_ID=$(curl -s "http://localhost:3004/courses/$COURSE_ID" | jq -r '.data.lessons[-1].id')

curl -s -X DELETE "http://localhost:3004/admin/courses/$COURSE_ID/lessons/$LESSON_ID" \
  | jq '.data | {totalLessons}'
```

**Case: Lesson không tồn tại (expect 404):**

```bash
curl -s -X DELETE "http://localhost:3004/admin/courses/$COURSE_ID/lessons/non-existent-lesson-id" | jq .
```

```json
{
  "success": false,
  "code": "LESSON_NOT_FOUND",
  "message": "Lesson with id non-existent-lesson-id not found",
  "timestamp": "...",
  "path": "/courses/.../lessons/non-existent-lesson-id"
}
```

---

### 4.8 POST /admin/courses/:id/materials — Thêm tài liệu

**Thêm PDF:**

```bash
curl -s -X POST "http://localhost:3004/admin/courses/$COURSE_ID/materials" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Giáo trình lý thuyết B2",
    "fileUrl": "https://example.com/giao-trinh.pdf",
    "type": "PDF"
  }' | jq '.data.materials'
```

**Thêm video:**

```bash
curl -s -X POST "http://localhost:3004/admin/courses/$COURSE_ID/materials" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Video hướng dẫn thực hành",
    "fileUrl": "https://example.com/video.mp4",
    "type": "VIDEO"
  }' | jq '.data.materials | length'
```

---

### 4.9 POST /courses/:id/enroll — Đăng ký khóa học

> Đảm bảo course đang ở status ACTIVE trước khi test enroll.

**Chuẩn bị license tier read model cho student:**

Course-service enroll dựa trên read model được sync từ event `user.student.license-assigned`. Trước khi gọi enroll trực tiếp trong môi trường test, publish event vào queue `course_service_events` hoặc dùng flow user-service assign license tier.

Payload RabbitMQ mẫu cho course `$COURSE_ID` có `licenseCategory = B2`:

```json
{
  "studentId": "student-uuid-0002",
  "oldLicenseTier": null,
  "newLicenseTier": "B2",
  "changedById": "admin-uuid-0001"
}
```

**Happy path:**

```bash
curl -s -X POST "http://localhost:3004/courses/$COURSE_ID/enroll" \
  -H "x-user-id: student-uuid-0002" | jq .data
```

**Kết quả mong đợi (201):**

```json
{
  "id": "<enrollment-uuid>",
  "courseId": "<course-uuid>",
  "studentId": "student-uuid-0002",
  "status": "ACTIVE",
  "progress": 0,
  "enrolledAt": "...",
  "completedAt": null
}
```

> **Lưu lại enrollment ID:**
> ```bash
> ENROLLMENT_ID=$(curl -s -X POST "http://localhost:3004/courses/$COURSE_ID/enroll" \
>   -H "x-user-id: student-uuid-NEW" | jq -r '.data.id')
> ```

**Case: Đăng ký khóa học DRAFT (expect 422):**

```bash
curl -s -X POST "http://localhost:3004/courses/$EMPTY_COURSE_ID/enroll" \
  -H "x-user-id: student-uuid-0002" | jq .
```

```json
{
  "success": false,
  "code": "COURSE_NOT_ACTIVE",
  "message": "Course is not active",
  "timestamp": "...",
  "path": "/courses/.../enroll"
}
```

**Case: Đăng ký lần 2 (expect 409):**

```bash
curl -s -X POST "http://localhost:3004/courses/$COURSE_ID/enroll" \
  -H "x-user-id: student-uuid-0002" | jq .
```

```json
{
  "success": false,
  "code": "ENROLLMENT_ALREADY_EXISTS",
  "message": "Student is already enrolled in this course",
  "timestamp": "...",
  "path": "/courses/.../enroll"
}
```

**Case: Student chưa có license tier sync sang course-service (expect 422):**

```bash
curl -s -X POST "http://localhost:3004/courses/$COURSE_ID/enroll" \
  -H "x-user-id: student-no-license" | jq .
```

```json
{
  "success": false,
  "code": "STUDENT_LICENSE_NOT_ASSIGNED",
  "message": "Student student-no-license has no assigned license tier",
  "timestamp": "...",
  "path": "/courses/.../enroll"
}
```

**Case: License tier không khớp licenseCategory của course (expect 422):**

Publish event `user.student.license-assigned` cho `student-wrong-license` với `newLicenseTier = "A1"`, rồi enroll vào course B2:

```bash
curl -s -X POST "http://localhost:3004/courses/$COURSE_ID/enroll" \
  -H "x-user-id: student-wrong-license" | jq .
```

```json
{
  "success": false,
  "code": "STUDENT_LICENSE_MISMATCH",
  "message": "Student student-wrong-license has license tier A1, but course requires B2",
  "timestamp": "...",
  "path": "/courses/.../enroll"
}
```

**Case: Khóa học hết chỗ (expect 422):**

```bash
# Tạo course với capacity=1 và đăng ký student thứ 2
SMALL_COURSE_ID=$(curl -s -X POST http://localhost:3004/admin/courses \
  -H "Content-Type: application/json" \
  -H "x-user-id: instructor-uuid-0001" \
  -d '{"title":"Small Course","licenseCategory":"C","capacity":1}' | jq -r '.data.id')

# Thêm lesson và activate
curl -s -X POST "http://localhost:3004/admin/courses/$SMALL_COURSE_ID/lessons" \
  -H "Content-Type: application/json" \
  -d '{"title":"Only lesson","order":1}' > /dev/null
curl -s -X PATCH "http://localhost:3004/admin/courses/$SMALL_COURSE_ID/activate" > /dev/null

# Đăng ký student 1 (thành công)
# Trước đó cần sync license tier C cho student-a qua event user.student.license-assigned.
curl -s -X POST "http://localhost:3004/courses/$SMALL_COURSE_ID/enroll" \
  -H "x-user-id: student-a" | jq '.success'  # → true

# Đăng ký student 2 (expect 422)
# Trước đó cần sync license tier C cho student-b qua event user.student.license-assigned.
curl -s -X POST "http://localhost:3004/courses/$SMALL_COURSE_ID/enroll" \
  -H "x-user-id: student-b" | jq .
```

```json
{
  "success": false,
  "code": "COURSE_CAPACITY_EXCEEDED",
  "message": "Course capacity has been exceeded",
  "timestamp": "...",
  "path": "/courses/.../enroll"
}
```

---

## 5. Test Enrollment endpoints

> Cần có `ENROLLMENT_ID` hợp lệ. Lấy từ bước 4.9 hoặc tạo mới.

---

### 5.1 GET /enrollments — Danh sách enrollment của student

```bash
curl -s "http://localhost:3004/enrollments" \
  -H "x-user-id: student-uuid-0002" | jq '.data | {total, items_count: (.items | length)}'
```

**Lọc theo status:**

```bash
curl -s "http://localhost:3004/enrollments?status=ACTIVE" \
  -H "x-user-id: student-uuid-0002" | jq '.data.items | map(.status)'
```

---

### 5.2 GET /enrollments/:id — Chi tiết enrollment

```bash
curl -s "http://localhost:3004/enrollments/$ENROLLMENT_ID" | jq .data
```

**Kết quả mong đợi:**

```json
{
  "id": "...",
  "courseId": "...",
  "studentId": "student-uuid-0002",
  "status": "ACTIVE",
  "progress": 0,
  "enrolledAt": "...",
  "completedAt": null
}
```

**Case: Không tìm thấy (expect 404):**

```bash
curl -s "http://localhost:3004/enrollments/non-existent-id" | jq .
```

---

### 5.3 POST /enrollments/:id/lessons/:lessonId/complete — Hoàn thành bài học

**Setup — Lấy lesson IDs từ course:**

```bash
LESSONS=$(curl -s "http://localhost:3004/courses/$COURSE_ID" | jq '.data.lessons | map(.id)')
LESSON_1_ID=$(echo $LESSONS | jq -r '.[0]')
LESSON_2_ID=$(echo $LESSONS | jq -r '.[1]')
echo "LESSON_1=$LESSON_1_ID"
echo "LESSON_2=$LESSON_2_ID"
```

**Hoàn thành bài học 1:**

```bash
curl -s -X POST "http://localhost:3004/enrollments/$ENROLLMENT_ID/lessons/$LESSON_1_ID/complete" \
  | jq '.data | {progress, status}'
```

**Kết quả mong đợi (progress = 50% nếu có 2 bài):**

```json
{
  "progress": 50,
  "status": "ACTIVE"
}
```

**Hoàn thành bài học 2 → enrollment COMPLETED:**

```bash
curl -s -X POST "http://localhost:3004/enrollments/$ENROLLMENT_ID/lessons/$LESSON_2_ID/complete" \
  | jq '.data | {progress, status, completedAt}'
```

**Kết quả mong đợi (progress = 100%):**

```json
{
  "progress": 100,
  "status": "COMPLETED",
  "completedAt": "2026-05-07T..."
}
```

> **Lưu ý:** Không có per-lesson tracking — mỗi lần gọi `complete` tăng `progress += 100/totalLessons`. Không có `LESSON_ALREADY_COMPLETED` vì không track per-lesson state.

**Case: Enrollment đã COMPLETED (expect 422):**

```bash
curl -s -X POST "http://localhost:3004/enrollments/$ENROLLMENT_ID/lessons/$LESSON_1_ID/complete" \
  | jq .
```

```json
{
  "success": false,
  "code": "ENROLLMENT_ALREADY_COMPLETED",
  "message": "Enrollment is already completed",
  "timestamp": "...",
  "path": "/enrollments/.../lessons/.../complete"
}
```

---

## 6. Test luồng RabbitMQ event

### 6.1 Kiểm tra RabbitMQ đang chạy

**RabbitMQ Management UI:** http://localhost:15672
Username: `guest` / Password: `guest`

Vào tab **Queues** để thấy:

- `course_service_events` — queue course-service CONSUME (nhận event từ user-service)
- `course_service_publish` — queue course-service PUBLISH events vào

### 6.2 Kiểm tra events được publish sau enroll

Sau khi `POST /courses/:id/enroll` thành công, vào tab **Queues** → `course_service_publish` → **Get messages** để xem event `course.enrollment.created`.

### 6.3 Kiểm tra events sau complete lesson

Sau khi `POST /enrollments/:id/lessons/:lessonId/complete`:
- Tìm event `course.lesson.completed` trong queue
- Nếu enrollment = 100%, tìm thêm `course.enrollment.completed`

### 6.4 Simulate event `user.student.license-assigned`

Publish thủ công vào `course_service_events`:

**Cách 1: RabbitMQ Management UI**

1. Vào http://localhost:15672
2. Tab **Queues** → `course_service_events` → **Publish message**
3. Routing key: `user.student.license-assigned`
4. Payload theo Nest RMQ packet format:
```json
{
  "pattern": "user.student.license-assigned",
  "data": {
    "studentId": "student-uuid-0002",
    "oldLicenseTier": null,
    "newLicenseTier": "B2",
    "changedById": "admin-uuid-0001"
  }
}
```
5. Click **Publish message**

**Kết quả mong đợi:** Course-service log: `Received user.student.license-assigned for studentId=student-uuid-0002, newLicenseTier=B2` và table `student_license_profiles` có record tương ứng.

---

## 7. Kiểm tra Database trực tiếp

### Dùng Prisma Studio

```bash
cd apps/course-service
npm run db:studio
```

Mở http://localhost:5555 để xem các bảng:
- `courses`
- `lessons`
- `course_instructors`
- `course_requirements`
- `course_materials`
- `course_enrollments`
- `student_license_profiles`

### Dùng psql trực tiếp

```bash
psql postgresql://user:password@localhost:5435/course_db
```

```sql
-- Xem tất cả courses và số bài học
SELECT id, title, "licenseCategory", status, "totalLessons", "tuitionFee", capacity
FROM courses
ORDER BY "createdAt" DESC;

-- Xem lessons của một course
SELECT id, title, "order", content
FROM lessons
WHERE "courseId" = '<course-uuid>'
ORDER BY "order";

-- Xem enrollments và tiến độ
SELECT
  id,
  "studentId",
  status,
  progress,
  "enrolledAt",
  "completedAt"
FROM course_enrollments
ORDER BY "enrolledAt" DESC;

-- Xem license tier read model sync từ user-service
SELECT "studentId", "licenseTier", "syncedAt", "updatedAt"
FROM student_license_profiles
ORDER BY "updatedAt" DESC;

-- Đếm số enrollment theo course (kiểm tra capacity)
SELECT "courseId", COUNT(*) AS enrolled_count
FROM course_enrollments
WHERE status != 'DROPPED'
GROUP BY "courseId";
```

---

## 8. Test Security Audit Và Outbox

Mục tiêu: chứng minh các course mutation quan trọng ghi audit event bằng transactional outbox và xuất hiện trong `audit-service`.

### 8.1 Audited actions cần cover

| API | Expected audit action |
| --- | --- |
| `POST /admin/courses` | `COURSE_CREATED` |
| `PATCH /admin/courses/:id` | `COURSE_UPDATED` |
| `PATCH /admin/courses/:id/activate` | `COURSE_ACTIVATED` |
| `DELETE /admin/courses/:id` | `COURSE_ARCHIVED` |
| `POST /admin/courses/:id/lessons` | `COURSE_LESSON_ADDED` |
| `DELETE /admin/courses/:id/lessons/:lessonId` | `COURSE_LESSON_REMOVED` |
| `POST /admin/courses/:id/materials` | `COURSE_MATERIAL_ADDED` |
| `POST /enrollments/:id/reset-progress` | `ENROLLMENT_PROGRESS_RESET` |

### 8.2 Gọi một mutation và lấy correlation id

Ví dụ archive course:

```bash
curl -i -X DELETE http://localhost:8000/admin/courses/<course-id> \
  -H "Authorization: Bearer <ADMIN_OR_CENTER_MANAGER_TOKEN>"
```

Expected:

- HTTP `200`.
- Response header có `x-correlation-id`.
- Course được archive/soft delete theo behavior hiện tại.

### 8.3 Verify outbox trong `course_db`

```sql
SELECT
  payload->>'action' AS action,
  payload->>'resourceType' AS resource_type,
  payload->>'resourceId' AS resource_id,
  status,
  attempts,
  "publishedAt",
  "lastError"
FROM outbox_messages
ORDER BY "createdAt" DESC
LIMIT 10;
```

Expected:

- Có row `action = COURSE_ARCHIVED`.
- `resource_type = COURSE`.
- `resource_id = <course-id>`.
- Bình thường sau vài giây `status = PUBLISHED`.

### 8.4 Verify centralized audit-service

```bash
curl -s "http://localhost:8000/admin/audit-logs?serviceName=course-service&resourceId=<course-id>" \
  -H "Authorization: Bearer <ADMIN_OR_CENTER_MANAGER_TOKEN>" | jq .
```

Expected:

- Có item `serviceName = course-service`.
- `action` đúng với API vừa gọi.
- `correlationId` tồn tại để join với access log.
- `metadata` đúng theo action, ví dụ `COURSE_ARCHIVED` có `{ "status": "ARCHIVED" }`.

### 8.5 Verify outbox retry khi RabbitMQ lỗi

```bash
docker compose stop rabbitmq

# Gọi một audited mutation, ví dụ update course title
curl -i -X PATCH http://localhost:8000/admin/courses/<course-id> \
  -H "Authorization: Bearer <ADMIN_OR_CENTER_MANAGER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{ "title": "Course updated while RabbitMQ down" }'
```

Expected:

- Business update vẫn thành công nếu request path không cần RabbitMQ trực tiếp.
- `course_db.outbox_messages` có row `PENDING` hoặc sau retry thành `FAILED`.
- `audit_db.audit_logs` chưa có ngay record mới.

Start RabbitMQ lại:

```bash
docker compose start rabbitmq
```

Expected: relay publish lại message còn `PENDING`; audit log xuất hiện trong `audit-service`.

---

## 9. Troubleshooting

### Service không start — PrismaClientConstructorValidationError

```
PrismaClientConstructorValidationError: Invalid value undefined for datasource "db"
```

→ Consul chưa chạy hoặc chưa seed. Chạy:

```bash
npm run infra:up
npm run consul:seed:local
```

Sau đó restart service.

---

### Database connection error

```
Error: Can't reach database server at localhost:5435
```

→ Chạy:

```bash
npm run infra:up
```

---

### Prisma schema chưa migrate

```
PrismaClientInitializationError
```

→ Chạy:

```bash
cd apps/course-service
npm run db:generate
npm run db:migrate
```

---

### `422 COURSE_HAS_NO_LESSON` khi activate

→ Đúng behavior. Phải thêm ít nhất 1 lesson trước khi activate.

---

### `409 ENROLLMENT_ALREADY_EXISTS`

→ Đúng behavior. Mỗi student chỉ được đăng ký một khóa học một lần. Dùng `studentId` khác hoặc tạo course mới để test lại.

---

### RabbitMQ event không được publish

1. Kiểm tra `rabbitmq.url` trong Consul KV đã được seed
2. Kiểm tra course-service log: `Course Service listening on port 3004` → microservice start OK
3. Vào RabbitMQ UI → tab Connections kiểm tra course-service đã connect

---

### Response format sai (không có `success` field)

→ `DomainExceptionFilter` hoặc `ApiExceptionFilter` chưa register. Kiểm tra `main.ts`:

```typescript
app.useGlobalFilters(new ApiExceptionFilter(), new DomainExceptionFilter());
```

---

## Checklist test nhanh (Happy Path)

Chạy từ root để verify toàn bộ flow sau mỗi thay đổi:

```bash
BASE="http://localhost:3004"
INSTRUCTOR="instructor-test-001"
STUDENT="student-test-002"

# 1. Tạo course
COURSE_ID=$(curl -s -X POST $BASE/admin/courses \
  -H "Content-Type: application/json" \
  -H "x-user-id: $INSTRUCTOR" \
  -d '{"title":"Test Course","licenseCategory":"B1","capacity":10}' \
  | jq -r '.data.id')
echo "✓ Course created: $COURSE_ID"

# 2. Thêm 2 lessons
curl -s -X POST "$BASE/admin/courses/$COURSE_ID/lessons" \
  -H "Content-Type: application/json" \
  -d '{"title":"Lesson 1","order":1}' > /dev/null
curl -s -X POST "$BASE/admin/courses/$COURSE_ID/lessons" \
  -H "Content-Type: application/json" \
  -d '{"title":"Lesson 2","order":2}' > /dev/null
echo "✓ 2 lessons added"

# 3. Activate
STATUS=$(curl -s -X PATCH "$BASE/courses/$COURSE_ID/activate" | jq -r '.data.status')
echo "✓ Course activated: $STATUS"  # → ACTIVE

# 4. Enroll student
ENROLLMENT_ID=$(curl -s -X POST "$BASE/courses/$COURSE_ID/enroll" \
  -H "x-user-id: $STUDENT" | jq -r '.data.id')
echo "✓ Enrolled: $ENROLLMENT_ID"

# 5. Lấy lesson IDs
L1=$(curl -s "$BASE/courses/$COURSE_ID" | jq -r '.data.lessons[0].id')
L2=$(curl -s "$BASE/courses/$COURSE_ID" | jq -r '.data.lessons[1].id')

# 6. Complete lesson 1
PROGRESS=$(curl -s -X POST "$BASE/enrollments/$ENROLLMENT_ID/lessons/$L1/complete" \
  | jq '.data.progress')
echo "✓ Lesson 1 completed. Progress: $PROGRESS%"  # → 50

# 7. Complete lesson 2 → enrollment COMPLETED
FINAL=$(curl -s -X POST "$BASE/enrollments/$ENROLLMENT_ID/lessons/$L2/complete" \
  | jq '{progress: .data.progress, status: .data.status}')
echo "✓ Lesson 2 completed: $FINAL"  # → {progress:100, status:"COMPLETED"}

echo ""
echo "All checks passed!"
```
## ASR: Reset Progress And Archive Course

### Reset Learning Progress

```http
POST http://localhost:3004/enrollments/{enrollmentId}/reset-progress
Authorization: Bearer <student_token>
```

Expected:

- enrollment `progress = 0`
- enrollment `status = ACTIVE`
- `completedAt = null`
- exam history remains unchanged in `exam-service`
- `analytics-service` receives `course.enrollment.progress-reset`

### Archive Course

```http
DELETE http://localhost:3004/admin/courses/{courseId}
Authorization: Bearer <admin_token>
```

Expected: course status becomes `ARCHIVED`; normal list endpoints no longer return it unless explicitly filtered.
