/**
 * TEST DATA for development: creates sample categories, option groups, products and municipalities.
 *
 *   node prisma/test.js            -> create / update the test data (safe to run many times)
 *   node prisma/test.js --clean    -> delete ONLY the test data (every id starts with "test-")
 *
 * Refuses to run when NODE_ENV=production (add --force to override).
 * Images are left empty on purpose: the page shows a neutral placeholder.
 * Works in both CommonJS and ESM projects.
 */

/* ----------------------------- sample data ----------------------------- */

const CATEGORIES = [
  { id: "test-cat-burgers", name: "Burgers" },
  { id: "test-cat-tacos", name: "Tacos" },
  { id: "test-cat-pizzas", name: "Pizzas" },
  { id: "test-cat-drinks", name: "Boissons" },
  { id: "test-cat-desserts", name: "Desserts" },
];

// options: [name, extraPrice, { available?: false }]
const GROUPS = [
  { id: "test-grp-size", name: "Taille", selection: "SINGLE", required: true, options: [["Normal", 0], ["Maxi", 100]] },
  { id: "test-grp-meat", name: "Viande", selection: "SINGLE", required: true, options: [["Bœuf", 0], ["Poulet", 0]] },
  { id: "test-grp-sauces", name: "Sauces", selection: "MULTIPLE", required: false, maxSelect: 2, options: [["Ketchup", 0], ["Mayonnaise", 0], ["Algérienne", 0], ["Harissa", 0]] },
  { id: "test-grp-extras", name: "Suppléments", selection: "MULTIPLE", required: false, maxSelect: null, options: [["Fromage", 50], ["Œuf", 40], ["Bacon (rupture)", 80, { available: false }]] },
  { id: "test-grp-without", name: "Sans...", selection: "MULTIPLE", required: false, maxSelect: null, options: [["Oignons", 0], ["Salade", 0], ["Tomate", 0]] },
  { id: "test-grp-pizza-size", name: "Taille", selection: "SINGLE", required: true, options: [["Petite", 0], ["Moyenne", 200], ["Grande", 400]] },
  { id: "test-grp-drink-size", name: "Format", selection: "SINGLE", required: true, options: [["33 cl", 0], ["50 cl", 50]] },
];

const PRODUCTS = [
  { id: "test-prd-classic", cat: "test-cat-burgers", name: "Black Classic", price: 650, description: "Steak de bœuf grillé, cheddar, salade, tomate et sauce maison.", groups: ["test-grp-size", "test-grp-sauces", "test-grp-extras", "test-grp-without"] },
  { id: "test-prd-smoke", cat: "test-cat-burgers", name: "Double Smoke", price: 850, description: "Double steak, cheddar fondu, oignons caramélisés et sauce fumée.", groups: ["test-grp-size", "test-grp-sauces", "test-grp-extras"] },
  { id: "test-prd-chicken", cat: "test-cat-burgers", name: "Crispy Chicken", price: 600, description: "Poulet croustillant, coleslaw, cornichons et mayonnaise épicée.", groups: ["test-grp-size", "test-grp-sauces", "test-grp-without"] },
  { id: "test-prd-tacos", cat: "test-cat-tacos", name: "Tacos", price: 550, description: "Viande au choix, frites, fromage et sauce.", groups: ["test-grp-meat", "test-grp-size", "test-grp-sauces", "test-grp-extras"] },
  { id: "test-prd-margherita", cat: "test-cat-pizzas", name: "Margherita", price: 700, description: "Sauce tomate, mozzarella et basilic frais.", groups: ["test-grp-pizza-size", "test-grp-extras"] },
  { id: "test-prd-pepperoni", cat: "test-cat-pizzas", name: "Black Pepperoni", price: 950, description: "Pepperoni, mozzarella, olives noires et origan.", groups: ["test-grp-pizza-size", "test-grp-extras"] },
  { id: "test-prd-lemonade", cat: "test-cat-drinks", name: "Limonade Maison", price: 200, description: "Citron frais pressé, menthe et glaçons.", groups: ["test-grp-drink-size"] },
  { id: "test-prd-brownie", cat: "test-cat-desserts", name: "Brownie Chocolat", price: 300, description: "Brownie fondant servi tiède.", groups: [] },
  { id: "test-prd-cheesecake", cat: "test-cat-desserts", name: "Cheesecake (rupture)", price: 350, description: "Produit indisponible, pour tester l'état « indisponible ».", groups: [], available: false },
];

const MUNICIPALITIES = [
  { id: "test-muni-1", name: "Commune Test 1", deliveryFee: 0 },
  { id: "test-muni-2", name: "Commune Test 2", deliveryFee: 200 },
  { id: "test-muni-3", name: "Commune Test 3", deliveryFee: 300 },
  { id: "test-muni-4", name: "Commune Test 4 (sans frais configurés)", deliveryFee: null },
];

/* -------------------------------- script -------------------------------- */

async function main() {
  const args = process.argv.slice(2);
  if (process.env.NODE_ENV === "production" && !args.includes("--force")) {
    console.error("Refusing to run in production (use --force if you really mean it).");
    process.exit(1);
  }

  const mod = await import("@prisma/client");
  const PrismaClient = mod.PrismaClient ?? mod.default.PrismaClient;
  const prisma = new PrismaClient();

  try {
    if (args.includes("--clean")) {
      const startsWith = { startsWith: "test-" };
      const r = {
        links: await prisma.productOptionGroup.deleteMany({ where: { productId: startsWith } }),
        products: await prisma.product.deleteMany({ where: { id: startsWith } }),
        options: await prisma.option.deleteMany({ where: { id: startsWith } }),
        groups: await prisma.optionGroup.deleteMany({ where: { id: startsWith } }),
        categories: await prisma.category.deleteMany({ where: { id: startsWith } }),
        municipalities: await prisma.municipality.deleteMany({ where: { id: startsWith } }),
      };
      console.log("Test data removed:", Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v.count])));
      return;
    }

    for (const [i, c] of CATEGORIES.entries()) {
      await prisma.category.upsert({
        where: { id: c.id },
        update: { name: c.name, sortOrder: i, isActive: true },
        create: { id: c.id, name: c.name, sortOrder: i },
      });
    }

    for (const g of GROUPS) {
      const data = {
        name: g.name,
        selection: g.selection,
        required: g.required,
        minSelect: g.required ? 1 : 0,
        maxSelect: g.selection === "SINGLE" ? null : g.maxSelect ?? null,
      };
      await prisma.optionGroup.upsert({ where: { id: g.id }, update: data, create: { id: g.id, ...data } });
      for (const [i, [name, price, extra]] of g.options.entries()) {
        const odata = { groupId: g.id, name, price, available: extra?.available !== false, isActive: true, sortOrder: i };
        await prisma.option.upsert({ where: { id: `${g.id}-opt-${i}` }, update: odata, create: { id: `${g.id}-opt-${i}`, ...odata } });
      }
    }

    for (const [i, p] of PRODUCTS.entries()) {
      const data = {
        name: p.name,
        description: p.description,
        price: p.price,
        imageUrl: null,
        available: p.available !== false,
        isActive: true,
        sortOrder: i,
        categoryId: p.cat,
      };
      await prisma.product.upsert({ where: { id: p.id }, update: data, create: { id: p.id, ...data } });
      for (const [j, groupId] of p.groups.entries()) {
        await prisma.productOptionGroup.upsert({
          where: { productId_groupId: { productId: p.id, groupId } },
          update: { sortOrder: j },
          create: { productId: p.id, groupId, sortOrder: j },
        });
      }
    }

    for (const [i, m] of MUNICIPALITIES.entries()) {
      const data = { name: m.name, deliveryFee: m.deliveryFee, isActive: true, sortOrder: i };
      await prisma.municipality.upsert({ where: { id: m.id }, update: data, create: { id: m.id, ...data } });
    }

    console.log(
      `Test data ready: ${CATEGORIES.length} categories, ${GROUPS.length} option groups, ` +
        `${PRODUCTS.length} products, ${MUNICIPALITIES.length} municipalities.`
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});