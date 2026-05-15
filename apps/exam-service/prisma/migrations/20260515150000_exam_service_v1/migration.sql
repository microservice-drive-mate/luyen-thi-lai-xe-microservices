CREATE TYPE "LicenseCategory" AS ENUM ('A1', 'A2', 'B1', 'B2', 'C', 'D', 'E', 'F');

CREATE TYPE "ExamSessionStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'TIMED_OUT', 'CANCELLED');

CREATE TABLE "exam_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "licenseCategory" "LicenseCategory" NOT NULL,
    "totalQuestions" INTEGER NOT NULL,
    "passingScore" INTEGER NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "exam_sessions" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "status" "ExamSessionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "score" INTEGER,
    "isPassed" BOOLEAN,
    "failedByCritical" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "exam_session_questions" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "questionContent" TEXT NOT NULL,
    "optionsSnapshot" JSONB NOT NULL,
    "correctOptionId" TEXT NOT NULL,
    "isCritical" BOOLEAN NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "selectedOptionId" TEXT,
    "isCorrect" BOOLEAN,
    "isBookmarked" BOOLEAN NOT NULL DEFAULT false,
    "answeredAt" TIMESTAMP(3),

    CONSTRAINT "exam_session_questions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "exam_templates_licenseCategory_isActive_isDeleted_idx" ON "exam_templates"("licenseCategory", "isActive", "isDeleted");

CREATE INDEX "exam_sessions_studentId_status_idx" ON "exam_sessions"("studentId", "status");

CREATE INDEX "exam_sessions_templateId_idx" ON "exam_sessions"("templateId");

CREATE UNIQUE INDEX "exam_session_questions_sessionId_questionId_key" ON "exam_session_questions"("sessionId", "questionId");

CREATE UNIQUE INDEX "exam_session_questions_sessionId_displayOrder_key" ON "exam_session_questions"("sessionId", "displayOrder");

ALTER TABLE "exam_sessions" ADD CONSTRAINT "exam_sessions_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "exam_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "exam_session_questions" ADD CONSTRAINT "exam_session_questions_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "exam_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
