CREATE TABLE "question_reports" (
  "id" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "message" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "question_reports_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "question_reports_questionId_status_idx" ON "question_reports"("questionId", "status");
CREATE INDEX "question_reports_userId_createdAt_idx" ON "question_reports"("userId", "createdAt");

ALTER TABLE "question_reports"
  ADD CONSTRAINT "question_reports_questionId_fkey"
  FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
