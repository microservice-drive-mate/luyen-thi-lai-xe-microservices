CREATE TABLE "notification_preferences" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
  "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
  "pushEnabled" BOOLEAN NOT NULL DEFAULT false,
  "smsEnabled" BOOLEAN NOT NULL DEFAULT false,
  "studyReminderEnabled" BOOLEAN NOT NULL DEFAULT true,
  "examReminderEnabled" BOOLEAN NOT NULL DEFAULT true,
  "courseUpdateEnabled" BOOLEAN NOT NULL DEFAULT true,
  "academicWarningEnabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notification_preferences_userId_key" ON "notification_preferences"("userId");
