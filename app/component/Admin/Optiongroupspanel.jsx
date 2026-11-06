"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2, Loader2 } from "lucide-react";
import { api, useList } from "./adminApi";
import { Badge, ErrorBox, Field, Modal, Toggle, btnDanger, btnGhost, btnPrimary, card, inputClass } from "./Ui";
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

const BLANK_OPTION = { name: "", price: "0", available: true, isActive: true };

export default function OptionGroupsPanel() {
  const { t, formatPrice } = useI18n();
  const { items, loading, error, reload } = useList("/api/admin/option-groups");
  const [form, setForm] = useState(null); // { id?, values }
  const [formError, setFormError] = useState({ message: "", fields: {} });
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [groupToDelete, setGroupToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const open = (g) => {
    setFormError({ message: "", fields: {} });
    setForm({
      id: g?.id,
      values: g
        ? {
            name: g.name,
            selection: g.selection,
            required: g.required,
            minSelect: String(g.minSelect),
            maxSelect: g.maxSelect == null ? "" : String(g.maxSelect),
            options: g.options.map((o) => ({ ...o, price: String(o.price) })),
          }
        : {
            name: "",
            selection: "SINGLE",
            required: false,
            minSelect: "0",
            maxSelect: "",
            options: [{ ...BLANK_OPTION }],
          },
    });
  };
  const set = (key, value) => setForm((s) => ({ ...s, values: { ...s.values, [key]: value } }));
  const setOption = (i, patch) =>
    set("options", form.values.options.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));

  const save = async (e) => {
    e.preventDefault();
    if (busy) return;
    const v = form.values;
    setBusy(true);
    setFormError({ message: "", fields: {} });
    const body = {
      name: v.name.trim(),
      selection: v.selection,
      required: v.required,
      minSelect: v.selection === "MULTIPLE" ? Number(v.minSelect || 0) : 0,
      maxSelect: v.selection === "MULTIPLE" && v.maxSelect !== "" ? Number(v.maxSelect) : null,
      options: v.options.map((o) => ({
        id: o.id,
        name: o.name.trim(),
        price: o.price === "" ? 0 : Number(o.price),
        available: o.available,
        isActive: o.isActive,
      })),
    };
    try {
      if (form.id) await api.put(`/api/admin/option-groups/${form.id}`, body);
      else await api.post("/api/admin/option-groups", body);
      setForm(null);
      reload(true);
    } catch (err) {
      setFormError({ message: err.message, fields: err.fields || {} });
    } finally {
      setBusy(false);
    }
  };

  const toggleOption = async (o) => {
    setActionError("");
    try {
      await api.patch(`/api/admin/options/${o.id}`, { available: !o.available });
      reload(true);
    } catch (err) {
      setActionError(err.message);
    }
  };

  const handleConfirmDelete = async () => {
    if (!groupToDelete) return;
    setDeleting(true);
    setActionError("");
    try {
      await api.del(`/api/admin/option-groups/${groupToDelete.id}`);
      setGroupToDelete(null);
      reload(true);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const rule = (g) =>
    g.selection === "SINGLE"
      ? g.required
        ? t("Admin.options.ruleSingleRequired", {}, "1 choix obligatoire")
        : t("Admin.options.ruleSingleOptional", {}, "1 choix facultatif")
      : t(
          "Admin.options.ruleMultiple",
          {
            req: g.required
              ? t("Admin.options.requiredText", {}, "Obligatoire")
              : t("Admin.options.optionalText", {}, "Facultatif"),
            min: g.minSelect > 0 ? t("Admin.options.minText", { min: g.minSelect }, `min ${g.minSelect} · `) : "",
            max:
              g.maxSelect == null
                ? t("Admin.options.unlimitedText", {}, "illimité")
                : t("Admin.options.maxText", { max: g.maxSelect }, `max ${g.maxSelect}`),
          },
          `${g.required ? "Obligatoire" : "Facultatif"} · ${g.minSelect > 0 ? `min ${g.minSelect} · ` : ""}${g.maxSelect == null ? "illimité" : `max ${g.maxSelect}`}`
        );

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-900">{t("Admin.options.title", {}, "Groupes d'options")}</h2>
          <p className="text-sm text-gray-600">
            {t("Admin.options.subtitle", {}, "Taille, viande, sauces, suppléments... Un groupe se réutilise sur plusieurs produits.")}
          </p>
        </div>
        <button type="button" onClick={() => open(null)} className={`${btnPrimary} flex items-center gap-2`}>
          <Plus className="w-4 h-4" /> {t("Admin.options.addGroup", {}, "Ajouter un groupe")}
        </button>
      </div>

      {error && <ErrorBox message={error} onRetry={() => reload()} />}
      {actionError && <ErrorBox message={actionError} />}
      {loading && <p className="text-gray-500">{t("Admin.options.loading", {}, "Chargement...")}</p>}
      {!loading && items.length === 0 && !error && (
        <p className="text-gray-500">{t("Admin.options.emptyGroups", {}, "Aucun groupe d'options.")}</p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {items.map((g) => (
          <article key={g.id} className={`${card} p-5 space-y-3`}>
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <h3 className="text-lg font-extrabold text-gray-900">{g.name}</h3>
                <div className="flex flex-wrap gap-2">
                  <Badge tone="orange">
                    {g.selection === "SINGLE"
                      ? t("Admin.options.singleChoiceOption", {}, "Choix unique")
                      : t("Admin.options.multipleChoiceOption", {}, "Choix multiple")}
                  </Badge>
                  <Badge>{rule(g)}</Badge>
                  <Badge>{t("Admin.options.productCountBadge", { count: g.productCount }, `${g.productCount} produit(s)`)}</Badge>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => open(g)}
                  aria-label={t("Admin.products.labelEdit", { name: g.name }, `Modifier ${g.name}`)}
                  className={btnGhost}
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setGroupToDelete(g)}
                  aria-label={t("Admin.products.labelDelete", { name: g.name }, `Supprimer ${g.name}`)}
                  className={btnDanger}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <ul className="divide-y divide-gray-100">
              {g.options.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className={o.available ? "text-gray-900 font-semibold" : "text-gray-400 line-through"}>
                    {o.name}
                  </span>
                  <span className="flex items-center gap-4">
                    <span className="text-gray-600 font-medium">
                      {o.price > 0 ? `+ ${formatPrice(o.price)}` : t("Admin.options.freeOption", {}, "gratuit")}
                    </span>
                    <Toggle
                      checked={o.available}
                      onChange={() => toggleOption(o)}
                      label={t("Admin.products.labelAvailable", { name: o.name }, `Disponible : ${o.name}`)}
                    />
                  </span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      {form && (
        <Modal
          title={form.id ? t("Admin.options.editGroup", {}, "Modifier le groupe") : t("Admin.options.addGroup", {}, "Ajouter un groupe")}
          wide
          onClose={() => setForm(null)}
          footer={
            <>
              <button type="button" onClick={() => setForm(null)} className={btnGhost}>
                {t("common.cancel", {}, "Annuler")}
              </button>
              <button type="submit" form="group-form" disabled={busy} className={btnPrimary}>
                {busy ? t("common.saving", {}, "Enregistrement...") : t("common.save", {}, "Enregistrer")}
              </button>
            </>
          }
        >
          <form id="group-form" onSubmit={save} noValidate className="space-y-4">
            {formError.message && <ErrorBox message={formError.message} />}
            <Field label={t("Admin.options.name", {}, "Nom du groupe")} error={formError.fields.name}>
              <input
                className={inputClass}
                value={form.values.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder={t("Admin.options.groupNamePlaceholder", {}, "Ex : Sauces")}
                maxLength={80}
              />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
              <Field label={t("Admin.options.selectionType", {}, "Type de choix")}>
                <select
                  className={inputClass}
                  value={form.values.selection}
                  onChange={(e) => set("selection", e.target.value)}
                >
                  <option value="SINGLE">{t("Admin.options.singleChoiceOption", {}, "Un seul choix (ex : taille)")}</option>
                  <option value="MULTIPLE">{t("Admin.options.multipleChoiceOption", {}, "Plusieurs choix (ex : sauces)")}</option>
                </select>
              </Field>
              <div className="flex items-center justify-between gap-3 pb-2">
                <span className="text-sm font-semibold text-gray-900">{t("Admin.options.requiredText", {}, "Obligatoire")}</span>
                <Toggle
                  checked={form.values.required}
                  onChange={(v) => set("required", v)}
                  label={t("Admin.options.requiredText", {}, "Obligatoire")}
                />
              </div>
            </div>
            {form.values.selection === "MULTIPLE" && (
              <div className="grid grid-cols-2 gap-4">
                <Field label={t("Admin.options.minimumLabel", {}, "Minimum")} error={formError.fields.minSelect}>
                  <input
                    className={inputClass}
                    type="number"
                    min={0}
                    value={form.values.minSelect}
                    onChange={(e) => set("minSelect", e.target.value)}
                  />
                </Field>
                <Field
                  label={t("Admin.options.maximumLabel", {}, "Maximum")}
                  hint={t("Admin.options.maximumHint", {}, "Vide = illimité")}
                  error={formError.fields.maxSelect}
                >
                  <input
                    className={inputClass}
                    type="number"
                    min={1}
                    value={form.values.maxSelect}
                    onChange={(e) => set("maxSelect", e.target.value)}
                  />
                </Field>
              </div>
            )}

            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold text-gray-900">
                {t("Admin.options.optionsList", {}, "Options")}
              </legend>
              {formError.fields.options && typeof formError.fields.options === "string" && (
                <p role="alert" className="text-xs font-semibold text-red-600">
                  {formError.fields.options}
                </p>
              )}
              {form.values.options.map((o, i) => {
                const err = formError.fields[`options.${i}`];
                return (
                  <div key={o.id ?? `new-${i}`} className="grid grid-cols-[1fr_110px_auto_auto] gap-2 items-center">
                    <input
                      aria-label={`${t("Admin.options.optionNamePlaceholder", {}, "Nom")} ${i + 1}`}
                      className={`${inputClass} ${err?.name ? "border-red-400" : ""}`}
                      placeholder={t("Admin.options.optionNamePlaceholder", {}, "Nom")}
                      value={o.name}
                      onChange={(e) => setOption(i, { name: e.target.value })}
                      maxLength={80}
                    />
                    <input
                      aria-label={`${t("Admin.options.optionPricePlaceholder", {}, "Prix +")} ${i + 1}`}
                      className={`${inputClass} ${err?.price ? "border-red-400" : ""}`}
                      type="number"
                      min={0}
                      placeholder={t("Admin.options.optionPricePlaceholder", {}, "Prix +")}
                      value={o.price}
                      onChange={(e) => setOption(i, { price: e.target.value })}
                    />
                    <Toggle
                      checked={o.available}
                      onChange={(v) => setOption(i, { available: v })}
                      label={`${t("Admin.products.tableHeaderAvailable", {}, "Disponible")} ${i + 1}`}
                    />
                    <button
                      type="button"
                      aria-label={`${t("common.delete", {}, "Supprimer")} ${i + 1}`}
                      onClick={() => set("options", form.values.options.filter((_, idx) => idx !== i))}
                      className={btnDanger}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
              <button
                type="button"
                onClick={() => set("options", [...form.values.options, { ...BLANK_OPTION }])}
                className={`${btnGhost} flex items-center gap-2`}
              >
                <Plus className="w-4 h-4" /> {t("Admin.options.addOptionBtn", {}, "Ajouter une option")}
              </button>
              <p className="text-xs text-gray-500">
                {t("Admin.options.optionsNotice", {}, "Prix = supplément en DA (0 = gratuit). L'interrupteur indique si l'option est en stock.")}
              </p>
            </fieldset>
          </form>
        </Modal>
      )}

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog open={Boolean(groupToDelete)} onOpenChange={(open) => !open && setGroupToDelete(null)}>
        <AlertDialogContent className="bg-white border border-gray-200">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-900 font-bold text-lg">
              {t("Admin.options.deleteModalTitle", {}, "Supprimer le groupe d'options")}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600 text-sm">
              {t("Admin.options.deleteModalDesc", { name: groupToDelete?.name }, `Supprimer le groupe « ${groupToDelete?.name} » et ses options ?`)}
              {groupToDelete?.productCount > 0 && (
                <span className="block mt-2 text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200 text-xs font-semibold">
                  {t("Admin.options.warningUsedBy", { count: groupToDelete.productCount }, `⚠️ Ce groupe est utilisé par ${groupToDelete.productCount} produit(s). Il sera retiré de ces produits.`)}
                </span>
              )}
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
