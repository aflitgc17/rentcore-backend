-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_rentalRequestId_fkey" FOREIGN KEY ("rentalRequestId") REFERENCES "RentalRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
