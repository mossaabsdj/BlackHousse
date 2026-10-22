import { PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ✅ Get all users
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");

    if (!email) {
      return NextResponse.json(
        { error: "Missing user email" },
        { status: 400 }
      );
    }

    // Get current user
    const currentUser = await prisma.compte.findUnique({
      where: { email },
      select: { email: true, role: true },
    });

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Build filters
    const filters = {
      email: { not: email },
    };

    if (currentUser.role !== "ADMIN") {
      filters.role = "CLIENT";
    }

    const users = await prisma.compte.findMany({
      where: filters,
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        country: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error("GET /api/users error:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}

// ✅ Create new user
export async function POST(req) {
  try {
    const body = await req.json();
    const { fullName, email, phone, country, role, password } = body;

    if (!email || !password || !fullName)
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );

    const existingUser = await prisma.compte.findUnique({ where: { email } });
    if (existingUser)
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 400 }
      );

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.compte.create({
      data: {
        fullName,
        email,
        phone,
        country,
        role,
        Password: hashedPassword,
      },
    });

    return NextResponse.json(newUser);
  } catch (error) {
    console.error("POST /api/users error:", error);
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 }
    );
  }
}

// ✅ Update user by ID
export async function PUT(req) {
  try {
    const body = await req.json();
    const { id, fullName, email, phone, country, role, password } = body;

    const existing = await prisma.compte.findUnique({ where: { id } });
    if (!existing)
      return NextResponse.json({ error: "User not found" }, { status: 404 });

    const dataToUpdate = { fullName, email, phone, country, role };
    if (password) dataToUpdate.Password = await bcrypt.hash(password, 10);

    const updatedUser = await prisma.compte.update({
      where: { id },
      data: dataToUpdate,
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error("PUT /api/users error:", error);
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    );
  }
}

// ✅ Delete user by ID
export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = parseInt(searchParams.get("id"));

    if (!id)
      return NextResponse.json({ error: "ID required" }, { status: 400 });

    await prisma.compte.delete({ where: { id } });
    return NextResponse.json({ message: "User deleted" });
  } catch (error) {
    console.error("DELETE /api/users error:", error);
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500 }
    );
  }
}
