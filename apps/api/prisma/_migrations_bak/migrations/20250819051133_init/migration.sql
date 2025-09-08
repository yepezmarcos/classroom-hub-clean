/*
  Warnings:

  - You are about to drop the column `updatedAt` on the `Classroom` table. All the data in the column will be lost.
  - You are about to drop the column `preferredLang` on the `Guardian` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Classroom" DROP COLUMN "updatedAt";

-- AlterTable
ALTER TABLE "Guardian" DROP COLUMN "preferredLang";

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "ell" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "gender" TEXT,
ADD COLUMN     "iep" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "medical" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pronouns" TEXT;
