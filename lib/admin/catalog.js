import { HttpError, parse } from "./http";

/* ----------------------------- field specs ----------------------------- */
const sortOrder = { type: "int", default: 0, min: -1000, max: 100000 };

export const categorySpec = {
  name: { type: "string", max: 80 },
  sortOrder,
  isActive: { type: "bool", default: true },
};

export const municipalitySpec = {
  name: { type: "string", max: 80 },
  deliveryFee: { type: "int", nullable: true, max: 1_000_000 },
  sortOrder,
  isActive: { type: "bool", default: true },
};

export const productSpec = {
  name: { type: "string", max: 120 },
  description: { type: "string", max: 500, nullable: true },
  price: { type: "int", max: 1_000_000 },
  imageUrl: { type: "url", nullable: true },
  available: { type: "bool", default: true },
  isActive: { type: "bool", default: true },
  sortOrder,
  categoryId: { type: "string", max: 100 },
};

export const optionSpec = {
  name: { type: "string", max: 80 },
  price: { type: "int", default: 0, max: 1_000_000 },
  available: { type: "bool", default: true },
  isActive: { type: "bool", default: true },
};

const groupSpec = {
  name: { type: "string", max: 80 },
  selection: { type: "enum", values: ["SINGLE", "MULTIPLE"] },
  required: { type: "bool", default: false },
  minSelect: { type: "int", default: 0, max: 50 },
  maxSelect: { type: "int", nullable: true, min: 1, max: 50 },
};

/* ------------------------------ option groups ------------------------------ */

export const GROUP_INCLUDE = { options: { orderBy: { sortOrder: "asc" } }, _count: { select: { products: true } } };

export const toAdminGroup = (g) => ({
  id: g.id,
  name: g.name,
  selection: g.selection,
  required: g.required,
  minSelect: g.minSelect,
  maxSelect: g.maxSelect,
  productCount: g._count?.products ?? 0,
  options: g.options.map((o) => ({ id: o.id, name: o.name, price: o.price, available: o.available, isActive: o.isActive })),
});

/** Validates a full group (with its options). SINGLE groups are normalised: max 1, min = required ? 1 : 0. */
export function parseGroupBody(body) {
  const g = parse(body, groupSpec);
  const fields = {};
  let { minSelect, maxSelect } = g;
  if (g.selection === "SINGLE") {
    minSelect = g.required ? 1 : 0;
    maxSelect = null;
  } else {
    if (g.required) minSelect = Math.max(1, minSelect);
    if (maxSelect != null && maxSelect < Math.max(1, minSelect)) fields.maxSelect = "invalid";
  }

  const raw = Array.isArray(body?.options) ? body.options : null;
  if (!raw || raw.length > 100) fields.options = "invalid";
  const options = [];
  (raw ?? []).forEach((o, i) => {
    try {
      options.push({ id: typeof o?.id === "string" ? o.id : undefined, ...parse(o, optionSpec), sortOrder: i });
    } catch (e) {
      if (!(e instanceof HttpError)) throw e;
      fields[`options.${i}`] = e.fields;
    }
  });
  if (Object.keys(fields).length) throw new HttpError(422, "VALIDATION_ERROR", "Données invalides", fields);
  return { data: { name: g.name, selection: g.selection, required: g.required, minSelect, maxSelect }, options };
}

/* -------------------------------- products -------------------------------- */

export const PRODUCT_INCLUDE = {
  category: { select: { name: true } },
  optionGroups: { orderBy: { sortOrder: "asc" }, select: { groupId: true } },
};

export const toAdminProduct = (p) => ({
  id: p.id,
  name: p.name,
  description: p.description,
  price: p.price,
  imageUrl: p.imageUrl,
  available: p.available,
  isActive: p.isActive,
  sortOrder: p.sortOrder,
  categoryId: p.categoryId,
  categoryName: p.category?.name ?? "",
  groupIds: p.optionGroups.map((x) => x.groupId),
});

export function parseGroupIds(body) {
  if (body?.groupIds === undefined) return undefined;
  const ids = body.groupIds;
  if (!Array.isArray(ids) || ids.length > 30 || ids.some((x) => typeof x !== "string") || new Set(ids).size !== ids.length)
    throw new HttpError(422, "VALIDATION_ERROR", "Données invalides", { groupIds: "invalid" });
  return ids;
}

export async function assertProductRefs(prisma, { categoryId, groupIds }) {
  if (categoryId !== undefined && !(await prisma.category.findUnique({ where: { id: categoryId } })))
    throw new HttpError(422, "VALIDATION_ERROR", "Données invalides", { categoryId: "invalid" });
  if (groupIds?.length && (await prisma.optionGroup.count({ where: { id: { in: groupIds } } })) !== groupIds.length)
    throw new HttpError(422, "VALIDATION_ERROR", "Données invalides", { groupIds: "invalid" });
}