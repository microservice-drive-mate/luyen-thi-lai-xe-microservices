CREATE TYPE "AcademicWarningDeliveryStatus" AS ENUM ('PENDING', 'QUEUED', 'PENDING_RETRY', 'FAILED', 'SENT');

ALTER TABLE "academic_warnings"
  ADD COLUMN "deliveryStatus" "AcademicWarningDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "retryAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "nextRetryAt" TIMESTAMP(3),
  ADD COLUMN "notificationId" TEXT,
  ADD COLUMN "lastError" TEXT,
  ADD COLUMN "queuedAt" TIMESTAMP(3),
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "academic_warnings_deliveryStatus_nextRetryAt_idx"
  ON "academic_warnings"("deliveryStatus", "nextRetryAt");
