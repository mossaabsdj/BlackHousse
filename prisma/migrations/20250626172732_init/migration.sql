/*
  Warnings:

  - Made the column `productId` on table `Emballage` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Emballage" DROP CONSTRAINT "Emballage_productId_fkey";

-- AlterTable
ALTER TABLE "Emballage" ALTER COLUMN "productId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Emballage" ADD CONSTRAINT "Emballage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
