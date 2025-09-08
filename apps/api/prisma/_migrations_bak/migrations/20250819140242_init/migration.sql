/*
  Warnings:

  - You are about to drop the column `endDate` on the `Enrollment` table. All the data in the column will be lost.
  - You are about to drop the column `startDate` on the `Enrollment` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Guardian` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[tenantId,classroomId,studentId]` on the table `Enrollment` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Enrollment_tenantId_studentId_classroomId_idx";

-- AlterTable
ALTER TABLE "Enrollment" DROP COLUMN "endDate",
DROP COLUMN "startDate";

-- AlterTable
ALTER TABLE "Guardian" DROP COLUMN "updatedAt",
ADD COLUMN     "phone" TEXT;

-- AlterTable
ALTER TABLE "Note" ALTER COLUMN "tags" SET DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "Enrollment_tenantId_studentId_idx" ON "Enrollment"("tenantId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_tenantId_classroomId_studentId_key" ON "Enrollment"("tenantId", "classroomId", "studentId");
