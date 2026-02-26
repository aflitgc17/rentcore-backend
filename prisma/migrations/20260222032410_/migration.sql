/*
  Warnings:

  - Added the required column `subjectName` to the `FacilityReservation` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "FacilityReservation" ADD COLUMN     "subjectName" TEXT NOT NULL;
