CREATE TABLE "course_schedules" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "instructorId" TEXT NOT NULL,
  "dayOfWeek" INTEGER NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "room" TEXT,
  "effectiveFrom" DATE NOT NULL,
  "effectiveTo" DATE,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "course_schedules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "course_schedules_courseId_isActive_idx" ON "course_schedules"("courseId", "isActive");
CREATE INDEX "course_schedules_instructorId_dayOfWeek_isActive_idx" ON "course_schedules"("instructorId", "dayOfWeek", "isActive");

ALTER TABLE "course_schedules"
ADD CONSTRAINT "course_schedules_courseId_fkey"
FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
