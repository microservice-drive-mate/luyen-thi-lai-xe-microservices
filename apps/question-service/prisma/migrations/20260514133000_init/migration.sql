CREATE TYPE "LicenseCategory" AS ENUM ('A1', 'A2', 'B1', 'B2', 'C', 'D', 'E', 'F');

CREATE TYPE "QuestionType" AS ENUM ('THEORY', 'TRAFFIC_SIGN', 'SCENARIO_RELATED');

CREATE TYPE "QuestionDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

CREATE TABLE "question_topics" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_topics_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "questions" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "licenseCategories" "LicenseCategory"[],
    "difficulty" "QuestionDifficulty" NOT NULL,
    "explanation" TEXT NOT NULL,
    "imageUrl" TEXT,
    "media_file_id" TEXT,
    "isCritical" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "topicId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "deletedById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "question_options" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "displayOrder" INTEGER NOT NULL,

    CONSTRAINT "question_options_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "questions_topicId_idx" ON "questions"("topicId");

CREATE INDEX "questions_isActive_isDeleted_idx" ON "questions"("isActive", "isDeleted");

CREATE UNIQUE INDEX "question_options_questionId_displayOrder_key" ON "question_options"("questionId", "displayOrder");

ALTER TABLE "question_topics" ADD CONSTRAINT "question_topics_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "question_topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "questions" ADD CONSTRAINT "questions_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "question_topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "question_options" ADD CONSTRAINT "question_options_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
