CREATE TYPE "UserDocumentType" AS ENUM (
  'ID_CARD_FRONT',
  'ID_CARD_BACK',
  'PORTRAIT',
  'HEALTH_CERTIFICATE',
  'OTHER'
);

CREATE TYPE "UserDocumentStatus" AS ENUM (
  'PENDING',
  'VERIFIED',
  'REJECTED'
);

CREATE TABLE "user_documents" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "UserDocumentType" NOT NULL,
  "mediaFileId" TEXT NOT NULL,
  "title" TEXT,
  "status" "UserDocumentStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "user_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "user_documents_userId_type_idx" ON "user_documents"("userId", "type");
CREATE INDEX "user_documents_mediaFileId_idx" ON "user_documents"("mediaFileId");

ALTER TABLE "user_documents"
  ADD CONSTRAINT "user_documents_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user_profiles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
