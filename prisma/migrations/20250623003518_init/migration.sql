/*
  Warnings:

  - Changed the type of `num` on the `Commande` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "Commande" DROP COLUMN "num",
ADD COLUMN     "num" DOUBLE PRECISION NOT NULL;
