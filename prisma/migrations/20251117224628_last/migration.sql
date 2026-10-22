/*
  Warnings:

  - You are about to drop the column `mail` on the `Commande` table. All the data in the column will be lost.
  - You are about to drop the column `nom` on the `Commande` table. All the data in the column will be lost.
  - You are about to drop the column `num` on the `Commande` table. All the data in the column will be lost.
  - You are about to drop the column `prenom` on the `Commande` table. All the data in the column will be lost.
  - You are about to drop the column `region` on the `Commande` table. All the data in the column will be lost.
  - You are about to drop the `Admin` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `compteId` to the `Commande` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'CLIENT', 'FARMER', 'DELIVERY');

-- AlterTable
ALTER TABLE "Commande" DROP COLUMN "mail",
DROP COLUMN "nom",
DROP COLUMN "num",
DROP COLUMN "prenom",
DROP COLUMN "region",
ADD COLUMN     "compteId" INTEGER NOT NULL;

-- DropTable
DROP TABLE "Admin";

-- CreateTable
CREATE TABLE "Compte" (
    "id" SERIAL NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "country" TEXT,
    "Password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'CLIENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Compte_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Compte_email_key" ON "Compte"("email");

-- AddForeignKey
ALTER TABLE "Commande" ADD CONSTRAINT "Commande_compteId_fkey" FOREIGN KEY ("compteId") REFERENCES "Compte"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
