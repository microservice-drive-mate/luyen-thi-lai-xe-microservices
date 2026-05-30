ALTER TABLE "courses"
  ADD COLUMN "courseCode" TEXT,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "deletedBy" TEXT;

CREATE UNIQUE INDEX "courses_courseCode_key" ON "courses"("courseCode");
CREATE INDEX "courses_isDeleted_status_createdAt_idx"
  ON "courses"("isDeleted", "status", "createdAt");
