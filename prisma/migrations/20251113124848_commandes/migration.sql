/*
  Warnings:

  - You are about to drop the column `mail` on the `Commande` table. All the data in the column will be lost.
  - You are about to drop the column `nom` on the `Commande` table. All the data in the column will be lost.
  - You are about to drop the column `num` on the `Commande` table. All the data in the column will be lost.
  - You are about to drop the column `prenom` on the `Commande` table. All the data in the column will be lost.
  - You are about to drop the column `region` on the `Commande` table. All the data in the column will be lost.
  - Added the required column `compteId` to the `Commande` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Commande" DROP COLUMN "mail",
DROP COLUMN "nom",
DROP COLUMN "num",
DROP COLUMN "prenom",
DROP COLUMN "region",
ADD COLUMN     "compteId" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "Commande" ADD CONSTRAINT "Commande_compteId_fkey" FOREIGN KEY ("compteId") REFERENCES "Compte"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
