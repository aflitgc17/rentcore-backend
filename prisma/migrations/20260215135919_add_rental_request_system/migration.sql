-- CreateEnum
CREATE TYPE "public"."RentalStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'RENTED', 'RETURNED');

-- CreateTable
CREATE TABLE "public"."RentalRequest" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "from" TIMESTAMP(3) NOT NULL,
    "to" TIMESTAMP(3) NOT NULL,
    "status" "public"."RentalStatus" NOT NULL DEFAULT 'REQUESTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RentalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RentalItem" (
    "id" SERIAL NOT NULL,
    "rentalRequestId" INTEGER NOT NULL,
    "equipmentId" INTEGER NOT NULL,

    CONSTRAINT "RentalItem_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."RentalRequest" ADD CONSTRAINT "RentalRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RentalItem" ADD CONSTRAINT "RentalItem_rentalRequestId_fkey" FOREIGN KEY ("rentalRequestId") REFERENCES "public"."RentalRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RentalItem" ADD CONSTRAINT "RentalItem_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "public"."Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
