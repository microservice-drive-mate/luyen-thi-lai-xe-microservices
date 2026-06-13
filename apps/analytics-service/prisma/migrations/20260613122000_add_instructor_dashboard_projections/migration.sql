CREATE TABLE "instructor_course_projections" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "title" TEXT,
  "licenseCategory" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  "capacity" INTEGER,
  "totalLessons" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "instructor_course_projections_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "instructor_course_projections_courseId_key" ON "instructor_course_projections"("courseId");
CREATE INDEX "instructor_course_projections_status_createdAt_idx" ON "instructor_course_projections"("status", "createdAt");

CREATE TABLE "instructor_course_assignment_projections" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "instructorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "instructor_course_assignment_projections_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "instructor_course_assignment_projections_courseId_instructorId_key" ON "instructor_course_assignment_projections"("courseId", "instructorId");
CREATE INDEX "instructor_course_assignment_projections_instructorId_courseId_idx" ON "instructor_course_assignment_projections"("instructorId", "courseId");

CREATE TABLE "instructor_enrollment_projections" (
  "id" TEXT NOT NULL,
  "enrollmentId" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "progress" INTEGER NOT NULL DEFAULT 0,
  "enrolledAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "instructor_enrollment_projections_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "instructor_enrollment_projections_enrollmentId_key" ON "instructor_enrollment_projections"("enrollmentId");
CREATE INDEX "instructor_enrollment_projections_courseId_status_idx" ON "instructor_enrollment_projections"("courseId", "status");
CREATE INDEX "instructor_enrollment_projections_studentId_idx" ON "instructor_enrollment_projections"("studentId");

CREATE TABLE "instructor_schedule_projections" (
  "id" TEXT NOT NULL,
  "scheduleId" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "instructorId" TEXT NOT NULL,
  "dayOfWeek" INTEGER NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "room" TEXT,
  "effectiveFrom" DATE NOT NULL,
  "effectiveTo" DATE,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "instructor_schedule_projections_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "instructor_schedule_projections_scheduleId_key" ON "instructor_schedule_projections"("scheduleId");
CREATE INDEX "instructor_schedule_projections_instructorId_dayOfWeek_isActive_idx" ON "instructor_schedule_projections"("instructorId", "dayOfWeek", "isActive");
CREATE INDEX "instructor_schedule_projections_courseId_isActive_idx" ON "instructor_schedule_projections"("courseId", "isActive");

CREATE TABLE "instructor_exam_session_projections" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "score" INTEGER,
  "isPassed" BOOLEAN NOT NULL,
  "completedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "instructor_exam_session_projections_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "instructor_exam_session_projections_sessionId_key" ON "instructor_exam_session_projections"("sessionId");
CREATE INDEX "instructor_exam_session_projections_studentId_completedAt_idx" ON "instructor_exam_session_projections"("studentId", "completedAt");
CREATE INDEX "instructor_exam_session_projections_isPassed_completedAt_idx" ON "instructor_exam_session_projections"("isPassed", "completedAt");

CREATE TABLE "instructor_topic_attempt_projections" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "topicId" TEXT,
  "topicName" TEXT,
  "isCorrect" BOOLEAN NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "instructor_topic_attempt_projections_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "instructor_topic_attempt_projections_studentId_occurredAt_idx" ON "instructor_topic_attempt_projections"("studentId", "occurredAt");
CREATE INDEX "instructor_topic_attempt_projections_topicId_occurredAt_idx" ON "instructor_topic_attempt_projections"("topicId", "occurredAt");
