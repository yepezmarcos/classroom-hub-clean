/*
  Warnings:

  - You are about to drop the column `createdAt` on the `Classroom` table. All the data in the column will be lost.
  - You are about to drop the column `grade` on the `Classroom` table. All the data in the column will be lost.
  - You are about to drop the column `subject` on the `Classroom` table. All the data in the column will be lost.
  - You are about to drop the column `tenantId` on the `Classroom` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Enrollment` table. All the data in the column will be lost.
  - You are about to drop the column `tenantId` on the `Enrollment` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[code]` on the table `Classroom` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[studentId,guardianId]` on the table `StudentGuardian` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `Note` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Classroom" DROP CONSTRAINT IF EXISTS "Classroom_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "Enrollment" DROP CONSTRAINT IF EXISTS "Enrollment_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "Guardian" DROP CONSTRAINT IF EXISTS "Guardian_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "Note" DROP CONSTRAINT IF EXISTS "Note_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "Student" DROP CONSTRAINT IF EXISTS "Student_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "StudentGuardian" DROP CONSTRAINT IF EXISTS "StudentGuardian_tenantId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "Enrollment_tenantId_classroomId_studentId_key";

-- DropIndex
DROP INDEX IF EXISTS "Enrollment_tenantId_studentId_idx";

-- DropIndex
DROP INDEX IF EXISTS "Note_tenantId_studentId_createdAt_idx";

-- DropIndex
DROP INDEX IF EXISTS "StudentGuardian_tenantId_studentId_guardianId_key";

-- AlterTable
ALTER TABLE "Classroom" DROP COLUMN IF EXISTS "createdAt",
DROP COLUMN IF EXISTS "grade",
DROP COLUMN IF EXISTS "subject",
DROP COLUMN IF EXISTS "tenantId",
ADD COLUMN     "code" TEXT;

-- AlterTable
ALTER TABLE "CommentTemplate" ADD COLUMN     "topic" TEXT;

-- AlterTable
ALTER TABLE "Enrollment" DROP COLUMN IF EXISTS "createdAt",
DROP COLUMN IF EXISTS "tenantId";

-- AlterTable
ALTER TABLE "Guardian" ADD COLUMN     "relationship" TEXT,
ALTER COLUMN "tenantId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Note" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "tenantId" DROP NOT NULL,
ALTER COLUMN "tags" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Student" ALTER COLUMN "tenantId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "StudentGuardian" ALTER COLUMN "tenantId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "settings" JSONB;

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "jurisdiction" TEXT,
    "board" TEXT,
    "terms" INTEGER,
    "subjects" TEXT[],
    "gradeBands" TEXT[],
    "lsCategories" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Classroom_code_key" ON "Classroom"("code");

-- CreateIndex
CREATE INDEX "CommentTemplate_createdAt_idx" ON "CommentTemplate"("createdAt");

-- CreateIndex
CREATE INDEX "Note_studentId_idx" ON "Note"("studentId");

-- CreateIndex
CREATE INDEX "Note_createdAt_idx" ON "Note"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "StudentGuardian_studentId_guardianId_key" ON "StudentGuardian"("studentId", "guardianId");
