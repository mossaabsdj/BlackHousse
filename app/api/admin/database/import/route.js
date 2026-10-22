import { prisma } from "@/lib/prisma";
import { admin, json, HttpError } from "@/lib/admin/http";
import { syncDatabaseSequences } from "@/lib/admin/database";

export const dynamic = "force-dynamic";

// POST /api/admin/database/import
export const POST = admin(async ({ body, token }) => {
  if (!body || typeof body !== "object") {
    throw new HttpError(400, "BAD_PAYLOAD", "Payload JSON invalide.");
  }

  const mode = body.mode === "replace" ? "replace" : "merge";
  const rawData = body.data || body;

  const categories = Array.isArray(rawData.categories) ? rawData.categories : [];
  const optionGroups = Array.isArray(rawData.optionGroups) ? rawData.optionGroups : [];
  const options = Array.isArray(rawData.options) ? rawData.options : [];
  const products = Array.isArray(rawData.products) ? rawData.products : [];
  const productOptionGroups = Array.isArray(rawData.productOptionGroups) ? rawData.productOptionGroups : [];
  const municipalities = Array.isArray(rawData.municipalities) ? rawData.municipalities : [];
  const expenses = Array.isArray(rawData.expenses) ? rawData.expenses : [];
  const orders = Array.isArray(rawData.orders) ? rawData.orders : [];
  const comptes = Array.isArray(rawData.comptes) ? rawData.comptes : [];

  const totalEntries =
    categories.length +
    optionGroups.length +
    options.length +
    products.length +
    productOptionGroups.length +
    municipalities.length +
    expenses.length +
    orders.length +
    comptes.length;

  if (totalEntries === 0) {
    throw new HttpError(400, "EMPTY_DATA", "Aucune donnée reconnue à importer dans le fichier JSON.");
  }

  // Execute in an atomic transaction with 60-second timeout
  const result = await prisma.$transaction(
    async (tx) => {
      if (mode === "replace") {
        // ==============================================================
        // 1. REPLACE MODE: Delete in reverse dependency order
        // ==============================================================
        await tx.orderItemOption.deleteMany();
        await tx.orderItem.deleteMany();
        await tx.orderStatusHistory.deleteMany();
        await tx.order.deleteMany();
        await tx.productOptionGroup.deleteMany();
        await tx.option.deleteMany();
        await tx.product.deleteMany();
        await tx.optionGroup.deleteMany();
        await tx.category.deleteMany();
        await tx.municipality.deleteMany();
        await tx.expense.deleteMany();

        // Preserve current admin account if logged in to maintain active session
        const currentAdminEmail = token?.email;
        if (currentAdminEmail) {
          await tx.compte.deleteMany({
            where: { email: { not: currentAdminEmail } },
          });
        } else {
          await tx.compte.deleteMany();
        }

        // --- 1. Categories ---
        for (const c of categories) {
          if (!c.name) continue;
          await tx.category.create({
            data: {
              ...(c.id ? { id: c.id } : {}),
              name: c.name,
              sortOrder: Number(c.sortOrder) || 0,
              isActive: c.isActive !== false,
              createdAt: c.createdAt ? new Date(c.createdAt) : undefined,
              updatedAt: c.updatedAt ? new Date(c.updatedAt) : undefined,
            },
          });
        }

        // --- 2. Option Groups ---
        for (const og of optionGroups) {
          if (!og.name) continue;
          await tx.optionGroup.create({
            data: {
              ...(og.id ? { id: og.id } : {}),
              name: og.name,
              selection: og.selection === "MULTIPLE" ? "MULTIPLE" : "SINGLE",
              required: Boolean(og.required),
              minSelect: Number(og.minSelect) || 0,
              maxSelect: og.maxSelect != null ? Number(og.maxSelect) : null,
              createdAt: og.createdAt ? new Date(og.createdAt) : undefined,
              updatedAt: og.updatedAt ? new Date(og.updatedAt) : undefined,
            },
          });
        }

        // --- 3. Options ---
        for (const o of options) {
          if (!o.name || !o.groupId) continue;
          await tx.option.create({
            data: {
              ...(o.id ? { id: o.id } : {}),
              groupId: o.groupId,
              name: o.name,
              price: Number(o.price) || 0,
              available: o.available !== false,
              isActive: o.isActive !== false,
              sortOrder: Number(o.sortOrder) || 0,
            },
          });
        }

        // --- 4. Products ---
        for (const p of products) {
          if (!p.name || !p.categoryId) continue;
          await tx.product.create({
            data: {
              ...(p.id ? { id: p.id } : {}),
              name: p.name,
              description: p.description || null,
              price: Number(p.price) || 0,
              imageUrl: p.imageUrl || null,
              available: p.available !== false,
              isActive: p.isActive !== false,
              sortOrder: Number(p.sortOrder) || 0,
              categoryId: p.categoryId,
              createdAt: p.createdAt ? new Date(p.createdAt) : undefined,
              updatedAt: p.updatedAt ? new Date(p.updatedAt) : undefined,
            },
          });
        }

        // --- 5. Product Option Groups ---
        for (const pog of productOptionGroups) {
          if (!pog.productId || !pog.groupId) continue;
          await tx.productOptionGroup.create({
            data: {
              productId: pog.productId,
              groupId: pog.groupId,
              sortOrder: Number(pog.sortOrder) || 0,
            },
          });
        }

        // --- 6. Municipalities ---
        for (const m of municipalities) {
          if (!m.name) continue;
          await tx.municipality.create({
            data: {
              ...(m.id ? { id: m.id } : {}),
              name: m.name,
              deliveryFee: m.deliveryFee != null ? Number(m.deliveryFee) : null,
              isActive: m.isActive !== false,
              sortOrder: Number(m.sortOrder) || 0,
            },
          });
        }

        // --- 7. Expenses ---
        for (const e of expenses) {
          if (!e.amount || !e.description) continue;
          await tx.expense.create({
            data: {
              ...(e.id ? { id: e.id } : {}),
              amount: Number(e.amount),
              description: e.description,
              category: e.category || "AUTRE",
              date: e.date ? new Date(e.date) : new Date(),
              createdAt: e.createdAt ? new Date(e.createdAt) : undefined,
              updatedAt: e.updatedAt ? new Date(e.updatedAt) : undefined,
            },
          });
        }

        // --- 8. Orders & Nested Items ---
        for (const o of orders) {
          if (!o.reference || !o.customerName) continue;
          const createdOrder = await tx.order.create({
            data: {
              ...(o.id ? { id: o.id } : {}),
              reference: o.reference,
              status: o.status || "PENDING",
              fulfillment: o.fulfillment === "DELIVERY" ? "DELIVERY" : "PICKUP",
              customerName: o.customerName,
              customerPhone: o.customerPhone || "0550000000",
              municipalityId: o.municipalityId || null,
              municipalityName: o.municipalityName || null,
              address: o.address || null,
              notes: o.notes || null,
              subtotal: Number(o.subtotal) || 0,
              deliveryFee: Number(o.deliveryFee) || 0,
              total: Number(o.total) || 0,
              idempotencyKey: o.idempotencyKey || `imp-${o.reference}-${Date.now()}`,
              requestHash: o.requestHash || "imported",
              createdAt: o.createdAt ? new Date(o.createdAt) : undefined,
              updatedAt: o.updatedAt ? new Date(o.updatedAt) : undefined,
            },
          });

          if (Array.isArray(o.items)) {
            for (const it of o.items) {
              const createdItem = await tx.orderItem.create({
                data: {
                  ...(it.id ? { id: it.id } : {}),
                  orderId: createdOrder.id,
                  productId: it.productId || null,
                  productName: it.productName || "Produit",
                  unitPrice: Number(it.unitPrice) || 0,
                  quantity: Number(it.quantity) || 1,
                  lineTotal: Number(it.lineTotal) || 0,
                },
              });

              if (Array.isArray(it.options)) {
                for (const opt of it.options) {
                  await tx.orderItemOption.create({
                    data: {
                      ...(opt.id ? { id: opt.id } : {}),
                      orderItemId: createdItem.id,
                      groupName: opt.groupName || "Option",
                      optionName: opt.optionName || "Choix",
                      price: Number(opt.price) || 0,
                    },
                  });
                }
              }
            }
          }

          if (Array.isArray(o.history)) {
            for (const h of o.history) {
              await tx.orderStatusHistory.create({
                data: {
                  ...(h.id ? { id: h.id } : {}),
                  orderId: createdOrder.id,
                  status: h.status || "PENDING",
                  createdAt: h.createdAt ? new Date(h.createdAt) : undefined,
                },
              });
            }
          }
        }

        // --- 9. Comptes (Accounts with Auto-increment ID) ---
        for (const c of comptes) {
          if (!c.email || !c.Password) continue;
          await tx.compte.upsert({
            where: { email: c.email },
            update: {
              fullName: c.fullName || "Utilisateur",
              phone: c.phone || null,
              country: c.country || null,
              role: c.role || "CLIENT",
              Password: c.Password,
            },
            create: {
              ...(c.id ? { id: Number(c.id) } : {}),
              fullName: c.fullName || "Utilisateur",
              email: c.email,
              phone: c.phone || null,
              country: c.country || null,
              role: c.role || "CLIENT",
              Password: c.Password,
              createdAt: c.createdAt ? new Date(c.createdAt) : undefined,
            },
          });
        }
      } else {
        // ==============================================================
        // 2. MERGE MODE: Upsert records with ID resolution mapping
        // ==============================================================
        const categoryIdMap = new Map();
        const optionGroupIdMap = new Map();
        const productIdMap = new Map();

        // --- 1. Categories ---
        for (const c of categories) {
          if (!c.name) continue;
          let savedCategory;
          if (c.id) {
            savedCategory = await tx.category.upsert({
              where: { id: c.id },
              update: {
                name: c.name,
                sortOrder: Number(c.sortOrder) || 0,
                isActive: c.isActive !== false,
              },
              create: {
                id: c.id,
                name: c.name,
                sortOrder: Number(c.sortOrder) || 0,
                isActive: c.isActive !== false,
              },
            });
          } else {
            savedCategory = await tx.category.create({
              data: {
                name: c.name,
                sortOrder: Number(c.sortOrder) || 0,
                isActive: c.isActive !== false,
              },
            });
          }
          if (c.id && savedCategory?.id) {
            categoryIdMap.set(c.id, savedCategory.id);
          }
        }

        // --- 2. Option Groups ---
        for (const og of optionGroups) {
          if (!og.name) continue;
          let savedGroup;
          if (og.id) {
            savedGroup = await tx.optionGroup.upsert({
              where: { id: og.id },
              update: {
                name: og.name,
                selection: og.selection === "MULTIPLE" ? "MULTIPLE" : "SINGLE",
                required: Boolean(og.required),
                minSelect: Number(og.minSelect) || 0,
                maxSelect: og.maxSelect != null ? Number(og.maxSelect) : null,
              },
              create: {
                id: og.id,
                name: og.name,
                selection: og.selection === "MULTIPLE" ? "MULTIPLE" : "SINGLE",
                required: Boolean(og.required),
                minSelect: Number(og.minSelect) || 0,
                maxSelect: og.maxSelect != null ? Number(og.maxSelect) : null,
              },
            });
          } else {
            savedGroup = await tx.optionGroup.create({
              data: {
                name: og.name,
                selection: og.selection === "MULTIPLE" ? "MULTIPLE" : "SINGLE",
                required: Boolean(og.required),
                minSelect: Number(og.minSelect) || 0,
                maxSelect: og.maxSelect != null ? Number(og.maxSelect) : null,
              },
            });
          }
          if (og.id && savedGroup?.id) {
            optionGroupIdMap.set(og.id, savedGroup.id);
          }
        }

        // --- 3. Options ---
        for (const o of options) {
          if (!o.name || !o.groupId) continue;
          const targetGroupId = optionGroupIdMap.get(o.groupId) || o.groupId;

          // Verify group exists
          const groupExists = await tx.optionGroup.findUnique({
            where: { id: targetGroupId },
            select: { id: true },
          });
          if (!groupExists) continue;

          if (o.id) {
            await tx.option.upsert({
              where: { id: o.id },
              update: {
                groupId: targetGroupId,
                name: o.name,
                price: Number(o.price) || 0,
                available: o.available !== false,
                isActive: o.isActive !== false,
                sortOrder: Number(o.sortOrder) || 0,
              },
              create: {
                id: o.id,
                groupId: targetGroupId,
                name: o.name,
                price: Number(o.price) || 0,
                available: o.available !== false,
                isActive: o.isActive !== false,
                sortOrder: Number(o.sortOrder) || 0,
              },
            });
          } else {
            await tx.option.create({
              data: {
                groupId: targetGroupId,
                name: o.name,
                price: Number(o.price) || 0,
                available: o.available !== false,
                isActive: o.isActive !== false,
                sortOrder: Number(o.sortOrder) || 0,
              },
            });
          }
        }

        // --- 4. Products ---
        for (const p of products) {
          if (!p.name || !p.categoryId) continue;
          const targetCategoryId = categoryIdMap.get(p.categoryId) || p.categoryId;

          // Verify category exists
          const catExists = await tx.category.findUnique({
            where: { id: targetCategoryId },
            select: { id: true },
          });
          if (!catExists) continue;

          let savedProduct;
          if (p.id) {
            savedProduct = await tx.product.upsert({
              where: { id: p.id },
              update: {
                name: p.name,
                description: p.description || null,
                price: Number(p.price) || 0,
                imageUrl: p.imageUrl || null,
                available: p.available !== false,
                isActive: p.isActive !== false,
                sortOrder: Number(p.sortOrder) || 0,
                categoryId: targetCategoryId,
              },
              create: {
                id: p.id,
                name: p.name,
                description: p.description || null,
                price: Number(p.price) || 0,
                imageUrl: p.imageUrl || null,
                available: p.available !== false,
                isActive: p.isActive !== false,
                sortOrder: Number(p.sortOrder) || 0,
                categoryId: targetCategoryId,
              },
            });
          } else {
            savedProduct = await tx.product.create({
              data: {
                name: p.name,
                description: p.description || null,
                price: Number(p.price) || 0,
                imageUrl: p.imageUrl || null,
                available: p.available !== false,
                isActive: p.isActive !== false,
                sortOrder: Number(p.sortOrder) || 0,
                categoryId: targetCategoryId,
              },
            });
          }
          if (p.id && savedProduct?.id) {
            productIdMap.set(p.id, savedProduct.id);
          }
        }

        // --- 5. Product Option Groups ---
        for (const pog of productOptionGroups) {
          if (!pog.productId || !pog.groupId) continue;
          const targetProductId = productIdMap.get(pog.productId) || pog.productId;
          const targetGroupId = optionGroupIdMap.get(pog.groupId) || pog.groupId;

          // Verify both product and group exist
          const [pExists, gExists] = await Promise.all([
            tx.product.findUnique({ where: { id: targetProductId }, select: { id: true } }),
            tx.optionGroup.findUnique({ where: { id: targetGroupId }, select: { id: true } }),
          ]);
          if (!pExists || !gExists) continue;

          await tx.productOptionGroup.upsert({
            where: {
              productId_groupId: {
                productId: targetProductId,
                groupId: targetGroupId,
              },
            },
            update: {
              sortOrder: Number(pog.sortOrder) || 0,
            },
            create: {
              productId: targetProductId,
              groupId: targetGroupId,
              sortOrder: Number(pog.sortOrder) || 0,
            },
          });
        }

        // --- 6. Municipalities ---
        for (const m of municipalities) {
          if (!m.name) continue;
          await tx.municipality.upsert({
            where: { name: m.name },
            update: {
              deliveryFee: m.deliveryFee != null ? Number(m.deliveryFee) : null,
              isActive: m.isActive !== false,
              sortOrder: Number(m.sortOrder) || 0,
            },
            create: {
              ...(m.id ? { id: m.id } : {}),
              name: m.name,
              deliveryFee: m.deliveryFee != null ? Number(m.deliveryFee) : null,
              isActive: m.isActive !== false,
              sortOrder: Number(m.sortOrder) || 0,
            },
          });
        }

        // --- 7. Expenses ---
        for (const e of expenses) {
          if (!e.amount || !e.description) continue;
          if (e.id) {
            await tx.expense.upsert({
              where: { id: e.id },
              update: {
                amount: Number(e.amount),
                description: e.description,
                category: e.category || "AUTRE",
                date: e.date ? new Date(e.date) : new Date(),
              },
              create: {
                id: e.id,
                amount: Number(e.amount),
                description: e.description,
                category: e.category || "AUTRE",
                date: e.date ? new Date(e.date) : new Date(),
              },
            });
          } else {
            await tx.expense.create({
              data: {
                amount: Number(e.amount),
                description: e.description,
                category: e.category || "AUTRE",
                date: e.date ? new Date(e.date) : new Date(),
              },
            });
          }
        }

        // --- 8. Orders & Nested Items ---
        for (const o of orders) {
          if (!o.reference) continue;
          const orderData = {
            status: o.status || "PENDING",
            fulfillment: o.fulfillment === "DELIVERY" ? "DELIVERY" : "PICKUP",
            customerName: o.customerName || "Client",
            customerPhone: o.customerPhone || "0550000000",
            municipalityId: o.municipalityId || null,
            municipalityName: o.municipalityName || null,
            address: o.address || null,
            notes: o.notes || null,
            subtotal: Number(o.subtotal) || 0,
            deliveryFee: Number(o.deliveryFee) || 0,
            total: Number(o.total) || 0,
          };

          const upsertedOrder = await tx.order.upsert({
            where: { reference: o.reference },
            update: orderData,
            create: {
              ...(o.id ? { id: o.id } : {}),
              reference: o.reference,
              idempotencyKey: o.idempotencyKey || `imp-${o.reference}-${Date.now()}`,
              requestHash: o.requestHash || "imported",
              ...orderData,
            },
          });

          // Re-sync items for the order if provided
          if (Array.isArray(o.items) && o.items.length > 0) {
            await tx.orderItemOption.deleteMany({
              where: { item: { orderId: upsertedOrder.id } },
            });
            await tx.orderItem.deleteMany({
              where: { orderId: upsertedOrder.id },
            });

            for (const it of o.items) {
              const targetProductId = productIdMap.get(it.productId) || it.productId || null;
              const createdItem = await tx.orderItem.create({
                data: {
                  ...(it.id ? { id: it.id } : {}),
                  orderId: upsertedOrder.id,
                  productId: targetProductId,
                  productName: it.productName || "Produit",
                  unitPrice: Number(it.unitPrice) || 0,
                  quantity: Number(it.quantity) || 1,
                  lineTotal: Number(it.lineTotal) || 0,
                },
              });

              if (Array.isArray(it.options)) {
                for (const opt of it.options) {
                  await tx.orderItemOption.create({
                    data: {
                      ...(opt.id ? { id: opt.id } : {}),
                      orderItemId: createdItem.id,
                      groupName: opt.groupName || "Option",
                      optionName: opt.optionName || "Choix",
                      price: Number(opt.price) || 0,
                    },
                  });
                }
              }
            }
          }
        }

        // --- 9. Comptes ---
        for (const c of comptes) {
          if (!c.email) continue;
          await tx.compte.upsert({
            where: { email: c.email },
            update: {
              fullName: c.fullName || undefined,
              phone: c.phone || undefined,
              country: c.country || undefined,
              role: c.role || undefined,
            },
            create: {
              ...(c.id ? { id: Number(c.id) } : {}),
              fullName: c.fullName || "Utilisateur",
              email: c.email,
              phone: c.phone || null,
              country: c.country || null,
              role: c.role || "CLIENT",
              Password: c.Password || "default_hash",
              createdAt: c.createdAt ? new Date(c.createdAt) : undefined,
            },
          });
        }
      }

      // ==============================================================
      // 3. SYNCHRONIZE POSTGRESQL SEQUENCES
      // Fixes auto-increment sequence drift when explicit IDs are restored.
      // ==============================================================
      await syncDatabaseSequences(tx);

      return {
        mode,
        counts: {
          categories: categories.length,
          optionGroups: optionGroups.length,
          options: options.length,
          products: products.length,
          productOptionGroups: productOptionGroups.length,
          municipalities: municipalities.length,
          expenses: expenses.length,
          orders: orders.length,
          comptes: comptes.length,
        },
      };
    },
    { timeout: 60000 }
  );

  return json({
    ok: true,
    message:
      mode === "replace"
        ? "Base de données entièrement restaurée et séquences ID synchronisées avec succès."
        : "Données importées, fusionnées et séquences ID synchronisées avec succès.",
    ...result,
  });
});
