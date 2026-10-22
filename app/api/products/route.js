import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      include: {
        products: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
          include: {
            optionGroups: {
              orderBy: { sortOrder: "asc" },
              include: {
                group: { include: { options: { where: { isActive: true }, orderBy: { sortOrder: "asc" } } } },
              },
            },
          },
        },
      },
    });

    const products = categories.flatMap((c) =>
      c.products.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description ?? "",
        price: p.price,
        image: p.imageUrl,
        categoryId: c.id,
        available: p.available,
        optionGroups: p.optionGroups
          .map(({ group: g }) => {
            const single = g.selection === "SINGLE";
            return {
              id: g.id,
              name: g.name,
              type: single ? "single" : "multiple",
              required: g.required,
              min: single ? (g.required ? 1 : 0) : Math.max(g.minSelect, g.required ? 1 : 0),
              max: single ? 1 : g.maxSelect, // null = unlimited
              options: g.options.map((o) => ({ id: o.id, name: o.name, price: o.price, available: o.available })),
            };
          })
          .filter((g) => g.options.length > 0),
      }))
    );

    return NextResponse.json({ categories: categories.map((c) => ({ id: c.id, name: c.name })), products });
  } catch (e) {
    console.error("[products] failed", e);
    return NextResponse.json({ code: "SERVER_ERROR", message: "Could not load the menu" }, { status: 500 });
  }
}