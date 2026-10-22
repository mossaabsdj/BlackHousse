import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const newUser = await prisma.emballage.createMany({
    data: [
      { id: 18, name: "box 1kg", productId: 9 },
      { id: 19, name: "box 1kg", productId: 8 },
      { id: 20, name: "box 1kg", productId: 10 },
      { id: 21, name: "box 1kg", productId: 11 },
      { id: 22, name: "box 1kg", productId: 12 },
      { id: 23, name: "box 1kg", productId: 13 },
      { id: 24, name: "box 1kg", productId: 14 },
      { id: 25, name: "box 1kg", productId: 15 },
      { id: 26, name: "box 1kg", productId: 16 },
      { id: 28, name: "box 1kg", productId: 17 },
      { id: 29, name: "box 1kg", productId: 18 },
      { id: 31, name: "box 1kg", productId: 20 },
      { id: 32, name: "box 1kg", productId: 21 },
      { id: 33, name: "box 1kg", productId: 22 },
      { id: 34, name: "box 1kg", productId: 23 },
      { id: 35, name: "Box 1kg", productId: 24 },
    ],
  });

  console.log(newUser);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
  });
