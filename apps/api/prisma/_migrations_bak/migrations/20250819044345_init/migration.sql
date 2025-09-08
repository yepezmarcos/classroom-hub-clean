/*
  Warnings:

  - Added the required column `updatedAt` to the `Classroom` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Guardian` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Student` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Classroom" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Guardian" ADD COLUMN     "phone" TEXT,
ADD COLUMN     "preferredLang" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "email" TEXT,
ADD COLUMN     "grade" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;
