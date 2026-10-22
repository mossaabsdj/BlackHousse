-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "emballageId" INTEGER;

-- CreateTable
CREATE TABLE "Emballage" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Emballage_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_emballageId_fkey" FOREIGN KEY ("emballageId") REFERENCES "Emballage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
