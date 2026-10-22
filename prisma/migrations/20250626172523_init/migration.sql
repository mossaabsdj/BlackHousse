/*
  Warnings:

  - You are about to drop the column `emballageId` on the `Product` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Product" DROP CONSTRAINT "Product_emballageId_fkey";

-- AlterTable
ALTER TABLE "Emballage" ADD COLUMN     "productId" INTEGER;

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "emballageId";

-- AddForeignKey
ALTER TABLE "Emballage" ADD CONSTRAINT "Emballage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
