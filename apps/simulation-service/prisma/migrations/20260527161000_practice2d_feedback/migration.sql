CREATE TYPE "Practice2dSessionStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABANDONED');

ALTER TABLE "maneuver_checkpoints"
  ADD COLUMN "x" DOUBLE PRECISION,
  ADD COLUMN "y" DOUBLE PRECISION,
  ADD COLUMN "visualColor" TEXT;

ALTER TABLE "maneuver_errors"
  ADD COLUMN "pointsDeducted" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "isFatal" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "isGeneral" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "visualColor" TEXT,
  ADD COLUMN "icon" TEXT;

DROP INDEX IF EXISTS "maneuver_errors_licenseCategory_idx";
CREATE INDEX "maneuver_errors_licenseCategory_isGeneral_isActive_idx"
  ON "maneuver_errors"("licenseCategory", "isGeneral", "isActive");

CREATE TABLE "practice2d_sessions" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "licenseCategory" "LicenseCategory" NOT NULL,
  "status" "Practice2dSessionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  "clientCapabilities" JSONB NOT NULL DEFAULT '{}',
  "persistTelemetry" BOOLEAN NOT NULL DEFAULT false,
  "telemetrySnapshot" JSONB,
  "totalEvents" INTEGER NOT NULL DEFAULT 0,
  "errorCount" INTEGER NOT NULL DEFAULT 0,
  "totalPenalty" INTEGER NOT NULL DEFAULT 0,
  "score" INTEGER,
  "summary" JSONB NOT NULL DEFAULT '{}',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "practice2d_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "practice2d_feedback_events" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "telemetryType" TEXT NOT NULL,
  "errorCode" TEXT,
  "severity" TEXT NOT NULL,
  "penalty" INTEGER NOT NULL DEFAULT 0,
  "message" TEXT NOT NULL,
  "hint" TEXT,
  "telemetry" JSONB NOT NULL DEFAULT '{}',
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "practice2d_feedback_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "practice2d_sessions_studentId_status_startedAt_idx"
  ON "practice2d_sessions"("studentId", "status", "startedAt");

CREATE INDEX "practice2d_feedback_events_sessionId_occurredAt_idx"
  ON "practice2d_feedback_events"("sessionId", "occurredAt");

ALTER TABLE "practice2d_feedback_events"
  ADD CONSTRAINT "practice2d_feedback_events_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "practice2d_sessions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
