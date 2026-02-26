/*
  Warnings:

  - The `status` column on the `FacilityReservation` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "FacilityStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "FacilityReservation" DROP COLUMN "status",
ADD COLUMN     "status" "FacilityStatus" NOT NULL DEFAULT 'REQUESTED';
