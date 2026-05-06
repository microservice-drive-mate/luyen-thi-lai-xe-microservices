-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'CENTER_MANAGER', 'INSTRUCTOR', 'STUDENT');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "LicenseTier" AS ENUM ('A1', 'A2', 'B1', 'B2', 'C', 'D', 'E', 'F');

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "avatarUrl" TEXT,
    "gender" "Gender",
    "address" TEXT,
    "role" "Role" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_details" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "licenseTier" "LicenseTier",
    "enrolledAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "student_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "license_assignment_audits" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "oldLicenseTier" "LicenseTier",
    "newLicenseTier" "LicenseTier" NOT NULL,
    "changedById" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "license_assignment_audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_email_key" ON "user_profiles"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_phoneNumber_key" ON "user_profiles"("phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "student_details_studentId_key" ON "student_details"("studentId");

-- AddForeignKey
ALTER TABLE "student_details" ADD CONSTRAINT "student_details_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "user_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "license_assignment_audits" ADD CONSTRAINT "license_assignment_audits_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "user_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
