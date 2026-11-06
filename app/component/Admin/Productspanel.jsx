"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, Search, Trash2, Loader2 } from "lucide-react";
import { api, useList } from "./adminApi";
import { Badge, ErrorBox, Field, Modal, Toggle, btnDanger, btnGhost, btnPrimary, card, inputClass } from "./Ui";
import CloudinaryImagePicker from "./CloudinaryImagePicker";
import { useRealtimeProducts } from "@/lib/Firebase";
import { useI18n } from "@/lib/i18n/I18nContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const BLANK = {
  name: "",
  description: "",
  price: "",
  imageUrl: "",
  categoryId: "",
  available: true,
  isActive: true,
  sortOrder: "0",
  groupIds: [],
};

export default function ProductsPanel() {
  const { t, formatPrice, isRTL } = useI18n();
  const products = useList("/api/admin/products");

  // Keep admin products list in sync with real-time Firebase changes
  useRealtimeProducts(() => {
    products.reload(true);
  });
  const categories = useList("/api/admin/categories");
  const groups = useList("/api/admin/option-groups");
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("");
  const [form, setForm] = useState(null); // { id?, values }
  const [formError, setFormError] = useState({ message: "", fields: {} });
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [productToDelete, setProductToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.items.filter(
      (p) => (!cat || p.categoryId === cat) && (!q || p.name.toLowerCase().includes(q))
    );
  }, [products.items, query, cat]);

  const open = (p) => {
    setFormError({ message: "", fields: {} });
    setForm({
      id: p?.id,
      values: p
        ? {
            name: p.name,
            description: p.description ?? "",
            price: String(p.price),
            imageUrl: p.imageUrl ?? "",
            categoryId: p.categoryId,
            available: p.available,
            isActive: p.isActive,
            sortOrder: String(p.sortOrder),
            groupIds: p.groupIds,
          }
        : { ...BLANK, categoryId: categories.items[0]?.id ?? "" },
    });
  };
  const set = (key, value) => setForm((s) => ({ ...s, values: { ...s.values, [key]: value } }));
  const toggleGroup = (id) =>
    set(
      "groupIds",
      form.values.groupIds.includes(id)
        ? form.values.groupIds.filter((g) => g !== id)
        : [...form.values.groupIds, id]
    );

  const save = async (e) => {
    e.preventDefault();
    if (busy) return;
    const v = form.values;
    setBusy(true);
    setFormError({ message: "", fields: {} });
    const body = {
      name: v.name.trim(),
      description: v.description.trim(),
      price: v.price === "" ? undefined : Number(v.price),
      imageUrl: v.imageUrl.trim(),
      categoryId: v.categoryId,
      available: v.available,
      isActive: v.isActive,
      sortOrder: v.sortOrder === "" ? 0 : Number(v.sortOrder),
      groupIds: v.groupIds,
    };
    try {
      if (form.id) await api.patch(`/api/admin/products/${form.id}`, body);
      else await api.post("/api/admin/products", body);
      setForm(null);
      products.reload(true);
      categories.reload(true);
    } catch (err) {
      setFormError({ message: err.message, fields: err.fields || {} });
    } finally {
      setBusy(false);
    }
  };

  const quickToggle = async (p, key) => {
    setActionError("");
    try {
      await api.patch(`/api/admin/products/${p.id}`, { [key]: !p[key] });
      products.reload(true);
    } catch (err) {
      setActionError(err.message);
    }
  };

  const handleConfirmDelete = async () => {
    if (!productToDelete) return;
    setDeleting(true);
    setActionError("");
    try {
      await api.del(`/api/admin/products/${productToDelete.id}`);
      setProductToDelete(null);
      products.reload(true);
      categories.reload(true);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const error = products.error || categories.error || groups.error;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-extrabold text-gray-900">
          {t("Admin.products.title", {}, "Produits")}
        </h2>
        <button
          type="button"
          onClick={() => open(null)}
          disabled={categories.items.length === 0}
          title={categories.items.length === 0 ? t("Admin.products.firstCreateCategory", {}, "Créez d'abord une catégorie") : undefined}
          className={`${btnPrimary} flex items-center gap-2`}
        >
          <Plus className="w-4 h-4" /> {t("Admin.products.addProduct", {}, "Ajouter un produit")}
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            aria-label={t("Admin.products.searchPlaceholder", {}, "Rechercher un produit...")}
            className={`${inputClass} ps-9`}
            placeholder={t("Admin.products.searchPlaceholder", {}, "Rechercher un produit...")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select
          aria-label={t("Admin.products.allCategories", {}, "Filtrer par catégorie")}
          className={`${inputClass} max-w-[220px]`}
          value={cat}
          onChange={(e) => setCat(e.target.value)}
        >
          <option value="">{t("Admin.products.allCategories", {}, "Toutes les catégories")}</option>
          {categories.items.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <ErrorBox
          message={error}
          onRetry={() => {
            products.reload();
            categories.reload();
            groups.reload();
          }}
        />
      )}
      {actionError && <ErrorBox message={actionError} />}

      <div className={`${card} overflow-x-auto`}>
        <table className="w-full text-sm text-start">
          <thead>
            <tr className="text-start text-gray-500 border-b border-gray-100">
              <th className="px-4 py-3 font-semibold text-start">{t("Admin.products.tableHeaderProduct", {}, "Produit")}</th>
              <th className="px-4 py-3 font-semibold text-start">{t("Admin.products.tableHeaderCategory", {}, "Catégorie")}</th>
              <th className="px-4 py-3 font-semibold text-start">{t("Admin.products.tableHeaderPrice", {}, "Prix")}</th>
              <th className="px-4 py-3 font-semibold text-start">{t("Admin.products.tableHeaderOptions", {}, "Options")}</th>
              <th className="px-4 py-3 font-semibold text-start">{t("Admin.products.tableHeaderAvailable", {}, "Dispo")}</th>
              <th className="px-4 py-3 font-semibold text-start">{t("Admin.products.tableHeaderVisible", {}, "Visible")}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {products.loading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  {t("Admin.products.loading", {}, "Chargement...")}
                </td>
              </tr>
            )}
            {!products.loading && visible.length === 0 && !products.error && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  {t("Admin.products.emptyProducts", {}, "Aucun produit.")}
                </td>
              </tr>
            )}
            {visible.map((p) => (
              <tr key={p.id} className="border-b border-gray-100 last:border-0">
                <td className="px-4 py-3 text-start">
                  <div className="flex items-center gap-3">
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imageUrl} alt="" className="w-12 h-12 rounded-xl object-cover flex-none" />
                    ) : (
                      <div
                        aria-hidden="true"
                        className="w-12 h-12 rounded-xl flex-none bg-gradient-to-br from-orange-100 to-gray-200 text-orange-600 font-extrabold flex items-center justify-center"
                      >
                        {p.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900">{p.name}</p>
                      {p.description && <p className="text-xs text-gray-500 line-clamp-1">{p.description}</p>}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-700 text-start">{p.categoryName}</td>
                <td className="px-4 py-3 font-semibold text-orange-600 whitespace-nowrap text-start">
                  {formatPrice(p.price)}
                </td>
                <td className="px-4 py-3 text-start">
                  {p.groupIds.length ? (
                    <Badge>{t("Admin.products.groupCountBadge", { count: p.groupIds.length }, `${p.groupIds.length} groupe(s)`)}</Badge>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-start">
                  <Toggle
                    checked={p.available}
                    onChange={() => quickToggle(p, "available")}
                    label={t("Admin.products.labelAvailable", { name: p.name }, `Disponible : ${p.name}`)}
                  />
                </td>
                <td className="px-4 py-3 text-start">
                  <Toggle
                    checked={p.isActive}
                    onChange={() => quickToggle(p, "isActive")}
                    label={t("Admin.products.labelVisible", { name: p.name }, `Visible : ${p.name}`)}
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => open(p)}
                      aria-label={t("Admin.products.labelEdit", { name: p.name }, `Modifier ${p.name}`)}
                      className={btnGhost}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setProductToDelete(p)}
                      aria-label={t("Admin.products.labelDelete", { name: p.name }, `Supprimer ${p.name}`)}
                      className={btnDanger}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {form && (
        <Modal
          title={form.id ? t("Admin.products.editProduct", {}, "Modifier le produit") : t("Admin.products.addProduct", {}, "Ajouter un produit")}
          wide
          onClose={() => setForm(null)}
          footer={
            <>
              <button type="button" onClick={() => setForm(null)} className={btnGhost}>
                {t("common.cancel", {}, "Annuler")}
              </button>
              <button type="submit" form="product-form" disabled={busy} className={btnPrimary}>
                {busy ? t("common.saving", {}, "Enregistrement...") : t("common.save", {}, "Enregistrer")}
              </button>
            </>
          }
        >
          <form id="product-form" onSubmit={save} noValidate className="space-y-4">
            {formError.message && <ErrorBox message={formError.message} />}
            <Field label={t("Admin.products.name", {}, "Nom")} error={formError.fields.name}>
              <input
                className={inputClass}
                value={form.values.name}
                onChange={(e) => set("name", e.target.value)}
                maxLength={120}
              />
            </Field>
            <Field label={t("Admin.products.description", {}, "Description (facultatif)")} error={formError.fields.description}>
              <textarea
                className={`${inputClass} resize-none`}
                rows={2}
                value={form.values.description}
                onChange={(e) => set("description", e.target.value)}
                maxLength={500}
              />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={t("Admin.products.price", {}, "Prix (DA)")} error={formError.fields.price}>
                <input
                  className={inputClass}
                  type="number"
                  min={0}
                  value={form.values.price}
                  onChange={(e) => set("price", e.target.value)}
                />
              </Field>
              <Field label={t("Admin.products.category", {}, "Catégorie")} error={formError.fields.categoryId}>
                <select
                  className={inputClass}
                  value={form.values.categoryId}
                  onChange={(e) => set("categoryId", e.target.value)}
                >
                  {categories.items.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <CloudinaryImagePicker
              value={form.values.imageUrl}
              onChange={(url) => set("imageUrl", url)}
              folder="blackhousse/products"
              error={formError.fields.imageUrl}
            />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              <Field label={t("Admin.products.sortOrder", {}, "Ordre d'affichage")} error={formError.fields.sortOrder}>
                <input
                  className={inputClass}
                  type="number"
                  value={form.values.sortOrder}
                  onChange={(e) => set("sortOrder", e.target.value)}
                />
              </Field>
              <div className="flex items-center justify-between gap-3 pb-2">
                <span className="text-sm font-semibold text-gray-900">{t("Admin.products.available", {}, "Disponible")}</span>
                <Toggle
                  checked={form.values.available}
                  onChange={(v) => set("available", v)}
                  label={t("Admin.products.available", {}, "Disponible")}
                />
              </div>
              <div className="flex items-center justify-between gap-3 pb-2">
                <span className="text-sm font-semibold text-gray-900">{t("Admin.products.active", {}, "Visible")}</span>
                <Toggle
                  checked={form.values.isActive}
                  onChange={(v) => set("isActive", v)}
                  label={t("Admin.products.active", {}, "Visible")}
                />
              </div>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold text-gray-900">
                {t("Admin.products.formProductGroupsLegend", {}, "Groupes d'options du produit")}
              </legend>
              <p className="text-xs text-gray-500">
                {t("Admin.products.formProductGroupsHint", {}, "Seuls les groupes cochés seront proposés au client pour ce produit (taille, sauces, suppléments...).")}
              </p>
              {groups.items.length === 0 && (
                <p className="text-sm text-gray-500">
                  {t("Admin.products.noGroupsYet", {}, "Aucun groupe d'options. Créez-en dans l'onglet « Options ».")}
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {groups.items.map((g) => {
                  const on = form.values.groupIds.includes(g.id);
                  return (
                    <label
                      key={g.id}
                      className={`flex items-center gap-3 rounded-2xl border px-4 py-2.5 cursor-pointer text-sm ${
                        on
                          ? "border-orange-500 bg-orange-50"
                          : "border-gray-200 bg-white hover:border-orange-300"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggleGroup(g.id)}
                        className="w-4 h-4 accent-orange-500"
                      />
                      <span className="flex-1 font-semibold text-gray-900">{g.name}</span>
                      <span className="text-xs text-gray-500">
                        {g.selection === "SINGLE"
                          ? t("Admin.options.single", {}, "1 choix")
                          : t("Admin.options.multiple", {}, "multiple")}
                      </span>
                    </label>
                  );
                })}
              </div>
              {formError.fields.groupIds && (
                <p role="alert" className="text-xs font-semibold text-red-600">
                  {t("Admin.products.invalidGroups", {}, "Groupes invalides.")}
                </p>
              )}
            </fieldset>
          </form>
        </Modal>
      )}

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog open={Boolean(productToDelete)} onOpenChange={(open) => !open && setProductToDelete(null)}>
        <AlertDialogContent className="bg-white border border-gray-200">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-900 font-bold text-lg">
              {t("Admin.products.deleteModalTitle", {}, "Supprimer le produit")}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600 text-sm">
              {t("Admin.products.deleteConfirm", { name: productToDelete?.name }, `Supprimer « ${productToDelete?.name} » ? Les anciennes commandes gardent leur copie. (Vous pouvez aussi simplement le masquer.)`)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex gap-2 justify-end">
            <AlertDialogCancel disabled={deleting} className="border-gray-300 text-gray-700 hover:bg-gray-100">
              {t("common.cancel", {}, "Annuler")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={handleConfirmDelete}
              className="bg-red-600 text-white hover:bg-red-700 font-bold flex items-center gap-2"
            >
              {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{deleting ? t("common.deleting", {}, "Suppression...") : t("common.delete", {}, "Supprimer")}</span>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
