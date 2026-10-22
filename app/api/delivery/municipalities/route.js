import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const list = await prisma.municipality.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    return NextResponse.json({
      municipalities: list.map((m) => ({ id: m.id, name: m.name, deliveryFee: m.deliveryFee })),
    });
  } catch (e) {
    console.error("[municipalities] failed", e);
    return NextResponse.json({ code: "SERVER_ERROR", message: "Could not load municipalities" }, { status: 500 });
  }
}