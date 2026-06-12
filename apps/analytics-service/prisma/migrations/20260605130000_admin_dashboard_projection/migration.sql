CREATE TABLE "dashboard_user_projections" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "fullName" TEXT,
  "email" TEXT,
  "role" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "licenseTier" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "dashboard_user_projections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "dashboard_course_projections" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "title" TEXT,
  "licenseCategory" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "dashboard_course_projections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "dashboard_exam_session_projections" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "licenseCategory" TEXT NOT NULL,
  "score" INTEGER,
  "isPassed" BOOLEAN NOT NULL,
  "completedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "dashboard_exam_session_projections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "dashboard_recent_activity_projections" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "actorId" TEXT,
  "actorName" TEXT,
  "resourceType" TEXT,
  "resourceId" TEXT,
  "licenseCategory" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "dashboard_recent_activity_projections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "dashboard_processed_events" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "eventName" TEXT NOT NULL,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "dashboard_processed_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "dashboard_user_projections_userId_key" ON "dashboard_user_projections"("userId");
CREATE INDEX "dashboard_user_projections_role_createdAt_idx" ON "dashboard_user_projections"("role", "createdAt");
CREATE INDEX "dashboard_user_projections_licenseTier_createdAt_idx" ON "dashboard_user_projections"("licenseTier", "createdAt");

CREATE UNIQUE INDEX "dashboard_course_projections_courseId_key" ON "dashboard_course_projections"("courseId");
CREATE INDEX "dashboard_course_projections_status_createdAt_idx" ON "dashboard_course_projections"("status", "createdAt");
CREATE INDEX "dashboard_course_projections_licenseCategory_createdAt_idx" ON "dashboard_course_projections"("licenseCategory", "createdAt");

CREATE UNIQUE INDEX "dashboard_exam_session_projections_sessionId_key" ON "dashboard_exam_session_projections"("sessionId");
CREATE INDEX "dashboard_exam_session_projections_completedAt_idx" ON "dashboard_exam_session_projections"("completedAt");
CREATE INDEX "dashboard_exam_session_projections_licenseCategory_completedAt_idx" ON "dashboard_exam_session_projections"("licenseCategory", "completedAt");
CREATE INDEX "dashboard_exam_session_projections_isPassed_completedAt_idx" ON "dashboard_exam_session_projections"("isPassed", "completedAt");

CREATE UNIQUE INDEX "dashboard_recent_activity_projections_eventId_key" ON "dashboard_recent_activity_projections"("eventId");
CREATE INDEX "dashboard_recent_activity_projections_occurredAt_idx" ON "dashboard_recent_activity_projections"("occurredAt");
CREATE INDEX "dashboard_recent_activity_projections_type_occurredAt_idx" ON "dashboard_recent_activity_projections"("type", "occurredAt");

CREATE UNIQUE INDEX "dashboard_processed_events_eventId_key" ON "dashboard_processed_events"("eventId");
CREATE INDEX "dashboard_processed_events_eventId_idx" ON "dashboard_processed_events"("eventId");
