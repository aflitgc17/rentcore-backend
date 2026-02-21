/*
  Warnings:

  - You are about to drop the column `equipmentId` on the `Reservation` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Equipment" DROP CONSTRAINT "Equipment_currentRentalId_fkey";

-- DropForeignKey
ALTER TABLE "Reservation" DROP CONSTRAINT "Reservation_equipmentId_fkey";

-- DropIndex
DROP INDEX "Equipment_currentRentalId_key";

-- AlterTable
ALTER TABLE "Reservation" DROP COLUMN "equipmentId",
ADD COLUMN     "purpose" TEXT,
ADD COLUMN     "rentalRequestId" INTEGER,
ADD COLUMN     "subjectName" TEXT;

-- CreateTable
CREATE TABLE "ReservationItem" (
    "id" SERIAL NOT NULL,
    "reservationId" INTEGER NOT NULL,
    "equipmentId" INTEGER NOT NULL,

    CONSTRAINT "ReservationItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReservationItem_equipmentId_idx" ON "ReservationItem"("equipmentId");

-- CreateIndex
CREATE INDEX "ReservationItem_reservationId_idx" ON "ReservationItem"("reservationId");

-- CreateIndex
CREATE UNIQUE INDEX "ReservationItem_reservationId_equipmentId_key" ON "ReservationItem"("reservationId", "equipmentId");

-- CreateIndex
CREATE INDEX "Reservation_userId_startDate_endDate_idx" ON "Reservation"("userId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "Reservation_status_startDate_idx" ON "Reservation"("status", "startDate");

-- AddForeignKey
ALTER TABLE "ReservationItem" ADD CONSTRAINT "ReservationItem_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationItem" ADD CONSTRAINT "ReservationItem_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
