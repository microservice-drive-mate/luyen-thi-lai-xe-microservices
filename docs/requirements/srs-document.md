**DriveMate – Software Requirements Specification**

Use Case Description

**2\. Functional Requirements**

**2.1. Use Case Description**

# **UC01: Login**

| Name | Login |
| :---- | :---- |
| **Description** | This use case describes user authentication with account credentials to access DriveMate features. |
| **Actor** | All users (Student, Instructor, Center Manager, Admin) |
| **Trigger** | When the user submits \[email\] and \[password\] on the Login screen. |
| **Pre-condition** | The user is not logged in and the login form is available. |
| **Post-condition** | A valid JWT is issued for successful authentication and the user is redirected to the home page. |

## **Activitiy Diagram**

**![][image1]**

*Figure UC01-A: Activity Diagram – Login*

## **Sequence Diagram**

![][image2]

*Figure UC01-S: Sequence Diagram – Login*

## **Business Rules**

| Activity | BR Code | Description |
| ----- | ----- | ----- |
| **(1)** | **BR01** | Input Validation:  Condition: A login request is submitted.  Action: Validate \[email\] and \[password\] are not empty and \[email\] format is valid.  Result: If invalid, display MSG01; HTTP 400\. |
| **(2)** | **BR02** | Account Lock Check:  Condition: Input is valid.  Action: Load account by \[email\] and check \[isLocked\].  Result: If account is locked, display MSG02; HTTP 401\. |
| **(3)** | **BR03** | Credential Verification:  Condition: Account is active.  Action: Verify hash(\[password\]) against stored credential and update failed-attempt counters.  Result: If invalid credentials, display MSG03; HTTP 401\. |
| **(4)** | **BR04** | Brute-Force Protection:  Condition: Credential verification fails.  Action: Evaluate lock threshold within policy window and set \[isLocked=true\] when threshold is exceeded.  Result: Account lock policy is enforced consistently. |
| **(5)** | **BR05** |  Success Response:  Condition: Credential verification succeeds.  Action: Generate JWT with role claims, reset failed login counter, and return auth payload.  Result: User is authenticated and redirected to home; HTTP 200\. |

# **UC02: Forgot Password**

| Name | Forgot Password |
| :---- | :---- |
| **Description** | This use case describes the process of a user requesting a password reset via email or another authentication method when they forget their password. |
| **Actor** |  All users (Student, Instructor, Center Manager, Admin) |
| **Trigger** | When the user submits a forgot-password request from the Login screen. |
| **Pre-condition** |  The user is not logged in and provides a registered email address. |
| **Post-condition** | A valid reset token is consumed and the account password is updated securely. |

## **Activity Flow**

![][image3]

*Figure UC02-A: Activity Diagram – Forgot Password*

## **Sequence Diagram**

![][image4]

*Figure UC02-S: Sequence Diagram – Forgot Password*

## 

## **Business Rules**

| Activity | BR Code | Description |
| ----- | ----- | ----- |
| **(1)** | **BR01** | Email Validation:  Condition: Forgot-password request is submitted.  Action: Validate \[email\] format and required fields.  Result: If invalid, display MSG04; HTTP 400\. |
| **(2)** | **BR02** | Account Lookup:  Condition: Input is valid.  Action: Query account by \[email\].  Result: If account does not exist, display MSG05; HTTP 404\. |
| **(3)** | **BR03** | Token Generation:  Condition: Account exists.  Action: Generate secure reset token with single-use and expiration policy. Result: Reset token is persisted successfully. |
| **(4)** | **BR04** | Token Validation and Password Policy:  Condition: Reset link is used.  Action: Validate token state (\[exists\], \[unused\], \[notExpired\]) and validate \[newPassword\] policy.  Result: If invalid token or password policy fails, display MSG06 or MSG07; HTTP 400 or 422\. |
| **(5)** | **BR05** | Success Response:  Condition: Token and password are valid.  Action: Hash and update password, mark token as used, and complete reset flow.  Result: Password reset completes successfully; redirect to login; HTTP 200\. |

# **UC03: Create Student Account**

| Name | Create Student Account |
| :---- | :---- |
| **Description** | This use case describes the process of admins or center managers creating a new student account in the system. |
| **Actor** | Admin, Center Manager |
| **Trigger** | When the actor submits the create-account form on User Management. |
| **Pre-condition** | The actor is authenticated with account-management permission. |
| **Post-condition** | A new active account is created and visible in the user list. |

## **Activity Flow**

**![][image5]**

*Figure UC03-A: Activity Diagram – Create Student Account*

## **Sequence Diagram**

**![][image6]**

*Figure UC03-S: Sequence Diagram –  Create Student Account*

## **Business Rules**

| Activity | BR Code | Description |
| ----- | ----- | ----- |
| **(1)** | **BR01** | Input Validation:  Condition: Create-account request is submitted.  Action: Validate \[fullName\], \[email\], \[role\], and \[temporaryPassword\]. Result: If invalid, display MSG08; HTTP 400\. |
| **(2)** | **BR02** | RBAC Validation:  Condition: Input is valid.  Action: Validate actor permission to create target role account.  Result: If unauthorized, display MSG09; HTTP 403\. |
| **(3)** | **BR03** | Uniqueness Check:  Condition: Actor is authorized.  Action: Check duplicate \[email\] in user repository.  Result: If duplicated, display MSG10; HTTP 409\. |
| **(4)** | **BR04** | Account Creation Transaction:  Condition: All checks pass.  Action: Hash temporary password and persist new account with role mapping.  Result: Account is created with active status. |
| **(5)** | **BR05** | Success Response:  Condition: Account is created.  Action: Send credential notification email and return creation payload. Result: Display MSG11; HTTP 201\. |

# **UC04: Update Student Account**

| Name | Update Student Account |
| :---- | :---- |
| **Description** | This use case describes the process of admins or center managers updating an existing student account in the system. |
| **Actor** | Admin, Center Manager |
| **Trigger** | When the actor submits the update-account form on User Management. |
| **Pre-condition** | The actor is authenticated and the student account exists. |
| **Post-condition** | The student account is updated and visible in the user list. |

## **Activity Flow**

![][image7]

*Figure UC04-A: Activity Diagram – Update Student Account*

## **Sequence Diagram**

![][image8]

*Figure UC04-S: Sequence Diagram – Update Student Account*

## **Business Rules**

| Activity | BR Code | Description |
| ----- | ----- | ----- |
| **(1)** | **BR01** | JWT and RBAC Validation:  Condition: Update request is submitted.  Action: Validate JWT and permission to update student accounts.  Result: If unauthorized, display MSG18; HTTP 403\. |
| **(2)** | **BR02** | Student Existence Check:  Condition: \[studentId\] is provided.  Action: Query student by \[studentId\].  Result: If not found, display MSG12; HTTP 404\. |
| **(3)** | **BR03** | Input Validation:  Condition: Student exists.  Action: Validate \[fullName\], \[email\], \[role\] and other metadata.  Result: If invalid, display MSG14; HTTP 400\. |
| **(4)** | **BR04** | Update Transaction:  Condition: All validations pass.  Action: Persist updated student account details.  Result: Account updated successfully. |
| **(5)** | **BR05** | Success Response:  Condition: Transaction committed.  Action: Return updated account payload.  Result: Display MSG16; HTTP 200\. |

# **UC05: Lock Student Account**

| Name | Lock Student Account |
| :---- | :---- |
| **Description** | This use case describes the process of admins or center managers locking an inactive or invalid student account in the system. |
| **Actor** | Admin, Center Manager |
| **Trigger** | When the actor selects a student and clicks \[btnLockAccount\]. |
| **Pre-condition** | The actor is authenticated and the target student account exists and is not already locked. |
| **Post-condition** | The student account status is set to locked and the user cannot log in. |

## **Activity Flow**

![][image9]

*Figure UC05-A: Activity Diagram –  Lock Student Account*

## **Sequence Diagram**

**![][image10]**

*Figure UC05-S: Sequence Diagram – Lock Student Account*

## **Business Rules**

| Activity | BR Code | Description |
| ----- | ----- | ----- |
| **(1)** | **BR01** | JWT and RBAC Validation:  Condition: Lock request is submitted.  Action: Validate JWT and permission to lock accounts.  Result: If unauthorized, display MSG20; HTTP 403\. |
| **(2)** | **BR02** | Student Existence Check:  Condition: \[studentId\] provided.  Action: Query student account.  Result: If not found, display MSG12; HTTP 404\. |
| **(3)** | **BR03** | Status Validation:  Condition: Student exists.  Action: Check current account status.  Result: If already locked or invalid state, display MSG24; HTTP 400\. |
| **(4)** | **BR04** | Lock Transaction:  Condition: Account is active.  Action: Set \[isLocked=true\] and record lock reason/metadata.  Result: Account locked successfully. |
| **(5)** | **BR05** | Success Response:  Condition: Transaction committed.  Action: Return lock confirmation.  Result: Display MSG128; HTTP 200\. |

# **UC06: Assign License Categories To Students**

| Name | Assign License Categories To Students |
| :---- | :---- |
| **Description** | This use case describes assigning or updating a student's license category for the appropriate training program. |
| **Actor** | Admin, Center Manager |
| **Trigger** | When the actor submits a new license category for a selected student. |
| **Pre-condition** | The actor is authenticated with assignment permission and the student account exists. |
| **Post-condition** | The student's license category is updated and audit information is recorded. |

## **Activity Flow**

**![][image11]**

*Figure UC06-A: Activity Diagram – Assign License Categories To Students*

## **Sequence Diagram**

**![][image12]**

*Figure UC06-S: Sequence Diagram – Assign License Categories To Students*

## **Business Rules**

| Activity | BR Code | Description |
| ----- | ----- | ----- |
| **(1)** | **BR01** | JWT and RBAC Validation:  Condition: Assignment update request is submitted.  Action: Validate JWT and permission to update student assignment data. Result: If unauthorized, display MSG19; HTTP 403\. |
| **(2)** | **BR02** |  Student Existence Check:  Condition: \[studentId\] is provided.  Action: The system queries student by \[studentId\].  Result: If not found, display MSG12; HTTP 404\. |
| **(3)** | **BR03** | License Tier Validation:  Condition: Student exists.  Action: The system validates \[licenseTierId\] against active license tiers. Result: If invalid, display MSG15; HTTP 400\. |
| **(4)** | **BR04** | Assignment Update and Audit:  Condition: Permission, student, and tier are valid.  Action: Update \[student.licenseTierId\] and write \[changedBy\], \[oldValue\], \[newValue\], \[changedAt\].  Result: Assignment update is persisted with audit trail. |
| **(5)** | **BR05** | Success Response:  Condition: Update transaction commits successfully.  Action: Return updated student profile payload.  Result: Display MSG17; HTTP 200\. |

# **UC07: View Detailed Course List**

| Name | View Detailed Course List |
| :---- | :---- |
| **Description** | This use case describes the process of a user viewing the detailed list of available courses in the system. |
| **Actor** | All users (Student, Instructor, Center Manager, Admin) |
| **Trigger** |  When the user navigates to the Course List page. |
| **Pre-condition** | The user is logged in. |
| **Post-condition** | The user receives paginated results and can navigate to a selected course detail. |

## **Activity Flow**

**![][image13]**

*Figure UC07-A: Activity Diagram – View Detailed Course List*

## **Sequence Diagram**

**![][image14]**

*Figure UC07-S: Sequence Diagram – View Detailed Course List*

## **Business Rules**

| Activity | BR Code | Description |
| ----- | ----- | ----- |
| **(1)** | **BR01** | JWT Authentication Check:  Condition: Course list request is submitted.  Action: Validate JWT from Authorization header.  Result: If invalid, display MSG21; HTTP 401\. |
| **(2)** | **BR02** | License-Based Filtering:  Condition: Token is valid.  Action: Filter courses by \[user.licenseCategory\].  Result: Only eligible courses are included in the query scope. |
| **(3)** | **BR03** | Cache-Aside Query:  Condition: Default list query is requested.  Action: Resolve cache key \[licenseCategory,page,size\], then fallback to database on cache miss.  Result: Paginated course list is returned; HTTP 200\. |
| **(4)** | **BR04** | Search and Pagination Handling:  Condition: User applies keyword/filter or page navigation.  Action: Execute filtered query and maintain pagination state rules. Result: If no matches, display MSG25; otherwise render result page; HTTP 200\. |
| **(5)** | **BR05** | Course Detail Response:  Condition: User opens a course item.  Action: Query detail by \[courseId\] and return detail payload. Result: If not found, display MSG23; otherwise return detail view; HTTP 200 or 404\. |

# **UC08: Create Course**

| Name | Create Course |
| :---- | :---- |
| **Description** | This use case describes the process of admins or center managers creating a new course in the system. |
| **Actor** | Admin, Center Manager |
| **Trigger** | When the actor clicks \[btnCreateCourse\] and submits the Course Create form. |
| **Pre-condition** | The actor is logged in with Admin or Center Manager role. |
| **Post-condition** | A new course is created and visible in the course list. A creation audit record is stored. |

## **Activity Flow**

**![][image15]**

*Figure UC08-A: Activity Diagram – Create Course*

## **Sequence Diagram**

**![][image16]**

*Figure UC08-S: Sequence Diagram – Create Course*

## **Business Rules**

| Activity | BR Code | Description |
| ----- | ----- | :---- |
| **(1)** | **BR01** | Required Field Validation:  Condition: Create-course request is submitted.  Action: Validate \[courseCode\], \[courseName\], \[licenseCategory\], and \[status\].  Result: If any required field is invalid or missing, display MSG26; HTTP 400\. |
| **(2)** | **BR02** | RBAC Permission Check:  Condition: Input is valid.  Action: Verify actor permission to create courses.  Result: If unauthorized, display MSG27; HTTP 403\. |
| **(3)** | **BR03** | Course Code Uniqueness:  Condition: Actor is authorized.  Action: Check existsByCourseCode(\[courseCode\]). Result: If duplicated, display MSG28; HTTP 409\. |
| **(4)** | **BR04** | Data Integrity Validation:  Condition: Request passes uniqueness check.  Action: Validate \[licenseCategory\] and \[status\] against reference data. Result: If invalid, display MSG29; HTTP 400\. |
| **(5)** | **BR05** | Course Creation Transaction:  Condition: All checks pass.  Action: Persist course record in one transaction with creator metadata and timestamps.  Result: Course saved with \[isDeleted\] \= false. |
| **(6)** | **BR06** | Success Response:  Condition: Transaction committed.  Action: Write audit log \[action=CREATE\_COURSE\] and return created payload.  Result: Display MSG30; HTTP 201\. |

# **UC09:  Update Course**

| Name | Update Course |
| :---- | :---- |
| **Description** | This use case describes the process of admins or center managers updating an existing course in the system. |
| **Actor** | Admin, Center Manager |
| **Trigger** | When the actor selects a course and clicks \[btnUpdateCourse\]. |
| **Pre-condition** | The actor is logged in with Admin or Center Manager role. The course exists and is not deleted. |
| **Post-condition** | Course data is updated and reflected in list/detail pages. Update action is logged in audit trail. |

## **Activity Flow**

![][image17]

*Figure UC09-A: Activity Diagram – Update Course*

## **Sequence Diagram**

**![][image18]**

*Figure UC09-S: Sequence Diagram – Update Course*

## 

## 

## **Business Rules**

| Activity | BR Code | Description |
| ----- | ----- | ----- |
| **(1)** | **BR01** | JWT and RBAC Validation:  Condition: Update request submitted.  Action: Validate token and role permission for course update.  Result: If unauthorized, display MSG31; HTTP 403\. |
| **(2)** | **BR02** | Course Existence Check:  Condition: \[courseId\] provided.  Action: Query course by \[courseId\] and \[isDeleted=false\].  Result: If missing, display MSG23; HTTP 404\. |
| **(3)** | **BR03** | Update Payload Validation:  Condition: Course exists.  Action: Validate mutable fields \[courseName\], \[status\], \[roadmap\], \[licenseCategory\].  Result: If invalid, display MSG29; HTTP 400\. |
| **(4)** | **BR04** | Optimistic Concurrency Check:  Condition: Client sends \[version\] value.  Action: Compare with current record version before update.  Result: If mismatch, display MSG32; HTTP 409\. |
| **(5)** | **BR05** | Persist Update and Audit:  Condition: All validations pass.  Action: Update course record, increment \[version\], and store audit log \[action=UPDATE\_COURSE\].  Result: Updated course persisted. |
| **(6)** | **BR06** | Success Response:  Condition: Update committed successfully.  Action: Return updated payload to client.  Result: Display MSG33; HTTP 200\. |

# **UC10: Delete Course**

| Name | Delete Course |
| :---- | :---- |
| **Description** | This use case describes the process of admins or center managers deleting an existing course from the system. |
| **Actor** | Admin, Center Manager |
| **Trigger** | When the actor clicks \[btnDeleteCourse\] and confirms the deletion dialog. |
| **Pre-condition** | The actor is logged in with Admin or Center Manager role. The target course exists and is not deleted. |
| **Post-condition** | The course is marked as deleted (\[isDeleted=true\]), excluded from active course lists, and deletion is logged for audit. |

## **Activity Flow**

**![][image19]**

*Figure UC10-A: Activity Diagram – Delete Course*

## **Sequence Diagram**

**![][image20]**

*Figure UC10-S: Sequence Diagram – Delete Course*

## **Business Rules**

| Activity | BR Code | Description |
| ----- | ----- | ----- |
| **(1)** | **BR01** | JWT and RBAC Validation:  Condition: Delete request submitted.  Action: Validate token and role permission for course deletion.  Result: If unauthorized, display MSG34; HTTP 403\. |
| **(2)** | **BR02** | Course Existence Check:  Condition: \[courseId\] provided.  Action: Query course by \[courseId\] where \[isDeleted=false\].  Result: If not found, display MSG23; HTTP 404\. |
| **(3)** | **BR03** | Dependency Check:  Condition: Course exists. Action: Validate there are no blocking dependencies (active enrollments, scheduled exams, locked references).  Result: If dependencies exist, display MSG35; HTTP 409\. |
| **(4)** | **BR04** | Soft Delete Transaction:  Condition: No blocking dependencies.  Action: Set \[isDeleted=true\], \[deletedAt\], \[deletedBy\] in one transaction. Result: Course removed from active list queries. |
| **(5)** | **BR05** | Success Response:  Condition: Soft delete committed.  Action: Write audit log \[action=DELETE\_COURSE\] and return success response.  Result: Display MSG36; HTTP 200\. |

# **UC11: Take Theory Exam**

| Name |  Take Theory Exam |
| :---- | :---- |
| **Description** | This use case describes the process of a student taking a theoretical exam on the system. |
| **Actor** | Student |
| **Trigger** | When the student clicks \[btnStartExam\]. |
| **Pre-condition** | The student is logged in and eligible for exam attempt creation. |
| **Post-condition** | A new exam attempt is created with randomized questions, timer settings, and initial session state. |

## **Activity Flow**

**![][image21]**

*Figure UC11-A: Activity Diagram –  Take Theory Exam*

## **Sequence Diagram**

**![][image22]**

*Figure UC11-S: Sequence Diagram – Take Theory Exam*

## **Business Rules**

| Activity | BR Code | Description |
| ----- | ----- | ----- |
| **(1)** | **BR01** | JWT and RBAC Validation:  Condition: Student requests a new attempt.  Action: Validate JWT and \[Take\_Exam\] permission.  Result: If invalid, return MSG38; HTTP 403\. |
| **(2)** | **BR02** | Attempt Payload Validation:  Condition: Request reaches service layer.  Action: Validate \[templateId\], \[licenseTierId\], and policy constraints.  Result: If invalid/conflict, return MSG37; HTTP 400\. |
| **(3)** | **BR03** | Resource Existence Check:  Condition: Payload is valid.  Action: Load student profile, exam template, and contextual configuration. Result: If missing, return MSG39; HTTP 404\. |
| **(4)** | **BR04** | Attempt Creation Transaction:  Condition: Context is available.  Action: Generate randomized question set, create attempt record, and initialize timer/session fields.  Result: Attempt persisted successfully. |
| **(5)** | **BR05** | Answer Confidentiality: Condition: Question set is prepared for response payload. Action: Serialise each question using a restricted DTO that includes only \[questionId\], \[questionText\], \[options\[\]\] (option text only), \[questionOrder\], and \[isFatal\] flag. The \[correctAnswer\] field, answer key index, and any scoring metadata must be explicitly excluded. Verify the response schema in the contract test suite. Result: The \[correctAnswer\] field is never present in the GET /exam/questions response body. Verified by API contract test on every build pipeline run; HTTP 200\. |
| **(5)** | **BR06** | Success Response:  Condition: Transaction committed.  Action: Return attempt identifier and session bootstrap payload.  Result: Return MSG40; HTTP 201\. |

# **UC12:  Manage Exam Session**

| Name |   Manage Exam Session |
| :---- | :---- |
| **Description** | This use case describes how the system supports in-exam features such as bookmarking questions, auto-saving answers, and displaying a countdown timer. |
| **Actor** | Student |
| **Trigger** | When the student performs session actions during an active attempt. |
| **Pre-condition** | The student has an active exam attempt. |
| **Post-condition** | Session state is updated and persisted for continuity and crash recovery. |

## **Activity Flow**

![][image23]

*Figure UC12-A: Activity Diagram –  Manage Exam Session*

## **Sequence Diagram**

**![][image24]**

*Figure UC12-S: Sequence Diagram – Manage Exam Session*

## **Business Rules**

| Activity | BR Code | Description |
| ----- | ----- | ----- |
| **(1)** | **BR01** | JWT and RBAC Validation:  Condition: Session event is submitted.  Action: Validate JWT and \[Manage\_ExamSession\] permission.  Result: If invalid, return MSG42; HTTP 403\. |
| **(2)** | **BR02** | Session Event Validation:  Condition: Request is authorized.  Action: Validate \[attemptId\], \[questionId\], \[eventType\], and attempt status. Result: If invalid/conflict, return MSG41; HTTP 400\. |
| **(3)** | **BR03** | Attempt Context Check:  Condition: Payload is valid.  Action: Load attempt, question context, and timer metadata.  Result: If not found, return MSG43; HTTP 404\. |
| **(4)** | **BR04** | Session Persistence:  Condition: Context exists.  Action: Upsert answer/bookmark and persist autosave checkpoint with remaining time.  Result: Session state updated safely. |
| **(5)** | **BR05** | Success Response:  Condition: Session update persisted.  Action: Return latest session state.  Result: Return MSG44; HTTP 200\. |

# **UC13: Submit Exam**

| Name | Submit Exam |
| :---- | :---- |
| **Description** | This use case describes the process of a student completing and submitting the exam to the system. |
| **Actor** | Student |
| **Trigger** |  When the student clicks \[btnSubmitExam\]. |
| **Pre-condition** | The student has an active attempt and submission is still allowed. |
| **Post-condition** | Attempt is finalized, answers are locked, and grading is queued. |

## **Activity Flow**

![][image25]

*Figure UC13-A: Activity Diagram – Submit Exam*

## **Sequence Diagram**

![][image26]

*Figure UC13-S: Sequence Diagram – Submit Exam*

## **Business Rules**

| Activity | BR Code | Description |
| ----- | ----- | ----- |
| **(1)** | **BR01** | JWT and RBAC Validation:  Condition: Submit request is received.  Action: Validate JWT and \[Submit\_Exam\] permission.  Result: If invalid, return MSG45; HTTP 403\. |
| **(2)** | **BR02** | Submission State Validation:  Condition: Request is authorized.  Action: Validate attempt status and anti-double-submit policy.  Result: If invalid/conflict, return MSG46; HTTP 400\. |
| **(3)** | **BR03** | Attempt Existence Check:  Condition: State is valid.  Action: Load active attempt and answer snapshot.  Result: If missing, return MSG47; HTTP 404\. |
| **(4)** | **BR04** | Finalization Transaction:  Condition: Attempt exists.  Action: Lock all answers, finalize attempt status, and queue grading workflow.  Result: Attempt submitted successfully. |
| **(5)** | **BR05** | Success Response:  Condition: Finalization committed.  Action: Return submission confirmation.  Result: Return MSG48; HTTP 200\. |

# **UC14: Grade Exam**

| Name |  Grade Exam |
| :---- | :---- |
| **Description** | This use case describes the system automatically grading the exam based on the answer key and fatal question rules. |
| **Actor** | System |
| **Trigger** | When submission finalization triggers grading. |
| **Pre-condition** | Attempt is submitted and eligible for grading. |
| **Post-condition** |  Grading result is persisted with score, pass/fail, and fatal-question evaluation. |

## **Activity Flow**

**![][image27]**

*Figure UC14-A: Activity Diagram –  Grade Exam*

## **Sequence Diagram**

**![][image28]**

*Figure UC14-S: Sequence Diagram –  Grade Exam*

## **Business Rules**

| Activity | BR Code | Description |
| ----- | ----- | ----- |
| **(1)** | **BR01** | JWT and RBAC Validation:  Condition: Grading endpoint/worker executes.  Action: Validate JWT and \[Grade\_Exam\] permission.  Result: If invalid, return MSG49; HTTP 403\. |
| **(2)** | **BR02** | Grading Input Validation:  Condition: Authorization passes.  Action: Validate attempt status and grading prerequisites.  Result: If invalid/conflict, return MSG50; HTTP 400\. |
| **(3)** | **BR03** | Resource Existence Check:  Condition: Input is valid.  Action: Load attempt answers, answer key, and fatal-question definitions. Result: If missing, return MSG51; HTTP 404\. |
| **(4)** | **BR04** | Grading Logic Execution:  Condition: Resources loaded.  Action: Compute score, evaluate pass threshold, and apply fatal-question override rules.  Result: Final grade generated. |
| **(5)** | **BR05** | Success Response:  Condition: Grade persisted.  Action: Return grading completion payload.  Result: Return MSG52; HTTP 200\. |

# **UC15: View Exam Results**

| Name | View Exam Results |
| :---- | :---- |
| **Description** | This use case describes the process of a student viewing their results after completing an exam. |
| **Actor** | Student |
| **Trigger** | When the student opens exam result detail. |
| **Pre-condition** | Exam attempt has been graded. |
| **Post-condition** | Student sees score, pass/fail status, and answer-level feedback. |

## **Activity Flow**

![][image29]

*Figure UC15-A: Activity Diagram – View Exam Results*

## **Sequence Diagram**

![][image30]

*Figure UC15-S: Sequence Diagram – View Exam Results*

## **Business Rules**

| Activity | BR Code | Description |
| ----- | ----- | ----- |
| **(1)** | **BR01** | JWT and RBAC Validation:  Condition: Result request is received.  Action: Validate JWT and \[View\_ExamResults\] permission.  Result: If invalid, return MSG54; HTTP 403\. |
| **(2)** | **BR02** | Query Validation:  Condition: Authorization passes.  Action: Validate ownership scope and query params.  Result: If invalid/conflict, return MSG53; HTTP 400/. |
| **(3)** | **BR03** | Result Existence Check:  Condition: Query is valid.  Action: Load graded attempt result.  Result: If not found, return MSG55; HTTP 404\.  |
| **(4)** | **BR04** | Result Projection:  Condition: Result exists.  Action: Build response with score, fatal-question info, and per-question feedback.  Result: Result payload prepared. |
| **(5)** | **BR05** | Success Response:  Condition: Projection ready.  Action: Return result detail to client.  Result: Return MSG56; HTTP 200\. |

# **UC16: Review Exams**

| Name | Review Exams |
| :---- | :---- |
| **Description** | This use case describes the process of a student reviewing the exams they have previously taken. |
| **Actor** | Student |
| **Trigger** | When the student opens the exam review module. |
| **Pre-condition** | Student has at least one historical exam attempt. |
| **Post-condition** | Student receives a list of attempts and can drill down into selected review detail. |

## **Activity Flow**

![][image31]

*Figure UC16-A: Activity Diagram – Review Exams*

## **Sequence Diagram**

![][image32]

*Figure UC16-S: Sequence Diagram – Review Exams*

## **Business Rules**

| Activity | BR Code | Description |
| ----- | ----- | ----- |
| **(1)** | **BR01** | JWT and RBAC Validation:  Condition: Review list request is submitted.  Action: Validate JWT and \[Review\_Exams\] permission.  Result: If invalid, display MSG58; HTTP 403\. |
| **(2)** | **BR02** | Filter Validation:  Condition: Authorization passes.  Action: Validate pagination, sorting, and filter options.  Result: If invalid/conflict, display MSG57; HTTP 400\. |
| **(3)** | **BR03** | Review Data Check:  Condition: Query is valid.  Action: Load exam review history and metadata.  Result: If not found, display MSG59; HTTP 404\. |
| **(4)** | **BR04** | Review Projection:  Condition: History exists. Action: Build review timeline with attempt status and score summary. Result: Review list ready. |
| **(5)** | **BR05** | Success Response:  Condition: Projection prepared.  Action: Return review listing payload.  Result: Display MSG60; HTTP 200\. |

# **UC17: Search Question Bank**

| Name | Search Question Bank |
| :---- | :---- |
| **Description** | This use case describes the process of admins or center managers searching and filtering questions in the system. |
| **Actor** | Admin, Center Manager |
| **Trigger** | When actor enters keyword/filter on Question Bank page. |
| **Pre-condition** | Actor is logged in with question-bank access rights. |
| **Post-condition** | Filtered question list is returned with pagination. |

## **Activity Flow**

![][image33]

*Figure UC17-A: Activity Diagram – Search Question Bank*

## **Sequence Diagram**

**![][image34]**

*Figure UC17-S: Sequence Diagram – Search Question Bank*

## **Business Rules**

| Activity | BR Code | Description |
| ----- | ----- | ----- |
| **(1)** | **BR01** | JWT and RBAC Validation:  Condition: Search request is submitted.  Action: Validate JWT and \[Search\_QuestionBank\] permission.  Result: If invalid, display MSG62; HTTP 403\. |
| **(2)** | **BR02** | Query Validation:  Condition: Authorization passes.  Action: Validate \[keyword\], \[licenseTierId\], \[status\], \[page\], \[size\].  Result: If invalid/conflict, display MSG61; HTTP 400\. |
| **(3)** | **BR03** | Search Scope Check:  Condition: Query is valid.  Action: Load searchable scope from question repository.  Result: If scope/resource missing, display MSG63; HTTP 404\. |
| **(4)** | **BR04** | Indexed Search Execution:  Condition: Scope exists.  Action: Execute indexed query with ranking and pagination.  Result: Filtered list generated. |
| **(5)** | **BR05** | Success Response:  Condition: Search result generated.  Action: Return paginated data to client.  Result: Display MSG64; HTTP 200\. |

# **UC18: Create Question**

| Name |  Create Question |
| :---- | :---- |
| **Description** | This use case describes the process of admins or center managers creating a new question in the question bank. |
| **Actor** | Admin, Center Manager |
| **Trigger** | When actor submits \[btnCreateQuestion\] form. |
| **Pre-condition** | Actor is logged in with question creation permission. |
| **Post-condition** | New question is persisted and appears in the question list. |

## **Activity Flow**

![][image35]

*Figure UC18-A: Activity Diagram –  Create Question*

## **Sequence Diagram**

![][image36]

*Figure UC18-S: Sequence Diagram – Create Question*

## **Business Rules**

| Activity | BR Code | Description |
| ----- | ----- | ----- |
| **(1)** | **BR01** | JWT and RBAC Validation:  Condition: Create request is submitted.  Action: Validate JWT and \[Create\_Question\] permission.  Result: If invalid, display MSG66; HTTP 403\. |
| **(2)** | **BR02** | Payload Validation:  Condition: Authorization passes.  Action: Validate question text, options, correct answer, and metadata. Result: If invalid/conflict, display MSG65; HTTP 400\. |
| **(3)** | **BR03** | Duplication Context Check:  Condition: Payload valid.  Action: Load question signature context for duplicate detection.  Result: If resource context not found, display MSG67; HTTP 404\. |
| **(4)** | **BR04** | Create Transaction:  Condition: Context exists and constraints pass.  Action: Persist new question and update related cache/index.  Result: Question created successfully. |
| **(5)** | **BR05** | Success Response:  Condition: Transaction committed.  Action: Return created question payload.  Result: Display MSG68; HTTP 201\. |

# **UC19: Update Question**

| Name | Update Question |
| :---- | :---- |
| **Description** | This use case describes the process of admins or center managers updating an existing question in the question bank. |
| **Actor** | Admin, Center Manager |
| **Trigger** | When actor submits \[btnUpdateQuestion\] form. |
| **Pre-condition** | Actor is logged in and target question exists. |
| **Post-condition** | Question content is updated with audit/version history. |

**Activity Flow**

**![][image37]**

### *Figure UC19-A: Activity Diagram – Update Question*

**Sequence Diagram**

![][image38]

*Figure UC19-S: Sequence Diagram – Update Question*

**Business Rules**

| Activity | BR Code | Description |
| ----- | ----- | ----- |
| **(1)** | **BR01** | JWT and RBAC Validation:  Condition: Update request is submitted.  Action: Validate JWT and \[Update\_Question\] permission.  Result: If invalid, display MSG70; HTTP 403\. |
| **(2)** | **BR02** | Payload and Version Validation: Condition: Update request is authorised. Action: (a) Validate all mutable fields \[questionText\], \[options\[\]\], \[correctAnswer\], \[isFatal\], \[topicId\], \[licenseTierId\] for correct format and required values.(b) Validate optimistic concurrency: compare the client-supplied \[version\] field against the current \[version\] stored in the database for this question record. Result: If any field is invalid → display MSG69; HTTP 400\. If \[version\] field is missing → display MSG70; HTTP 400\. If version does not match (concurrent modification detected) → display MSG71; HTTP 409 Conflict. The client must reload the latest version before retrying. |
| **(3)** | **BR03** | Question Existence Check:  Condition: Payload valid.  Action: Load target question and dependency context.  Result: If missing, display MSG71; HTTP 404\. |
| **(4)** | **BR04** | Update Transaction:  Condition: Resource exists.  Action: Update question, keep version snapshot, and refresh index/cache. Result: Question updated successfully. |
| **(5)** | **BR05** | Success Response:  Condition: Update committed.  Action: Return updated question payload.  Result: Display MSG74; HTTP 200\. |

# **UC20: Delete Question**

| Name | Delete Question |
| :---- | :---- |
| **Description** | This use case describes the process of admins or center managers deleting a question from the question bank. |
| **Actor** | Admin, Center Manager |
| **Trigger** | When actor confirms \[btnDeleteQuestion\]. |
| **Pre-condition** | Actor is logged in and question delete policy is satisfied. |
| **Post-condition** |  Question is soft-deleted and no longer shown in active lists. |

**Activity Flow**

![][image39]

### *Figure UC20-A: Activity Diagram – Delete Question*

**Sequence Diagram**

![][image40]

*Figure UC20-S: Sequence Diagram –  Delete Question*

**Business Rules**

| Activity | BR Code | Description |
| ----- | ----- | ----- |
| **(1)** | **BR01** |  JWT and RBAC Validation:  Condition: Delete request is received.  Action: Validate JWT and \[Delete\_Question\] permission.  Result: If invalid, display MSG75; HTTP 403\. |
| **(2)** | **BR02** | Delete Rule Validation:  Condition: Authorization passes. Action: Validate safe-delete policy and conflict constraints.  Result: If invalid, display MSG75; HTTP 400\. |
| **(3)** | **BR03** | Existence Check:  Condition: Request valid.  Action: Load target question and usage references.  Result: If not found, display MSG73; HTTP 404\. |
| **(4)** | **BR04** | Soft Delete Transaction:  Condition: Resource exists and constraints pass.  Action: Mark \[isDeleted=true\], invalidate cache/index, and preserve history. Result: Question removed from active query set. |
| **(5)** | **BR05** | Success Response:  Condition: Deletion committed.  Action: Return deletion result payload.  Result: Display MSG77; HTTP 200\. |

# **UC21: Create Exam Template**

| Name | Create Exam Template |
| :---- | :---- |
| **Description** | This use case describes the process of an admin creating a new exam template with structure, number of questions, question types, and related rules. |
| **Actor** | Admin |
| **Trigger** | When actor submits \[btnCreateExamTemplate\]. |
| **Pre-condition** | Actor is logged in with exam-config management permission. |
| **Post-condition** | New template is created and available for exam paper generation. |

**Activity Flow**

![][image41]

### *Figure UC21-A: Activity Diagram – Create Exam Template*

**Sequence Diagram**

![][image42]

*Figure UC21-S: Sequence Diagram – Create Exam Template*

**Business Rules**

| Activity | BR Code | Description |
| ----- | ----- | ----- |
| **(1)** | **BR01** | JWT and RBAC Validation:  Condition: Create-template request submitted.  Action: Validate JWT and \[Manage\_ExamConfig\] permission.  Result: If invalid, display MSG78; HTTP 403\. |
| **(2)** | **BR02** | Template Validation:  Condition: Authorization passes.  Action: Validate structure, section quotas, pass rules, and metadata.  Result: If invalid/conflict, display MSG78; HTTP 400\. |
| **(3)** | **BR03** | Context Existence Check:  Condition: Payload valid.  Action: Load license tier and related constraints.  Result: If missing, display MSG80; HTTP 404\. |
| **(4)** | **BR04** | Create Transaction:  Condition: Context exists.  Action: Persist template and default grading settings in one transaction. Result: Template created successfully. |
| **(5)** | **BR05** | Success Response:  Condition: Transaction committed.  Action: Return created template payload.  Result: Display MSG81; HTTP 201\. |

# **UC22: Update Exam Template**

| Name | Update Exam Template |
| :---- | :---- |
| **Description** | This use case describes the process of an admin updating an existing exam template configuration. |
| **Actor** | Admin |
| **Trigger** | When actor submits \[btnUpdateExamTemplate\]. |
| **Pre-condition** | Actor is logged in and template exists. |
| **Post-condition** | Template is updated and becomes active for subsequent generation flows. |

**Activity Flow**

![][image43]

### *Figure U22-A: Activity Diagram – Update Exam Template*

**Sequence Diagram**

![][image44]

*Figure UC22-S: Sequence Diagram – Update Exam Template*

**Business Rules**

| Activity | BR Code | Description |
| ----- | ----- | ----- |
| **(1)** | **BR01** | JWT and RBAC Validation:  Condition: Update-template request submitted.  Action: Validate JWT and \[Manage\_ExamConfig\] permission.  Result: If invalid, display MSG79; HTTP 403\. |
| **(2)** | **BR02** | Update Validation: Condition: Update request is authorised. Action: (a) Validate mutable fields \[templateName\], \[questionCount\], \[timeLimit\], \[passingScore\], \[fatalQuestionIds\[\]\], \[sectionQuotas\[\]\], \[licenseTierId\] for correct format and required values. (b) Validate optimistic concurrency: compare client-supplied \[version\] against the current \[version\] in the database for this template record. Result: If any field is invalid → display MSG82; HTTP 400\. If version mismatch is detected → display MSG83; HTTP 409 Conflict. |
| **(3)** | **BR03** | Template Existence Check:  Condition: Payload valid.  Action: Load target template and lock state.  Result: If not found, display MSG84; HTTP 404\. |
| **(4)** | **BR04** | Update Transaction:  Condition: Template exists.  Action: Persist changes and recalculate constraint impacts.  Result: Template updated successfully. |
| **(5)** | **BR05** | Success Response:  Condition: Transaction committed.  Action: Return updated payload.  Result: Display MSG85; HTTP 200\. |

# **UC23: Delete Exam Template**

| Name | Delete Exam Template |
| :---- | :---- |
| **Description** | This use case describes the process of an admin deleting an unused exam template from the system. |
| **Actor** | Admin |
| **Trigger** | When actor confirms \[btnDeleteExamTemplate\]. |
| **Pre-condition** |  Actor is logged in, template exists, and template is not blocked by in-use constraints. |
| **Post-condition** | Template is soft-deleted and removed from active configuration views. |

**Activity Flow**

![][image45]

### *Figure UC23-A: Activity Diagram – Delete Exam Template*

**Sequence Diagram**

![][image46]

*Figure UC23-S: Sequence Diagram – Delete Exam Template*

**Business Rules**

| Activity | BR Code | Description |
| ----- | ----- | ----- |
| **(1)** | **BR01** | JWT and RBAC Validation:  Condition: Delete-template request submitted.  Action: Validate JWT and \[Manage\_ExamConfig\] permission.  Result: If invalid, display MSG79; HTTP 403\. |
| **(2)** | **BR02** | Safe-Delete Validation:  Condition: Authorization passes.  Action: Validate in-use dependency rules and delete constraints.  Result: If invalid, display MSG86; HTTP 400\. |
| **(3)** | **BR03** | Template Existence Check:  Condition: Request valid.  Action: Load target template and usage context.  Result: If not found, display MSG84; HTTP 404\. |
| **(4)** | **BR04** | Delete Transaction:  Condition: Constraints pass.  Action: Soft-delete template and clear cache links.  Result: Template removed from active set. |
| **(5)** | **BR05** | Success Response:  Condition: Deletion committed.  Action: Return operation result payload.  Result: Display MSG87; HTTP 200\. |

# **UC24: Auto-generate Exam Papers**

| Name | Auto-generate Exam Papers |
| :---- | :---- |
| **Description** | This use case describes the system automatically generating an exam based on the established configuration. |
| **Actor** | System, Admin |
| **Trigger** | When generation job is triggered manually or by schedule. |
| **Pre-condition** | Valid template and sufficient question pool are available. |
| **Post-condition** | Exam papers are generated and persisted for upcoming attempts. |

**Activity Flow**

![][image47]

### *Figure UC24-A: Activity Diagram – Auto-generate Exam Papers*

**Sequence Diagram**

![][image48]

### *Figure UC24-S: Sequence Diagram – Auto-generate Exam Papers*

**Business Rules**

| Activity | BR Code | Description |
| ----- | ----- | ----- |
| **(1)** | **BR01** | JWT and RBAC Validation:  Condition: Generation request is received.  Action: Validate JWT and \[Generate\_ExamPapers\] permission.  Result: If invalid, display MSG90; HTTP 403\. |
| **(2)** | **BR02** | Generation Validation:  Condition: Authorization passes.  Action: Validate template id, amount, quota balance, and exclusion options. Result: If invalid, display MSG89; HTTP 400\. |
| **(3)** | **BR03** | Resource Existence Check:  Condition: Input valid.  Action: Load template, question pool, and exclusion set.  Result: If not found, display MSG91; HTTP 404\. |
| **(4)** | **BR04** | Generation Transaction: Condition: Resources loaded.  Action: Build randomized papers satisfying all constraints and persist output.  Result: Papers generated successfully. |
| **(5)** | **BR05** | Success Response:  Condition: Persistence committed.  Action: Return generation summary payload.  Result: Display MSG92; HTTP 201\. |

# **UC25: View Student List**

| Name | View Student List |
| :---- | :---- |
| **Description** | This use case describes the process of an instructor or admin viewing the list of students in the system. |
| **Actor** | Instructor, Admin |
| **Trigger** | When actor opens student roster module. |
| **Pre-condition** | Actor is logged in and has roster-view scope. |
| **Post-condition** | Student list is displayed with summary indicators and navigation to detail. |

**Activity Flow**

![][image49]

### *Figure UC25-A: Activity Diagram –View Student List*

**Sequence Diagram**

![][image50]

### *Figure UC25-S: Sequence Diagram – View Student List*

**Business Rules**

| Activity | BR Code | Description |
| ----- | ----- | ----- |
| **(1)** | **BR01** | JWT and RBAC Validation:  Condition: Student list request submitted.  Action: Validate JWT and \[View\_StudentList\] permission.  Result: If invalid, display MSG94; HTTP 403\. |
| **(2)** | **BR02** | Query Validation:  Condition: Authorization passes.  Action: Validate class filter, keyword, and pagination fields.  Result: If invalid, display MSG93; HTTP 400\. |
| **(3)** | **BR03** | Scope Existence Check:  Condition: Query valid.  Action: Load assignment scope and roster resource.  Result: If missing, display MSG95; HTTP 404\. |
| **(4)** | **BR04** | Roster Projection:  Condition: Scope exists.  Action: Build list with status badges and ordering.  Result: List payload prepared. |
| **(5)** | **BR05** | Success Response:  Condition: Projection ready.  Action: Return roster response.  Result: Display MSG96; HTTP 200\. |

# **UC26: Track Learning Progress**

| Name | Track Learning Progress |
| :---- | :---- |
| **Description** | This use case describes the process of an instructor or admin tracking the learning progress and exam results of students. |
| **Actor** | Instructor, Admin |
| **Trigger** | When actor opens progress dashboard for one or more students. |
| **Pre-condition** |  Actor is logged in with learning-progress access rights. |
| **Post-condition** | Progress indicators are displayed to support instructional interventions. |

**Activity Flow**

![][image51]

### *Figure UC26-A: Activity Diagram – Track Learning Progress*

**Sequence Diagram**

![][image52]

### *Figure UC26-S: Sequence Diagram –  Track Learning Progress*

**Business Rules**

| Activity | BR Code | Description |
| ----- | ----- | ----- |
| **(1)** | **BR01** | JWT and RBAC Validation: Condition: Progress request submitted. Action: Validate JWT and \[Track\_LearningProgress\] permission. Result: If invalid, display MSG98; HTTP 403\. |
| **(2)** | **BR02** | Scope Validation: Condition: Authorization passes. Action: Validate period filters and target scope. Result: If invalid/conflict, display MSG97; HTTP 400\. |
| **(3)** | **BR03** | Metric Source Check: Condition: Input valid. Action: Load student metrics and recent attempt history. Result: If missing, display MSG99; HTTP 404\. |
| **(4)** | **BR04** |  Trend Computation: Condition: Metrics available. Action: Calculate trendline, completion ratio, and risk score. Result: Progress dashboard dataset prepared. |
| **(5)** | **BR05** | Success Response: Condition: Computation completed. Action: Return dashboard payload. Result: Display MSG100; HTTP 200\. |

# **UC27: View Exam History**

| Name | View Exam History |
| :---- | :---- |
| **Description** | This use case describes the process of an instructor or admin reviewing a student's exam history, including information such as exam time, exam type, score, and pass/fail result. |
| **Actor** | Instructor, Admin |
| **Trigger** | When actor opens exam history page for a student. |
| **Pre-condition** | Actor is logged in and student reference is valid. |
| **Post-condition** |  Exam timeline is displayed and can be used for deeper review. |

**Activity Flow**

![][image53]

### *Figure UC27-A: Activity Diagram –View Exam History*

**Sequence Diagram**

![][image54]

### *Figure UC27-S: Sequence Diagram – View Exam History*

**Business Rules**

| Activity | BR Code | Description |
| ----- | ----- | ----- |
| **(1)** | **BR01** | JWT and RBAC Validation:  Condition: Exam-history request submitted.  Action: Validate JWT and \[View\_ExamHistory\] permission.  Result: If invalid, display MSG102; HTTP 403\. |
| **(2)** | **BR02** | Query Validation:  Condition: Authorization passes.  Action: Validate period, exam-type, and pagination filters.  Result: If invalid, display MSG101; HTTP 400\. |
| **(3)** | **BR03** | History Existence Check:  Condition: Query valid.  Action: Load attempt history source for student.  Result: If not found, display MSG103; HTTP 404\. |
| **(4)** | **BR04** | Timeline Projection:  Condition: Source exists.  Action: Build chronological exam history with score/pass-fail fields.  Result: Timeline payload prepared. |
| **(5)** | **BR05** | Success Response:  Condition: Projection complete.  Action: Return timeline to client.  Result: Display MSG104; HTTP 200\. |

# **UC28: Reset Learning Progress**

| Name | Reset Learning Progress  |
| :---- | :---- |
| **Description** | This use case describes the process of a student resetting their learning progress when necessary. |
| **Actor** | Student |
| **Trigger** | When the student confirms \[btnResetProgress\]. |
| **Pre-condition** | Student is logged in and reset policy conditions are met. |
| **Post-condition** | Progress markers are reset and learning flow restarts from baseline. |

**Activity Flow**

![][image55]

### *Figure UC28-A: Activity Diagram – Reset Learning Progress*

**Sequence Diagram**

![][image56]

### *Figure UC28-S: Sequence Diagram – Reset Learning Progress*

**Business Rules**

| Activity | BR Code | Description |
| ----- | ----- | ----- |
| **(1)** | **BR01** | JWT and RBAC Validation:  Condition: Reset request submitted.  Action: Validate JWT and \[Reset\_LearningProgress\] permission.  Result: If invalid, display MSG106; HTTP 403\. |
| **(2)** | **BR02** | Reset Policy Validation:  Condition: Authorization passes.  Action: Validate cooldown, frequency, and allowed scope.  Result: If invalid/conflict, display MSG105; HTTP 400\. |
| **(3)** | **BR03** | Resource Existence Check:  Condition: Policy valid.  Action: Load student progress scope to reset.  Result: If not found, display MSG107; HTTP 404\. |
| **(4)** | **BR04** | Reset Transaction:  Condition: Resource exists.  Action: Reset progress markers, review queues, and dependent counters by policy.  Result: Baseline state restored. |
| **(5)** | **BR05** | Success Response:  Condition: Reset committed.  Action: Return reset confirmation payload.  Result: Display MSG108; HTTP 200\. |

# **UC29: Send Academic Warnings**

| Name | Send Academic Warnings |
| :---- | :---- |
| **Description** | This use case describes the process of an instructor or admin sending warnings to students when the system detects slow learning progress, low exam scores, or incomplete learning requirements. |
| **Actor** | Instructor, Admin |
| **Trigger** | When actor submits warning form for selected students. |
| **Pre-condition** | Actor is logged in with warning-dispatch permission. |
| **Post-condition** | Warning records are created and notifications are dispatched. |

**Activity Flow**

![][image57]

### *Figure UC29-A: Activity Diagram –Send Academic Warnings*

### 

**Sequence Diagram**

![][image58]

### *Figure UC29-S: Sequence Diagram – Send Academic Warnings*

**Business Rules**

| Activity | BR Code | Description |
| ----- | ----- | ----- |
| **(1)** | **BR01** | JWT and RBAC Validation:  Condition: Warning request submitted.  Action: Validate JWT and \[Send\_AcademicWarnings\] permission.  Result: If invalid, display MSG110; HTTP 403\. |
| **(2)** | **BR02** | Warning Payload Validation:  Condition: Authorization passes.  Action: Validate recipients, reason codes, and delivery channel settings. Result: If invalid/conflict, display MSG109; HTTP 400\. |
| **(3)** | **BR03** | Target Existence Check:  Condition: Payload valid.  Action: Load target students and warning context.  Result: If not found, display MSG111; HTTP 404\. |
| **(4)** | **BR04** | Dispatch Transaction: Condition: Warning targets exist and payload is valid. Action: (a) Persist all warning records to the database with status \= \[PENDING\] in a single transaction. (b) Attempt to enqueue notification jobs to the message queue (RabbitMQ / Kafka) for async Push Notification / Email delivery. (c) If enqueue succeeds: update warning record status to \[QUEUED\]. (d) If enqueue fails (queue unavailable, network error): retain warning records with status \= \[PENDING\_RETRY\]; a background retry scheduler re-attempts enqueue within the configured retry window (default: 3 attempts, 5-minute intervals). The instructor UI is never blocked by queue availability. Result: Warning records are always persisted regardless of queue state. Notification delivery is eventually consistent.  |
| **(5)** | **BR05** | Success Response:  Condition: Dispatch persisted.  Action: Return delivery summary payload.  Result: Display MSG112; HTTP 200\. |

# **UC30: View Maneuver Checkpoint Details**

| Name | View Maneuver Checkpoint Details |
| :---- | :---- |
| **Description** | Allows a Student to navigate driving maneuvers via a hybrid Map/List view and drill down into step-by-step instructions and penalty criteria for a selected checkpoint. |
| **Actor** | Student |
| **Trigger** | Student clicks the "Sa Hình Chi Tiết" button on the Training dashboard. |
| **Pre-condition** | Student is authenticated. The system has identified the specific license class. |
| **Post-condition** | Detailed maneuver screen is rendered with color-coded steps and error classifications. |

## 

**Activity Flow**

**![][image59]**

### *Figure UC30-A: Activity Diagram – View Maneuver Checkpoint Details*

**Sequence Diagram**

![][image60]

### *Figure UC30-S: Sequence Diagram –  View Maneuver Checkpoint Details*

**Business Rules**

| Activity | BR Code | Description |
| ----- | ----- | ----- |
| **(1)** | **BR01** | JWT and RBAC Validation:   Condition: Checkpoint view request submitted.   Action: Validate JWT and query for active checkpoints.   Result: If unauthorized, display MSG134; HTTP 401\. |
| **(2)** | **BR02** | License Class Context:   Condition: Request is authorized.   Action: Filter checkpoints by user's identified license category.   Result: If no checkpoints exist for that class, display MSG135; HTTP 404\. |
| **(3)** | **BR03** | Checkpoint List and Map Rendering:   Condition: Filtered checkpoint data available.   Action: Build dual presentation (map pins \+ scrollable list) from checkpoint coordinates and names.   Result: Hybrid UI rendered with navigation capability. |
| **(4)** | **BR04** | Checkpoint Selection Query:   Condition: Student selects checkpoint (pin or list item).   Action: Load detailed instructions and penalty rules for selected checkpointId.   Result: Checkpoint detail payload prepared. |
| **(5)** | **BR05** | Categorized Penalty Display:   Condition: Detail payload ready.   Action: Categorize and render penalties (Green=Correct, Yellow=Deduction, Red=Fatal) with visual distinction.   Result: Display MSG136; HTTP 200\. |

### 

# **UC31: View General Maneuver Errors**

| Name | View General Maneuver Errors |
| :---- | :---- |
| **Description** | Provides a comprehensive list of universal driving errors applying to the entire exam, categorized by penalty severity. |
| **Actor** | Student |
| **Trigger** | Student clicks "Các Lỗi Sa Hình Chung" on the Training dashboard. |
| **Pre-condition** | System is operational. The student is on the main Training screen. |
| **Post-condition** | System is operational. The student is on the main Training screen. |

**Activity flow**

![][image61]

### *Figure UC31-A: Activity Diagram – View General Maneuver Errors*

**Sequence Diagram**

**![][image62]**

### *Figure UC31-S: Sequence Diagram –  View General Maneuver Errors*

**Business Rules**

| Activity | BR Code | Description |
| ----- | ----- | ----- |
| **(1)** | **BR01** | JWT and RBAC Validation:   Condition: General maneuver error list request submitted.   Action: Validate JWT and \[View\_ManeuverErrors\] permission.   Result: If unauthorized, display MSG137; HTTP 401\. |
| **(2)** | **BR02** | Error Reference Query:   Condition: Authorization passes.   Action: Query ErrorReference table for active universal driving errors (isGeneral=true, status=ACTIVE).   Result: If no errors found, display MSG138; HTTP 404\. |
| **(3)** | **BR03** | Cache-Aside Retrieval:   Condition: Query executed.   Action: Check Redis cache for error list; if cache miss, fetch from database and populate cache.   Result: Error dataset retrieved with performance optimization. |
| **(4)** | **BR04** | Error Categorization and Sorting:   Condition: Error dataset available.   Action: Separate into Yellow (Deduction: pointsDeducted \> 0, isFatal=false) and Red (Fatal: isFatal=true) categories; sort alphabetically within each.   Result: Categorized error list prepared. |
| **(5)** | **BR05** | Success Response:   Condition: Categorization complete.   Action: Return error list with visual styling metadata (colors and icons).   Result: Display MSG139; HTTP 200\. |

### 

# **UC32: Review Frequently Missed Questions**

| Name | Review Frequently Missed Questions |
| :---- | :---- |
| **Description** | This use case describes the process of a student taking review tests generated by the system based on questions or question types they frequently answered incorrectly in previous exams. |
| **Actor** | Student |
| **Trigger** | When student requests missed-question review session. |
| **Pre-condition** | Student is logged in and has exam history with wrong-answer records. |
| **Post-condition** | Personalized review set is generated and returned for study. |

**Activity Flow**

![][image63]

### *Figure UC32-A: Activity Diagram –Review Frequently Missed Questions*

**Sequence Diagram**

![][image64]

### *Figure UC32-S: Sequence Diagram – Review Frequently Missed Questions*

**Business Rules**

| Activity | BR Code | Description |
| ----- | ----- | ----- |
| **(1)** | **BR01** | JWT and RBAC Validation:  Condition: Review-set request submitted.  Action: Validate JWT and \[Review\_MissedQuestions\] permission.  Result: If invalid, display MSG122; HTTP 403\. |
| **(2)** | **BR02** | Request Validation:  Condition: Authorization passes.  Action: Validate review period, size, and mode options.  Result: If invalid/conflict, display MSG121; HTTP 400\. |
| **(3)** | **BR03** | Data Existence Check:  Condition: Input valid.  Action: Load wrong-answer history and SRS prioritization source.  Result: If not found, display MSG123; HTTP 404\. |
| **(4)** | **BR04** | Review-Set Generation:  Condition: Data available.  Action: Build prioritized question set based on frequency and SRS score. Result: Review set prepared. |
| **(5)** | **BR05** | Success Response:  Condition: Set generation complete.  Action: Return personalized review payload.  Result: Display MSG124; HTTP 200\. |

# **UC33: Logout**

| Name | Logout |
| :---- | :---- |
| **Description** | This use case describes the process of a user terminating their authenticated session, invalidating the server-side JWT, and clearing all client-side session state. |
| **Actor** | All users (Student, Instructor, Center Manager, Admin) |
| **Trigger** | When the user clicks the \[btnLogout\] button or when a session-management event triggers a forced logout. |
| **Pre-condition** | The user is authenticated and holds a valid JWT. |
| **Post-condition** | The JWT is blacklisted server-side. The client-side token is cleared. Any subsequent API call using the invalidated token returns 401 Unauthorized. |

**Activity Flow**

**![][image65]**

### *Figure UC33-A: Activity Diagram – Logout*

**Sequence Diagram**

**![][image66]**

### *Figure UC33-S: Sequence Diagram – Logout*

**Business Rules**

| Activity | BR Code | Description |
| ----- | ----- | ----- |
| **(1)** | **BR01** | JWT Validation: Condition: Logout request is submitted. Action: Extract and validate JWT from the Authorization header or cookie. Result: If JWT is missing or malformed, display MSG129; HTTP 401\. |
| **(2)** | **BR02** | Token Blacklisting: Condition: JWT is valid. Action: Add the current JWT to the Redis token blacklist with TTL equal to the token's remaining lifespan (TTL \= exp − now). Operation must be atomic. Result: Token is immediately invalid for all subsequent requests across all service instances. |
| **(3)** | **BR03** | Client-Side Cleanup Instruction: Condition: Token has been blacklisted. Action: Return a response instructing the client to delete the token from LocalStorage / Cookie / in-memory store. Result: Client-side session state is cleared; no stale token remains on the device. |
| **(4)** | **BR04** | Post-Logout Verification: Condition: Client attempts any API call with the invalidated token. Action: API Gateway checks token against Redis blacklist on every request (O(1) lookup). Result: Old token is rejected; HTTP 401 Unauthorized is returned for every call using the blacklisted token. |
| **(5)** | **BR05** | Success Response: Condition: Token has been blacklisted and client cleanup instruction has been issued. Action: Return logout confirmation payload. Result: Display MSG130; HTTP 200\. |

**UC34: View my learning progress**

| Name | Logout |
| :---- | :---- |
| **Description** | This use case describes the process of a student viewing their own learning progress, including theory completion percentage, practice exam pass rate over time, and weak topic analysis. Data is served from a pre-aggregated cache to ensure fast response. |
| **Actor** | Student |
| **Trigger** | When the student navigates to the Learning Progress screen on the mobile app. |
| **Pre-condition** | The student is authenticated and has at least one recorded learning activity (exam attempt or topic studied). |
| **Post-condition** | The student receives their personalised progress dashboard data including completion statistics, pass-rate trend, and weak topic indicators. |

**Activity Flow**

![][image67]

### *Figure UC34-A: Activity Diagram – View my learning progress*

**Sequence Diagram**

![][image68]

### *Figure UC34-S: Sequence Diagram – View my learning progress*

**Business Rules**

| Activity | BR Code | Description |
| ----- | ----- | ----- |
| **(1)** | **BR01** | JWT and RBAC Validation: Condition: Progress view request is submitted. Action: Validate JWT and \[View\_MyProgress\] permission. Confirm actor role is Student. Result: If unauthorized or role mismatch, display MSG131; HTTP 403\. |
| **(2)** | **BR02** | Strict Scope Enforcement: Condition: Authorization passes. Action: Extract \[studentId\] exclusively from the authenticated JWT claims — never from the request URL or body. Reject any request where the requested scope does not match the authenticated identity. Result: If scope mismatch is detected, display MSG132; HTTP 403\. Cross-student data access is impossible by design. |
| **(3)** | **BR03** | Cache-First Data Resolution: Condition: Scope is validated. Action: Attempt to resolve progress data from Redis cache using key \[progress:{studentId}:{licenseTierId}\]. On cache miss, fall back to the periodically updated Aggregation table. Do not run real-time aggregation queries on the raw log table. Result: If no data exists (new account with no activity), return an empty progress payload; HTTP 200\. |
| **(4)** | **BR04** | Progress Payload Projection: Condition: Data source is resolved. Action: Build response payload containing: (a) overall completion percentage \[completionPct\], (b) number of questions studied \[studiedCount\], (c) total exam attempts \[attemptCount\], (d) pass rate \[passRate\], (e) pass-rate trend for last 30 days, (f) top 5 weak topics ranked by incorrect-answer frequency. Result: Payload assembled; response time \< 200 ms. (Ref: ASR-PERF-04) |
| **(5)** | **BR05** | Success Response: Condition: Payload is ready. Action: Return progress dashboard payload to client. Result: Display MSG133; HTTP 200\. |

|  MSG Code |  UC |  Message |  HTTP Status |
| :---- | :---- | :---- | :---- |
|  MSG01 |  UC01 |  Please enter email and password. |  400 |
|  MSG02 |  UC01 |  Your account is locked. Please contact support. |  401 |
|  MSG03 |  UC01 |  Invalid email or password. |  401 |
|  MSG04 |  UC02 |  Please enter a valid email address. |  400 |
|  MSG05 |  UC02 |  No account found for this email. |  404 |
|  MSG06 |  UC02 |  Reset link is invalid or expired. |  400 |
|  MSG07 |  UC02 |  Password does not meet complexity requirements. |  422 |
|  MSG08 |  UC03 |  Please complete all required fields. |  400 |
|  MSG09 |  UC03 |  You do not have permission to create this account. |  403 |
|  MSG10 |  UC03 |  Email already exists. |  409 |
|  MSG11 |  UC03 |  Student account created successfully. |  201 |
|  MSG12 |  UC04 |  Student account not found. |  404 |
|  MSG14 |  UC04 |  Invalid student account data. |  400 |
|  MSG15 |  UC06 |  Invalid license category. |  400 |
|  MSG16 |  UC04 |  Student account updated successfully. |  200 |
|  MSG17 |  UC06 |  License category assigned successfully. |  200 |
|  MSG18 |  UC04 |  You do not have permission to update student accounts. |  403 |
|  MSG19 |  UC06 |  You do not have permission to assign license categories. |  403 |
|  MSG20 |  UC05 |  You do not have permission to lock student accounts. |  403 |
|  MSG21 |  UC07 |  Your session has expired. Please log in again. |  401 |
|  MSG23 |  UC07 |  Course not found. |  404 |
|  MSG24 |  UC05 |  Invalid student account status for locking. |  400 |
|  MSG25 |  UC07 |  No courses match your criteria. |  200 |
|  MSG128 |  UC05 |  Student account locked successfully. |  200 |
|  MSG26 |  UC08 |  Please complete all required course fields. |  400 |
|  MSG27 |  UC08 |  You do not have permission to create courses. |  403 |
|  MSG28 |  UC08 |  Course code already exists. |  409 |
|  MSG29 |  UC08 |  Invalid course data. |  400 |
|  MSG30 |  UC08 |  Course created successfully. |  201 |
|  MSG31 |  UC09 |  You do not have permission to update courses. |  403 |
|  MSG32 |  UC09 |  Course was modified by another user. Please reload and try again. |  409 |
|  MSG33 |  UC09 |  Course updated successfully. |  200 |
|  MSG34 |  UC10 |  You do not have permission to delete courses. |  403 |
|  MSG35 |  UC10 |  Course cannot be deleted because it is currently in use. |  409 |
|  MSG36 |  UC10 |  Course deleted successfully. |  200 |
|  MSG37 |  UC11 |  Invalid exam start request. |  400 |
|  MSG38 |  UC11 |  You are not authorized to start an exam. |  403 |
|  MSG39 |  UC11 |  Exam resource not found. |  404 |
|  MSG40 |  UC11 |  Exam attempt created successfully. |  201 |
|  MSG41 |  UC12 |  Invalid exam session request. |  400 |
|  MSG42 |  UC12 |  You are not authorized to manage exam session. |  403 |
|  MSG43 |  UC12 |  Exam session resource not found. |  404 |
|  MSG44 |  UC12 |  Exam session updated successfully. |  200 |
|  MSG45 |  UC13 |  You are not authorized to submit exam. |  403 |
|  MSG46 |  UC13 |  Invalid exam submission request. |  400 |
|  MSG47 |  UC13 |  Exam attempt not found. |  404 |
|  MSG48 |  UC13 |  Exam submitted successfully. |  200 |
|  MSG49 |  UC14 |  You are not authorized to grade exam. |  403 |
|  MSG50 |  UC14 |  Invalid grading request. |  400 |
|  MSG51 |  UC14 |  Grading resource not found. |  404 |
|  MSG52 |  UC14 |  Exam graded successfully. |  200 |
|  MSG53 |  UC15 |  Invalid exam result query. |  400 |
|  MSG54 |  UC15 |  You are not authorized to view exam results. |  403 |
|  MSG55 |  UC15 |  Exam result not found. |  404 |
|  MSG56 |  UC15 |  Exam result loaded successfully. |  200 |
|  MSG57 |  UC16 |  Invalid exam review query. |  400 |
|  MSG58 |  UC16 |  You are not authorized to review exams. |  403 |
|  MSG59 |  UC16 |  Exam review resource not found. |  404 |
|  MSG60 |  UC16 |  Exam review data loaded successfully. |  200 |
|  MSG61 |  UC17 |  Invalid question search request. |  400 |
|  MSG62 |  UC17 |  You are not authorized to search question bank. |  403 |
|  MSG63 |  UC17 |  Question resource not found. |  404 |
|  MSG64 |  UC17 |  Question search completed successfully. |  200 |
|  MSG65 |  UC18 |  Invalid create-question request. |  400 |
|  MSG66 |  UC18 |  You are not authorized to create question. |  403 |
|  MSG67 |  UC18 |  Question context not found. |  404 |
|  MSG68 |  UC18 |  Question created successfully. |  201 |
|  MSG69 |  UC19 |  Invalid update-question request. |  400 |
|  MSG70 |  UC19 |  Version field is missing. |  400 |
|  MSG71 |  UC19 |  This question was modified by another user. Please reload and try again. |  409 |
|  MSG72 |  UC19 |  You are not authorized to update question. |  403 |
|  MSG73 |  UC19 |  Question not found. |  404 |
|  MSG74 |  UC19 |  Question updated successfully. |  200 |
|  MSG75 |  UC20 |  Invalid delete-question request. |  400 |
|  MSG76 |  UC20 |  You are not authorized to delete question. |  403 |
|  MSG77 |  UC20 |  Question deleted successfully. |  200 |
|  MSG78 |  UC21 |  Invalid create-template request. |  400 |
|  MSG79 |  UC21 |  You are not authorized to manage exam templates. |  403 |
|  MSG80 |  UC21 |  Exam template context not found. |  404 |
|  MSG81 |  UC21 |  Exam template created successfully. |  201 |
|  MSG82 |  UC22 |  Invalid update-template request. |  400 |
|  MSG83 |  UC22 |  This exam template was modified by another user. Please reload and try again. |  409 |
|  MSG84 |  UC22 |  Exam template not found. |  404 |
|  MSG85 |  UC22 |  Exam template updated successfully. |  200 |
|  MSG86 |  UC23 |  Invalid delete-template request. |  400 |
|  MSG87 |  UC23 |  Exam template deleted successfully. |  200 |
|  MSG88 |  UC24 |  Invalid exam-paper generation request. |  400 |
|  MSG89 |  UC24 |  You are not authorized to generate exam papers. |  403 |
|  MSG90 |  UC24 |  Generation resource not found. |  404 |
|  MSG91 |  UC24 |  Exam papers generated successfully. |  201 |
|  MSG92 |  UC25 |  Invalid student-list query. |  400 |
|  MSG93 |  UC25 |  You are not authorized to view student list. |  403 |
|  MSG94 |  UC25 |  Student list resource not found. |  404 |
|  MSG95 |  UC25 |  Student list loaded successfully. |  200 |
|  MSG96 |  UC26 |  Invalid learning-progress query. |  400 |
|  MSG97 |  UC26 |  You are not authorized to track learning progress. |  403 |
|  MSG98 |  UC26 |  Learning-progress resource not found. |  404 |
|  MSG99 |  UC26 |  Learning-progress data loaded successfully. |  200 |
|  MSG100 |  UC27 |  Invalid exam-history query. |  400 |
|  MSG101 |  UC27 |  You are not authorized to view exam history. |  403 |
|  MSG102 |  UC27 |  Exam-history resource not found. |  404 |
|  MSG103 |  UC27 |  Exam history loaded successfully. |  200 |
|  MSG104 |  UC28 |  Invalid reset-learning-progress request. |  400 |
|  MSG105 |  UC28 |  You are not authorized to reset learning progress. |  403 |
|  MSG106 |  UC28 |  Progress resource not found. |  404 |
|  MSG107 |  UC28 |  Learning progress reset successfully. |  200 |
|  MSG108 |  UC29 |  Invalid academic-warning request. |  400 |
|  MSG109 |  UC29 |  You are not authorized to send academic warnings. |  403 |
|  MSG110 |  UC29 |  Warning target not found. |  404 |
|  MSG111 |  UC29 |  Academic warnings sent successfully. |  200 |
|  MSG112 |  UC30 |  Invalid track-simulation request. |  400 |
|  MSG113 |  UC30 |  You are not authorized to run track simulation. |  403 |
|  MSG114 |  UC30 |  Simulation resource not found. |  404 |
|  MSG115 |  UC30 |  Track simulation completed successfully. |  200 |
|  MSG116 |  UC32 |  Invalid driving-scenario request. |  400 |
|  MSG117 |  UC32 |  You are not authorized to run driving scenarios. |  403 |
|  MSG118 |  UC32 |  Driving-scenario resource not found. |  404 |
|  MSG119 |  UC32 |  Driving scenario completed successfully. |  200 |
|  MSG120 |  UC33 |  Invalid missed-question review request. |  400 |
|  MSG121 |  UC33 |  You are not authorized to review missed questions. |  403 |
|  MSG122 |  UC33 |  Missed-question resource not found. |  404 |
|  MSG123 |  UC33 |  Missed-question review set generated successfully. |  201 |
|  MSG129 |  UC33 |  Authentication token is missing or invalid. |  401 |
|  MSG130 |  UC33 |  You have been logged out successfully. |  200 |
|  MSG131 |  UC34 |  You are not authorized to view this progress data. |  403 |
|  MSG132 |  UC34 |  Access denied: you may only view your own progress. |  403 |
|  MSG133 |  UC34 |  Learning progress loaded successfully. |  200 |
|  MSG134 |  UC30 |  You are not authorized to view checkpoint details. |  401 |
|  MSG135 |  UC30 |  No checkpoints exist for this license category. |  404 |
|  MSG136 |  UC30  |  Checkpoint details loaded successfully. |  200 |
|  MSG137 |  UC31 |  You are not authorized to view maneuver errors. |  401 |
|  MSG138 |  UC31 |  No maneuver errors found. |  404 |
|  MSG139 |  UC31 |  Maneuver errors loaded successfully. |  200 |




































































