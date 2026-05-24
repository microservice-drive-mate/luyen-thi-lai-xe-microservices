CREATE TYPE "OutboxMessageStatus" AS ENUM ('PENDING', 'PUBLISHED', 'FAILED');

CREATE TABLE "outbox_messages" (
    "id" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxMessageStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "outbox_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "outbox_messages_status_nextAttemptAt_idx" ON "outbox_messages"("status", "nextAttemptAt");
