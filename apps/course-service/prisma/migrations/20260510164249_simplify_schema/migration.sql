/*
  Warnings:

  - You are about to drop the column `thumbnailUrl` on the `courses` table. All the data in the column will be lost.
  - You are about to drop the column `durationMinutes` on the `lessons` table. All the data in the column will be lost.
  - You are about to drop the column `videoUrl` on the `lessons` table. All the data in the column will be lost.
  - You are about to drop the `lesson_progress` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "lesson_progress" DROP CONSTRAINT "lesson_progress_enrollmentId_fkey";

-- DropForeignKey
ALTER TABLE "lesson_progress" DROP CONSTRAINT "lesson_progress_lessonId_fkey";

-- AlterTable
ALTER TABLE "courses" DROP COLUMN "thumbnailUrl";

-- AlterTable
ALTER TABLE "lessons" DROP COLUMN "durationMinutes",
DROP COLUMN "videoUrl";

-- DropTable
DROP TABLE "lesson_progress";
