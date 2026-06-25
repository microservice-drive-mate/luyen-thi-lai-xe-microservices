# Domain-Driven Design Trong Hệ Thống DriveMate

## 1. Mục tiêu của tài liệu

Tài liệu này tổng hợp phần **Domain-Driven Design (DDD)** theo đề cương môn học và đối chiếu trực tiếp với cách hệ thống DriveMate áp dụng trong codebase.

Mục tiêu không chỉ là định nghĩa DDD, mà còn giúp trả lời các câu hỏi phản biện thường gặp:

- Vì sao hệ thống chọn DDD?
- Domain nằm ở đâu trong code?
- Entity, Value Object, Aggregate, Repository được áp dụng như thế nào?
- Bounded Context được xác định ra sao?
- Vì sao mỗi service có database riêng?
- Mapping DDD sang microservices trong hệ thống có ưu điểm và trade-off gì?

## 2. Giới thiệu DDD

### 2.1. DDD là gì?

Domain-Driven Design là phương pháp thiết kế phần mềm tập trung vào **domain nghiệp vụ**. Thay vì bắt đầu từ database table hoặc framework, DDD bắt đầu từ việc hiểu bài toán, ngôn ngữ nghiệp vụ, quy trình vận hành và các ranh giới trách nhiệm trong hệ thống.

Trong DriveMate, domain chính là bài toán quản lý trung tâm luyện thi lái xe:

- Quản lý tài khoản và vai trò người dùng.
- Quản lý hồ sơ học viên.
- Gán hạng bằng lái cho học viên.
- Quản lý khóa học, bài học, tài liệu và ghi danh.
- Quản lý ngân hàng câu hỏi.
- Tạo phiên thi, lưu câu trả lời, chấm điểm và xác định pass/fail.
- Gửi thông báo.
- Theo dõi tiến độ học tập và dashboard.
- Quản lý file/media.
- Lưu audit log cho hành động quan trọng.

DDD giúp code phản ánh đúng các khái niệm nghiệp vụ này. Thay vì viết các service theo kiểu CRUD thuần túy, hệ thống đưa business rule vào các domain object như aggregate, entity và value object.

### 2.2. Vai trò của Domain Layer

Trong kiến trúc hiện tại, các service chính đều được chia theo cấu trúc:

```text
src/
  domain/
  application/
  infrastructure/
  presentation/
```

Ý nghĩa từng layer:

| Layer              | Vai trò                                                                                                                |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `domain`         | Chứa business rule cốt lõi: aggregate, entity, value object, domain event, domain exception, repository abstraction. |
| `application`    | Điều phối use case: nhận command/query, load aggregate, gọi domain method, lưu repository, publish event.         |
| `infrastructure` | Adapter kỹ thuật: Prisma repository, HTTP client, RabbitMQ, Redis, Azure Storage, Keycloak adapter.                   |
| `presentation`   | Controller, DTO, API endpoint, messaging handler.                                                                       |

Điểm quan trọng: **domain không phụ thuộc trực tiếp vào controller, Prisma, RabbitMQ hoặc Kubernetes**. Các công nghệ đó nằm ngoài domain. Điều này giúp logic nghiệp vụ ít bị ảnh hưởng khi thay đổi framework hoặc hạ tầng.

### 2.3. Ubiquitous Language

Ubiquitous Language là ngôn ngữ chung giữa đội kỹ thuật và nghiệp vụ. Trong DDD, tên class, method, event, exception nên phản ánh đúng khái niệm nghiệp vụ.

Trong DriveMate, nhiều tên trong code thể hiện trực tiếp ngôn ngữ nghiệp vụ:

| Khái niệm nghiệp vụ             | Biểu hiện trong code                                                            |
| ----------------------------------- | --------------------------------------------------------------------------------- |
| Học viên được gán hạng bằng | `assignLicenseTier`, `LicenseTierAssignedEvent`                               |
| Khóa học                          | `Course`, `CourseStatus`, `Lesson`, `CourseMaterial`                      |
| Ghi danh khóa học                 | `CourseEnrollment`, `EnrollmentStatus`, `completeLesson`, `resetProgress` |
| Phiên thi                          | `ExamSession`, `ExamSessionStatus`, `submit`, `saveAnswer`                |
| Câu hỏi thi                       | `Question`, `QuestionTopic`, `QuestionDifficulty`                           |
| File/media                          | `FileObject`, `MimeType`, `FileSize`                                        |
| Nhật ký audit                     | `AuditLog`, `security.audit.recorded`                                         |

Ví dụ, trong `exam-service`, method `submit()` và `saveAnswer()` nằm trong aggregate `ExamSession`. Đây không phải tên kỹ thuật kiểu `updateRow()` hay `saveData()`, mà là ngôn ngữ nghiệp vụ của bài toán thi.

## 3. Thành phần cốt lõi của DDD trong hệ thống

### 3.1. Entity

Entity là object có định danh riêng. Hai entity có thể có cùng dữ liệu nhưng khác identity thì vẫn là hai đối tượng khác nhau.

Trong codebase, base class `Entity<TId>` nằm ở:

```text
packages/common/src/ddd/entity.base.ts
```

Entity có:

- `_id`
- getter `id`
- method `equals()` so sánh theo identity và class

Ví dụ entity trong hệ thống:

| Service              | Entity/Aggregate Root                                              | Ý nghĩa                                        |
| -------------------- | ------------------------------------------------------------------ | ------------------------------------------------ |
| `identity-service` | `IdentityUser`                                                   | Tài khoản định danh trong hệ thống.        |
| `user-service`     | `UserProfile`, `StudentDetail`                                 | Hồ sơ người dùng và thông tin học viên. |
| `course-service`   | `Course`, `Lesson`, `CourseInstructor`, `CourseEnrollment` | Khóa học, bài học, giảng viên, ghi danh.   |
| `exam-service`     | `ExamSession`, `ExamSessionQuestion`                           | Phiên thi và câu hỏi trong phiên thi.       |
| `media-service`    | `FileObject`                                                     | File/media được upload và quản lý.         |
| `audit-service`    | `AuditLog`                                                       | Bản ghi audit trail.                            |

Ví dụ `IdentityUser` là entity vì nó có `id`, email, role, trạng thái active/deleted, và vòng đời riêng. Khi đổi email hoặc role, nó vẫn là cùng một identity user.

### 3.2. Value Object

Value Object là object không có identity riêng, được so sánh bằng giá trị. Value Object thường dùng để đóng gói rule validation cho một kiểu dữ liệu nghiệp vụ.

Trong codebase, base class `ValueObject<T>` nằm ở:

```text
packages/common/src/ddd/value-object.base.ts
```

Value Object có:

- `props` bất biến bằng `Object.freeze`
- method `equals()` so sánh theo giá trị

Ví dụ trong hệ thống:

| Value Object    | File                                                              | Business rule                                         |
| --------------- | ----------------------------------------------------------------- | ----------------------------------------------------- |
| `Email`       | `apps/identity-service/src/domain/value-objects/email.vo.ts`    | Email phải hợp lệ trước khi tạo identity user.  |
| `PhoneNumber` | `apps/user-service/src/domain/value-objects/phone-number.vo.ts` | Số điện thoại phải đúng format Việt Nam.      |
| `MimeType`    | `apps/media-service/src/domain/value-objects/mime-type.vo.ts`   | Chỉ cho phép các MIME type nằm trong allow-list.  |
| `FileSize`    | `apps/media-service/src/domain/value-objects/file-size.vo.ts`   | Đóng gói rule liên quan đến kích thước file. |

Ví dụ `PhoneNumber` không cần ID riêng. Hai số điện thoại có cùng value thì được xem là bằng nhau. Rule kiểm tra số điện thoại Việt Nam nằm trong Value Object, thay vì rải rác ở controller hoặc DTO.

### 3.3. Aggregate và Aggregate Root

Aggregate là cụm object liên quan chặt chẽ với nhau và cần được bảo vệ consistency như một đơn vị. Aggregate Root là object duy nhất bên ngoài được phép tương tác trực tiếp.

Trong codebase, base class `AggregateRoot<TId>` nằm ở:

```text
packages/common/src/ddd/aggregate-root.base.ts
```

Aggregate Root kế thừa `Entity` và có thêm domain event:

- `addDomainEvent()`
- `getDomainEvents()`
- `clearDomainEvents()`

Điều này cho phép aggregate phát sinh event nghiệp vụ khi trạng thái thay đổi.

### 3.4. Ví dụ Aggregate trong DriveMate

#### IdentityUser

File:

```text
apps/identity-service/src/domain/aggregates/identity-user/identity-user.aggregate.ts
```

`IdentityUser` quản lý trạng thái tài khoản:

- email
- full name
- role
- active/deleted
- deletedAt/deletedBy

Business method:

- `create()`
- `update()`
- `changeRole()`
- `lock()`
- `softDelete()`

Domain event:

- `UserCreatedEvent`
- `UserUpdatedEvent`
- `UserRoleChangedEvent`
- `UserLockedEvent`
- `UserDeletedEvent`

Ý nghĩa DDD: logic đổi role, khóa user, xóa mềm user nằm trong aggregate, không nằm trực tiếp ở controller.

#### UserProfile

File:

```text
apps/user-service/src/domain/aggregates/user-profile/user-profile.aggregate.ts
```

`UserProfile` là aggregate root cho hồ sơ người dùng. Bên trong có thể có entity con `StudentDetail` nếu user là học viên.

Business method quan trọng:

```text
assignLicenseTier(newTier, changedById, studentDetailId?)
```

Rule nghiệp vụ:

- Chỉ user role `STUDENT` mới được gán license tier.
- Nếu user không phải student thì throw `UserNotStudentException`.
- Khi gán hạng bằng, aggregate tạo audit entry và phát `LicenseTierAssignedEvent`.

Ý nghĩa DDD: rule “chỉ học viên mới được gán hạng bằng” nằm trong domain aggregate, không phụ thuộc API endpoint nào gọi vào.

#### Course

File:

```text
apps/course-service/src/domain/aggregates/course/course.aggregate.ts
```

`Course` quản lý khóa học và các entity con:

- `Lesson`
- `CourseInstructor`
- `CourseRequirement`
- `CourseMaterial`

Business method:

- `activate()`
- `deactivate()`
- `archive()`
- `addLesson()`
- `updateLesson()`
- `removeLesson()`
- `addInstructor()`
- `removeInstructor()`
- `addMaterial()`

Rule nghiệp vụ:

- Không cho activate course nếu chưa có lesson.
- Không cho assign trùng instructor.
- Có optimistic version để tránh update conflict.
- Khi link material có `mediaFileId`, aggregate phát `CourseMaterialLinkedEvent`.

Ý nghĩa DDD: Course là aggregate root bảo vệ consistency của lesson, instructor, requirement và material thuộc khóa học.

#### CourseEnrollment

File:

```text
apps/course-service/src/domain/aggregates/course-enrollment/course-enrollment.aggregate.ts
```

`CourseEnrollment` quản lý trạng thái ghi danh của học viên vào khóa học.

Business method:

- `completeLesson()`
- `drop()`
- `reactivate()`
- `resetProgress()`

Rule nghiệp vụ:

- Nếu enrollment đã completed thì không cho complete lesson tiếp.
- Khi hoàn thành lesson, progress tăng theo tổng số lesson.
- Nếu progress đạt 100%, enrollment chuyển sang `COMPLETED`.
- Aggregate phát event `CourseLessonCompletedEvent` và `CourseEnrollmentCompletedEvent`.

#### ExamSession

File:

```text
apps/exam-service/src/domain/aggregates/exam-session/exam-session.aggregate.ts
```

`ExamSession` quản lý toàn bộ vòng đời một phiên thi.

Business method:

- `saveAnswer()`
- `submit()`
- `expireIfNeeded()`
- `ensureFinished()`

Rule nghiệp vụ:

- Chỉ được lưu câu trả lời khi session đang `IN_PROGRESS`.
- Không cho lưu câu trả lời khi session đã hết hạn.
- Khi submit, aggregate tự chấm điểm.
- Nếu sai quá số câu critical cho phép, session fail vì critical mistake.
- Aggregate phát event `ExamSessionCompletedEvent`, `ExamSessionPassedEvent` hoặc `ExamSessionFailedEvent`.

Ý nghĩa DDD: logic chấm điểm nằm trong aggregate, không nằm ở controller. Controller chỉ nhận request, use case load aggregate, gọi `submit()`, rồi lưu lại.

## 4. Repository trong DDD

### 4.1. Repository là gì?

Repository trong DDD là abstraction dùng để load/save aggregate. Domain layer chỉ biết tới repository interface/abstract class, không biết chi tiết database.

Repository giúp:

- Domain không phụ thuộc Prisma/PostgreSQL.
- Use case làm việc với aggregate thay vì raw table.
- Infrastructure có thể thay implementation mà không phá domain.

### 4.2. Repository trong codebase

Ví dụ:

| Service               | Domain repository abstraction                         | Infrastructure implementation                                     |
| --------------------- | ----------------------------------------------------- | ----------------------------------------------------------------- |
| `identity-service`  | `IdentityUserRepository`                            | `PrismaIdentityUserRepository`                                  |
| `user-service`      | `UserProfileRepository`                             | `PrismaUserProfileRepository`                                   |
| `course-service`    | `CourseRepository`, `CourseEnrollmentRepository`  | `PrismaCourseRepository`, `PrismaCourseEnrollmentRepository`  |
| `exam-service`      | `ExamSessionRepository`, `ExamTemplateRepository` | `PrismaExamSessionRepository`, `PrismaExamTemplateRepository` |
| `media-service`     | `FileObjectRepository`                              | `PrismaFileObjectRepository`                                    |
| `analytics-service` | `LearningProgressRepository`                        | `PrismaLearningProgressRepository`                              |
| `audit-service`     | `AuditLogRepository`                                | `PrismaAuditLogRepository`                                      |

Ví dụ flow điển hình:

```text
Controller
  -> Use Case
  -> Repository.findById()
  -> Aggregate business method
  -> Repository.save()
  -> Publish domain events
```

Điểm quan trọng: Repository lưu aggregate, không để controller thao tác trực tiếp với Prisma model.

## 5. Bounded Context

### 5.1. Bounded Context là gì?

Bounded Context là ranh giới trong đó một model nghiệp vụ có ý nghĩa rõ ràng và nhất quán. Cùng một từ có thể mang ý nghĩa khác nhau ở các context khác nhau.

Ví dụ trong hệ thống:

- “User” trong `identity-service` là tài khoản định danh, role, trạng thái login/lock.
- “User” trong `user-service` là hồ sơ người dùng, số điện thoại, ngày sinh, avatar, thông tin học viên.
- “Student” trong `course-service` chủ yếu là một ID/read model dùng để kiểm tra ghi danh khóa học.
- “Student” trong `analytics-service` là projection phục vụ dashboard và thống kê.

Nếu gom tất cả vào một model `User` duy nhất, model sẽ phình to, coupling cao và khó bảo trì. Bounded Context giúp mỗi service có model riêng phù hợp với trách nhiệm của nó.

### 5.2. Bounded Context trong DriveMate

| Bounded Context     | Service                  | Trách nhiệm chính                                             | Database/Schema sở hữu |
| ------------------- | ------------------------ | ---------------------------------------------------------------- | ------------------------ |
| Identity & Access   | `identity-service`     | Tài khoản, role, tích hợp Keycloak, login/logout/token.      | `identity_db`          |
| User Profile        | `user-service`         | Hồ sơ người dùng, student detail, license tier.             | `user_db`              |
| Course & Enrollment | `course-service`       | Khóa học, lesson, material, instructor assignment, enrollment. | `course_db`            |
| Question Bank       | `question-service`     | Câu hỏi, topic, option, pool câu hỏi.                        | `question_db`          |
| Exam                | `exam-service`         | Template đề thi, phiên thi, câu trả lời, chấm điểm.     | `exam_db`              |
| Notification        | `notification-service` | Thông báo, email/push/in-app, retry delivery.                  | `notification_db`      |
| Analytics           | `analytics-service`    | Projection, dashboard, tiến độ học tập.                     | `analytics_db`         |
| Simulation          | `simulation-service`   | Mô phỏng tình huống/practice session.                        | `simulation_db`        |
| Media               | `media-service`        | File object, upload/download, Azure Blob/SAS.                    | `media_db`             |
| Audit               | `audit-service`        | Centralized audit trail.                                         | `audit_db`             |

### 5.3. Vì sao tách database theo Bounded Context?

Trong DDD + microservices, database không chỉ là nơi lưu dữ liệu, mà còn là một phần của ownership. Mỗi bounded context sở hữu schema của nó để tránh coupling.

Lý do tách database:

- Mỗi service có quyền kiểm soát model và migration riêng.
- Service khác không query thẳng table nội bộ.
- Thay đổi schema trong một context ít ảnh hưởng context khác.
- Tránh tạo một shared database khổng lồ khiến microservices chỉ là “distributed controllers”.
- Rõ ràng trách nhiệm: ai sở hữu dữ liệu nào, ai được cập nhật dữ liệu nào.

Trong local Docker Compose, hệ thống chạy nhiều PostgreSQL container/database để minh họa rõ database-per-service. Trên AKS Student, để tiết kiệm tài nguyên, hệ thống có thể dùng Neon hoặc một PostgreSQL instance với nhiều logical database. Tuy nhiên về mặt thiết kế, ownership vẫn là **mỗi service sở hữu database/schema riêng**.

## 6. Mapping DDD sang Microservices

### 6.1. Nguyên tắc mapping

Nguyên tắc theo đề cương:

```text
1 Bounded Context ≈ 1 Microservice
```

Trong DriveMate, mapping này được áp dụng khá rõ:

```text
Identity Context      -> identity-service
User Profile Context  -> user-service
Course Context        -> course-service
Question Context      -> question-service
Exam Context          -> exam-service
Media Context         -> media-service
Analytics Context     -> analytics-service
Audit Context         -> audit-service
```

Dấu `≈` quan trọng vì trong thực tế không phải lúc nào cũng tuyệt đối 1-1. Có context có thể tách nhỏ hơn khi domain lớn lên, hoặc một service có thể tạm gộp nhiều subdomain nhỏ nếu quy mô còn hợp lý. Với đồ án hiện tại, mapping 1 bounded context = 1 service là phù hợp vì giúp thể hiện ranh giới nghiệp vụ rõ ràng.

### 6.2. Vì sao không làm một monolith?

Nếu làm monolith, triển khai ban đầu đơn giản hơn. Nhưng với mục tiêu của đồ án là microservices và cloud-native, DDD giúp tránh tách service theo cảm tính.

Không tách theo kiểu:

```text
auth-controller-service
user-table-service
course-api-service
```

Mà tách theo domain:

```text
Identity
User Profile
Course & Enrollment
Exam
Question Bank
Analytics
Media
Audit
```

Điều này giúp mỗi service có lý do tồn tại rõ ràng.

### 6.3. Giao tiếp giữa các Bounded Context

Các bounded context không truy cập trực tiếp database của nhau. Khi cần dữ liệu từ context khác, hệ thống dùng:

- API call qua service boundary.
- Event-driven messaging qua RabbitMQ.
- Projection/read model ở service cần đọc nhanh.

Ví dụ:

- `identity-service` tạo user và phát event để `user-service` tạo profile.
- `user-service` gán license tier và phát event để `course-service` sync read model student license.
- `exam-service` hoàn thành phiên thi và phát event để `analytics-service` cập nhật dashboard.
- `media-service` quản lý file object, các service khác chỉ link bằng `mediaFileId` hoặc gọi API lấy URL.

Đây là cách giữ database ownership nhưng vẫn cho phép hệ thống đồng bộ nghiệp vụ.

## 7. Vì sao hệ thống áp dụng DDD?

### 7.1. Nghiệp vụ có nhiều rule hơn CRUD

DriveMate không chỉ là CRUD đơn giản. Có nhiều rule nghiệp vụ:

- Chỉ student mới được gán license tier.
- Course muốn active phải có lesson.
- Instructor không được assign trùng vào cùng course.
- Enrollment completed thì không được complete lesson tiếp.
- Exam session hết hạn thì không được save answer.
- Submit exam phải tính pass/fail theo score và critical mistakes.
- File upload phải kiểm tra MIME type và size.

Các rule này nếu đặt trong controller sẽ dễ bị trùng lặp và khó test. DDD gom rule vào aggregate/value object để bảo vệ consistency.

### 7.2. Microservices cần ranh giới rõ

Nếu không có bounded context, microservices dễ bị tách sai:

- Service gọi database của nhau.
- Model dùng chung quá nhiều.
- Một thay đổi nhỏ kéo theo nhiều service.
- Business rule nằm rải rác ở controller và adapter.

DDD cung cấp cách xác định ranh giới theo nghiệp vụ, từ đó mapping sang service hợp lý hơn.

### 7.3. Dễ test business rule

Aggregate và Value Object là object TypeScript thuần, nên có thể test mà không cần chạy database hoặc HTTP server.

Ví dụ có thể test:

- `Course.activate()` phải fail nếu chưa có lesson.
- `Course.addInstructor()` phải fail nếu instructor trùng.
- `ExamSession.submit()` tính pass/fail đúng.
- `PhoneNumber.create()` reject số không hợp lệ.
- `MimeType.create()` reject MIME type không nằm trong allow-list.

Đây là lợi ích lớn của việc đặt logic trong domain layer.

### 7.4. Dễ thay đổi hạ tầng

Vì domain không phụ thuộc Prisma, Redis, RabbitMQ hoặc Keycloak, nên thay đổi infrastructure ít ảnh hưởng core business.

Ví dụ:

- Đổi Prisma sang ORM khác thì chủ yếu đổi infrastructure repository.
- Đổi RabbitMQ sang Kafka thì domain event vẫn có thể giữ ý nghĩa nghiệp vụ.
- Đổi local PostgreSQL sang Neon/Azure Database không làm đổi aggregate.
- Đổi Keycloak adapter không làm đổi `IdentityUser` aggregate.

## 8. Ví dụ flow DDD end-to-end

### 8.1. Flow gán hạng bằng cho học viên

```text
PATCH /admin/users/:id/license-tier
  -> AdminUserController
  -> AssignLicenseTierUseCase
  -> UserProfileRepository.findById()
  -> UserProfile.assignLicenseTier()
  -> UserProfileRepository.save()
  -> publish LicenseTierAssignedEvent / audit event
  -> course-service sync student license read model
```

Điểm DDD:

- Rule “chỉ STUDENT mới được gán license tier” nằm trong `UserProfile`.
- Event `LicenseTierAssignedEvent` thể hiện sự kiện nghiệp vụ.
- `course-service` không đọc trực tiếp `user_db`; nó nhận event để cập nhật read model riêng.

### 8.2. Flow hoàn thành bài học

```text
POST /enrollments/:id/lessons/:lessonId/complete
  -> CourseEnrollmentRepository.findById()
  -> CourseEnrollment.completeLesson()
  -> nếu progress >= 100, status = COMPLETED
  -> phát CourseLessonCompletedEvent / CourseEnrollmentCompletedEvent
  -> analytics-service cập nhật dashboard
```

Điểm DDD:

- Progress và trạng thái enrollment được tính trong aggregate.
- Không để controller tự sửa `progress` hoặc `status`.

### 8.3. Flow nộp bài thi

```text
POST /exams/sessions/:id/submit
  -> ExamSessionRepository.findById()
  -> ExamSession.assertOwner()
  -> ExamSession.submit()
  -> aggregate grade câu hỏi
  -> tính score, critical mistakes, pass/fail
  -> phát ExamSessionCompletedEvent / Passed / Failed
```

Điểm DDD:

- Rule chấm điểm nằm trong `ExamSession`.
- `ExamSessionQuestion` là entity con thuộc aggregate.
- Use case điều phối, aggregate quyết định nghiệp vụ.

## 9. Trade-off khi dùng DDD trong đồ án

### 9.1. Ưu điểm

- Code phản ánh nghiệp vụ rõ hơn.
- Business rule tập trung trong domain object.
- Dễ unit test business logic.
- Ranh giới microservice rõ hơn.
- Giảm coupling giữa service và database.
- Dễ mở rộng theo bounded context.

### 9.2. Hạn chế và chi phí

- Nhiều file hơn so với CRUD service đơn giản.
- Cần discipline để không đưa logic nghiệp vụ vào controller/repository.
- Mapping domain object sang Prisma model tốn thêm mapper/repository code.
- Eventual consistency phức tạp hơn join trực tiếp database.
- Với đồ án nhỏ, DDD có thể trông “nặng”, nhưng phù hợp vì mục tiêu là microservices và kiến trúc enterprise-oriented.

## 10. Câu hỏi phản biện thường gặp

### Vì sao nói hệ thống áp dụng DDD chứ không chỉ chia folder?

Vì hệ thống không chỉ có folder `domain`, mà có domain object thật:

- Aggregate root kế thừa `AggregateRoot`.
- Value Object có validation riêng.
- Repository abstraction nằm trong domain.
- Prisma implementation nằm trong infrastructure.
- Business method nằm trong aggregate: `assignLicenseTier`, `activate`, `completeLesson`, `submit`, `saveAnswer`.
- Domain event phát sinh từ aggregate.

### Vì sao `identity-service` và `user-service` tách riêng?

Vì chúng thuộc hai bounded context khác nhau:

- `identity-service`: xác thực, role, Keycloak, login/logout, token.
- `user-service`: hồ sơ người dùng, student detail, license tier, avatar, thông tin cá nhân.

Nếu gộp lại, identity logic và profile logic sẽ coupling. Khi thay đổi Keycloak hoặc policy auth, profile domain bị ảnh hưởng không cần thiết.

### Vì sao không cho service khác query thẳng database?

Vì làm vậy phá vỡ bounded context ownership. Nếu `course-service` đọc thẳng `user_db`, thì schema user không còn thuộc riêng `user-service`. Khi user-service đổi schema, course-service có thể vỡ. Hệ thống chọn event/API để giao tiếp qua contract rõ ràng.

### Có phải 1 bounded context luôn luôn bằng 1 microservice?

Không tuyệt đối. Đây là guideline. Trong DriveMate, mapping gần 1-1 vì domain đủ rõ và mục tiêu đồ án là microservices. Trong thực tế, có thể bắt đầu bằng modular monolith rồi tách bounded context thành service khi nhu cầu scale/ownership đủ lớn.

### DDD khác gì Clean Architecture trong hệ thống?

DDD trả lời câu hỏi: **model nghiệp vụ là gì, bounded context là gì, rule nằm ở đâu**.

Clean Architecture trả lời câu hỏi: **phụ thuộc giữa các layer đi theo chiều nào, domain có bị phụ thuộc framework/database không**.

Trong DriveMate, hai cách tiếp cận được dùng cùng nhau:

- DDD để thiết kế domain model.
- Clean Architecture để tổ chức dependency: domain ở lõi, infrastructure ở ngoài.

## 11. Kết luận

DriveMate áp dụng DDD để thiết kế hệ thống microservices theo ranh giới nghiệp vụ thay vì tách service theo kỹ thuật hoặc theo bảng dữ liệu. Các service chính tương ứng với các bounded context như Identity, User Profile, Course, Exam, Question, Media, Analytics và Audit.

Trong mỗi bounded context, domain layer chứa aggregate, entity, value object, domain event, exception và repository abstraction. Các business rule quan trọng như gán hạng bằng, kích hoạt khóa học, hoàn thành bài học, nộp bài thi, validate MIME type hoặc validate phone number được đặt trong domain object thay vì controller.

Cách thiết kế này giúp hệ thống có ranh giới rõ ràng, giảm coupling, tăng khả năng test business logic và phù hợp với kiến trúc microservices cloud-native. Trade-off là code phức tạp hơn CRUD thông thường, nhưng đổi lại hệ thống có nền tảng tốt để mở rộng và bảo trì lâu dài.
