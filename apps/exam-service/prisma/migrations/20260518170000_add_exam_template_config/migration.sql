ALTER TABLE "exam_templates"
ADD COLUMN "description" TEXT,
ADD COLUMN "criticalQuestions" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "maxCriticalMistakes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "shuffleQuestions" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "topicDistribution" JSONB NOT NULL DEFAULT '[]';

ALTER TABLE "exam_sessions"
ADD COLUMN "criticalMistakes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "maxCriticalMistakes" INTEGER NOT NULL DEFAULT 0;
