/*
  Warnings:

  - You are about to drop the column `imageUrl` on the `Equipment` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Equipment" DROP COLUMN "imageUrl",
ADD COLUMN     "accessories" TEXT,
ADD COLUMN     "assetNumber" TEXT,
ADD COLUMN     "classification" TEXT,
ADD COLUMN     "note" TEXT;
