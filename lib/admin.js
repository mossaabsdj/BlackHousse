import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = "admin@gmail.com";
  const password = "admin";

  // Check if admin already exists
  const existingAdmin = await prisma.compte.findUnique({
    where: { email },
  });

  if (existingAdmin) {
    console.log("Admin account already exists.");
    return;
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create admin account
  const admin = await prisma.compte.create({
    data: {
      fullName: "admin",
      email: "admin@gmail.com",
      phone: "0556270394",
      country: "Algeria",
      role: "ADMIN",
      Password: hashedPassword,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      country: true,
      role: true,
    },
  });

  console.log("Admin account created successfully:");
  console.log(admin);
}

main()
  .catch((error) => {
    console.error("Error creating admin:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });