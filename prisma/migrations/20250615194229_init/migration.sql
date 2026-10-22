/*
  Warnings:

  - You are about to drop the column `Desc` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `Prix` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `Title` on the `Product` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Product" DROP COLUMN "Desc",
DROP COLUMN "Prix",
DROP COLUMN "Title",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "desc" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "emballage" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "prix" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "title" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "Commande" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "emballage" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "adresse" TEXT NOT NULL,
    "mail" TEXT NOT NULL,
    "num" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Commande_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Commande" ADD CONSTRAINT "Commande_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
