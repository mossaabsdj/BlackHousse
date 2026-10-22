/*
  Warnings:

  - You are about to drop the column `User` on the `Compte` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Compte_User_key";

-- AlterTable
ALTER TABLE "Compte" DROP COLUMN "User";
