/*
  Warnings:

  - Added the required column `purpose` to the `RentalRequest` table without a default value. This is not possible if the table is not empty.
  - Added the required column `subjectName` to the `RentalRequest` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."RentalRequest" ADD COLUMN     "purpose" TEXT NOT NULL,
ADD COLUMN     "subjectName" TEXT NOT NULL;
