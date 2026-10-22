import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST() {
  try {
    const r = await prisma.admin.create({
      data: {
        User: "mossaabsdj",
        Password: "sdj123",
      },
    });
    return NextResponse.json(r);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
