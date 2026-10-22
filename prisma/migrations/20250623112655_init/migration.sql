/*
  Warnings:

  - Added the required column `quantite` to the `Commande` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Commande" ADD COLUMN     "quantite" INTEGER NOT NULL;
