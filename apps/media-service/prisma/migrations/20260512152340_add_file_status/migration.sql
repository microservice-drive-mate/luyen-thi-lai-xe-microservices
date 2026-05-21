-- CreateEnum
CREATE TYPE "FileStatus" AS ENUM ('UNLINKED', 'LINKED');

-- AlterTable
ALTER TABLE "file_objects" ADD COLUMN     "status" "FileStatus" NOT NULL DEFAULT 'UNLINKED';
