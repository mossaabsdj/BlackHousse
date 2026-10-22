/*
  Warnings:

  - You are about to drop the column `compteId` on the `Commande` table. All the data in the column will be lost.
  - You are about to drop the `Compte` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `mail` to the `Commande` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nom` to the `Commande` table without a default value. This is not possible if the table is not empty.
  - Added the required column `num` to the `Commande` table without a default value. This is not possible if the table is not empty.
  - Added the required column `prenom` to the `Commande` table without a default value. This is not possible if the table is not empty.
  - Added the required column `region` to the `Commande` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Commande" DROP CONSTRAINT "Commande_compteId_fkey";

-- AlterTable
ALTER TABLE "Commande" DROP COLUMN "compteId",
ADD COLUMN     "mail" TEXT NOT NULL,
ADD COLUMN     "nom" TEXT NOT NULL,
ADD COLUMN     "num" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "prenom" TEXT NOT NULL,
ADD COLUMN     "region" TEXT NOT NULL;

-- DropTable
DROP TABLE "Compte";

-- DropEnum
DROP TYPE "Role";

-- CreateTable
CREATE TABLE "VerificationToken" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Admin" (
    "id" SERIAL NOT NULL,
    "User" TEXT NOT NULL,
    "Password" TEXT NOT NULL,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Admin_User_key" ON "Admin"("User");
