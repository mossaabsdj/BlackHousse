/*
  Warnings:

  - You are about to drop the `areas` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ui_texts` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "areas";

-- DropTable
DROP TABLE "ui_texts";

-- CreateTable
CREATE TABLE "product" (
    "id" SERIAL NOT NULL,
    "Title" TEXT NOT NULL,
    "Desc" TEXT NOT NULL,
    "Prix" TEXT NOT NULL,

    CONSTRAINT "product_pkey" PRIMARY KEY ("id")
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
