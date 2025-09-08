/*
  Warnings:

  - You are about to drop the column `createdAt` on the `Classroom` table. All the data in the column will be lost.
  - You are about to drop the column `tenantId` on the `Classroom` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Enrollment` table. All the data in the column will be lost.
  - You are about to drop the column `outOf` on the `Grade` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Settings` table. All the data in the column will be lost.
  - You are about to drop the column `tenantId` on the `Settings` table. All the data in the column will be lost.
  - You are about to drop the `Report` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `updatedAt` to the `CommentTemplate` table without a default value. This is not possible if the table is not empty.
  - Made the column `score` on table `Grade` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `role` to the `Membership` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Note` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lsCategories` to the `Settings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."StandardType" AS ENUM ('GENERAL', 'SUBJECT');

-- DropForeignKey
ALTER TABLE "public"."Assignment" DROP CONSTRAINT "Assignment_classroomId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Assignment" DROP CONSTRAINT "Assignment_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Classroom" DROP CONSTRAINT "Classroom_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "public"."CommentTemplate" DROP CONSTRAINT "CommentTemplate_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Enrollment" DROP CONSTRAINT "Enrollment_classroomId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Enrollment" DROP CONSTRAINT "Enrollment_studentId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Grade" DROP CONSTRAINT "Grade_assignmentId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Grade" DROP CONSTRAINT "Grade_studentId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Grade" DROP CONSTRAINT "Grade_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Guardian" DROP CONSTRAINT "Guardian_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Membership" DROP CONSTRAINT "Membership_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Membership" DROP CONSTRAINT "Membership_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Note" DROP CONSTRAINT "Note_studentId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Report" DROP CONSTRAINT "Report_classroomId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Report" DROP CONSTRAINT "Report_studentId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Settings" DROP CONSTRAINT "Settings_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Student" DROP CONSTRAINT "Student_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "public"."StudentGuardian" DROP CONSTRAINT "StudentGuardian_guardianId_fkey";

-- DropForeignKey
ALTER TABLE "public"."StudentGuardian" DROP CONSTRAINT "StudentGuardian_studentId_fkey";

-- DropIndex
DROP INDEX "public"."Assignment_category_idx";

-- DropIndex
DROP INDEX "public"."Assignment_classroomId_idx";

-- DropIndex
DROP INDEX "public"."Assignment_classroomId_name_key";

-- DropIndex
DROP INDEX "public"."Assignment_createdAt_idx";

-- DropIndex
DROP INDEX "public"."Assignment_term_idx";

-- DropIndex
DROP INDEX "public"."Enrollment_studentId_classroomId_key";

-- DropIndex
DROP INDEX "public"."Grade_assignmentId_idx";

-- DropIndex
DROP INDEX "public"."Grade_studentId_idx";

-- DropIndex
DROP INDEX "public"."Guardian_phone_idx";

-- DropIndex
DROP INDEX "public"."Settings_tenantId_key";

-- DropIndex
DROP INDEX "public"."Student_gender_idx";

-- DropIndex
DROP INDEX "public"."Student_grade_idx";

-- DropIndex
DROP INDEX "public"."Student_iep_ell_medical_idx";

-- AlterTable
ALTER TABLE "public"."Assignment" ADD COLUMN     "max" DOUBLE PRECISION NOT NULL DEFAULT 100;

-- AlterTable
ALTER TABLE "public"."Classroom" DROP COLUMN "createdAt",
DROP COLUMN "tenantId",
ALTER COLUMN "code" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."CommentTemplate" ADD COLUMN     "gradeBand" TEXT,
ADD COLUMN     "level" TEXT,
ADD COLUMN     "topic" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "public"."Enrollment" DROP COLUMN "createdAt";

-- AlterTable
ALTER TABLE "public"."Grade" DROP COLUMN "outOf",
ADD COLUMN     "feedback" TEXT,
ALTER COLUMN "score" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."Guardian" ALTER COLUMN "tenantId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."Membership" ADD COLUMN     "role" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."Note" ADD COLUMN     "tenantId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "public"."Settings" DROP COLUMN "createdAt",
DROP COLUMN "tenantId",
ADD COLUMN     "lsCategories" JSONB NOT NULL,
ALTER COLUMN "id" SET DEFAULT 'singleton',
ALTER COLUMN "terms" DROP DEFAULT,
ALTER COLUMN "gradeBands" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."Student" ALTER COLUMN "tenantId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."StudentGuardian" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- DropTable
DROP TABLE "public"."Report";

-- CreateTable
CREATE TABLE "public"."CommentTemplateSkill" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "commentTemplateId" TEXT NOT NULL,
    "skill" TEXT NOT NULL,
    "level" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommentTemplateSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StandardSet" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "public"."StandardType" NOT NULL DEFAULT 'SUBJECT',
    "jurisdiction" TEXT NOT NULL,
    "subject" TEXT,
    "gradeBand" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "framework" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StandardSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StandardSkill" (
    "id" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "code" TEXT,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StandardSkill_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cts_ctid_idx" ON "public"."CommentTemplateSkill"("commentTemplateId");

-- CreateIndex
CREATE INDEX "cts_skill_idx" ON "public"."CommentTemplateSkill"("skill");

-- CreateIndex
CREATE INDEX "StandardSet_tenantId_type_jurisdiction_subject_gradeBand_idx" ON "public"."StandardSet"("tenantId", "type", "jurisdiction", "subject", "gradeBand");

-- AddForeignKey
ALTER TABLE "public"."Membership" ADD CONSTRAINT "Membership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StudentGuardian" ADD CONSTRAINT "StudentGuardian_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "public"."Guardian"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StudentGuardian" ADD CONSTRAINT "StudentGuardian_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Assignment" ADD CONSTRAINT "Assignment_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "public"."Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Assignment" ADD CONSTRAINT "Assignment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Grade" ADD CONSTRAINT "Grade_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "public"."Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Grade" ADD CONSTRAINT "Grade_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Grade" ADD CONSTRAINT "Grade_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CommentTemplate" ADD CONSTRAINT "CommentTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Enrollment" ADD CONSTRAINT "Enrollment_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "public"."Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Enrollment" ADD CONSTRAINT "Enrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Note" ADD CONSTRAINT "Note_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CommentTemplateSkill" ADD CONSTRAINT "CommentTemplateSkill_commentTemplateId_fkey" FOREIGN KEY ("commentTemplateId") REFERENCES "public"."CommentTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StandardSet" ADD CONSTRAINT "StandardSet_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StandardSkill" ADD CONSTRAINT "StandardSkill_setId_fkey" FOREIGN KEY ("setId") REFERENCES "public"."StandardSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
