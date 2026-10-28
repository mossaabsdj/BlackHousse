"use client";
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { api, formatPrice, useList } from "./adminApi";
import { Badge, ErrorBox, Field, Modal, Toggle, btnDanger, btnGhost, btnPrimary, card, inputClass } from "./Ui";
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
        ? { name: g.name, selection: g.selection, required: g.required, minSelect: String(g.minSelect), maxSelect: g.maxSelect == null ? "" : String(g.maxSelect), options: g.options.map((o) => ({ ...o, price: String(o.price) })) }
        : { name: "", selection: "SINGLE", required: false, minSelect: "0", maxSelect: "", options: [{ ...BLANK_OPTION }] },
    });
  };
  const set = (key, value) => setForm((s) => ({ ...s, values: { ...s.values, [key]: value } }));
  const setOption = (i, patch) => set("options", form.values.options.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));

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
      options: v.options.map((o) => ({ id: o.id, name: o.name.trim(), price: o.price === "" ? 0 : Number(o.price), available: o.available, isActive: o.isActive })),
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
    g.selection === "SINGLE" ? (g.required ? "1 choix obligatoire" : "1 choix facultatif") : `${g.required ? "Obligatoire" : "Facultatif"} · ${g.minSelect > 0 ? `min ${g.minSelect} · ` : ""}${g.maxSelect == null ? "illimité" : `max ${g.maxSelect}`}`;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-900">Groupes d'options</h2>
          <p className="text-sm text-gray-600">Taille, viande, sauces, suppléments... Un groupe se réutilise sur plusieurs produits.</p>
        </div>
        <button type="button" onClick={() => open(null)} className={`${btnPrimary} flex items-center gap-2`}><Plus className="w-4 h-4" /> Ajouter un groupe</button>
      </div>

      {error && <ErrorBox message={error} onRetry={() => reload()} />}
      {actionError && <ErrorBox message={actionError} />}
      {loading && <p className="text-gray-500">Chargement...</p>}
      {!loading && items.length === 0 && !error && <p className="text-gray-500">Aucun groupe d'options.</p>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {items.map((g) => (
          <article key={g.id} className={`${card} p-5 space-y-3`}>
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <h3 className="text-lg font-extrabold text-gray-900">{g.name}</h3>
                <div className="flex flex-wrap gap-2">
                  <Badge tone="orange">{g.selection === "SINGLE" ? "Choix unique" : "Choix multiple"}</Badge>
                  <Badge>{rule(g)}</Badge>
                  <Badge>{g.productCount} produit(s)</Badge>
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => open(g)} aria-label={`Modifier ${g.name}`} className={btnGhost}><Pencil className="w-4 h-4" /></button>
                <button type="button" onClick={() => setGroupToDelete(g)} aria-label={`Supprimer ${g.name}`} className={btnDanger}><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
            <ul className="divide-y divide-gray-100">
              {g.options.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className={o.available ? "text-gray-900" : "text-gray-400 line-through"}>{o.name}</span>
                  <span className="flex items-center gap-4">
                    <span className="text-gray-600">{o.price > 0 ? `+ ${formatPrice(o.price)}` : "gratuit"}</span>
                    <Toggle checked={o.available} onChange={() => toggleOption(o)} label={`Disponible : ${o.name}`} />
                  </span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      {form && (
        <Modal
          title={form.id ? "Modifier le groupe" : "Ajouter un groupe"}
          wide
          onClose={() => setForm(null)}
          footer={
            <>
              <button type="button" onClick={() => setForm(null)} className={btnGhost}>Annuler</button>
              <button type="submit" form="group-form" disabled={busy} className={btnPrimary}>{busy ? "Enregistrement..." : "Enregistrer"}</button>
            </>
          }
        >
          <form id="group-form" onSubmit={save} noValidate className="space-y-4">
            {formError.message && <ErrorBox message={formError.message} />}
            <Field label="Nom du groupe" error={formError.fields.name}><input className={inputClass} value={form.values.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex : Sauces" maxLength={80} /></Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
              <Field label="Type de choix">
                <select className={inputClass} value={form.values.selection} onChange={(e) => set("selection", e.target.value)}>
                  <option value="SINGLE">Un seul choix (ex : taille)</option>
                  <option value="MULTIPLE">Plusieurs choix (ex : sauces)</option>
                </select>
              </Field>
              <div className="flex items-center justify-between gap-3 pb-2"><span className="text-sm font-semibold text-gray-900">Obligatoire</span><Toggle checked={form.values.required} onChange={(v) => set("required", v)} label="Obligatoire" /></div>
            </div>
            {form.values.selection === "MULTIPLE" && (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Minimum" error={formError.fields.minSelect}><input className={inputClass} type="number" min={0} value={form.values.minSelect} onChange={(e) => set("minSelect", e.target.value)} /></Field>
                <Field label="Maximum" hint="Vide = illimité" error={formError.fields.maxSelect}><input className={inputClass} type="number" min={1} value={form.values.maxSelect} onChange={(e) => set("maxSelect", e.target.value)} /></Field>
              </div>
            )}

            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold text-gray-900">Options</legend>
              {formError.fields.options && typeof formError.fields.options === "string" && <p role="alert" className="text-xs font-semibold text-red-600">Liste d'options invalide.</p>}
              {form.values.options.map((o, i) => {
                const err = formError.fields[`options.${i}`];
                return (
                  <div key={o.id ?? `new-${i}`} className="grid grid-cols-[1fr_110px_auto_auto] gap-2 items-center">
                    <input aria-label={`Nom de l'option ${i + 1}`} className={`${inputClass} ${err?.name ? "border-red-400" : ""}`} placeholder="Nom" value={o.name} onChange={(e) => setOption(i, { name: e.target.value })} maxLength={80} />
                    <input aria-label={`Prix de l'option ${i + 1}`} className={`${inputClass} ${err?.price ? "border-red-400" : ""}`} type="number" min={0} placeholder="Prix +" value={o.price} onChange={(e) => setOption(i, { price: e.target.value })} />
                    <Toggle checked={o.available} onChange={(v) => setOption(i, { available: v })} label={`Disponible : option ${i + 1}`} />
                    <button type="button" aria-label={`Retirer l'option ${i + 1}`} onClick={() => set("options", form.values.options.filter((_, idx) => idx !== i))} className={btnDanger}><Trash2 className="w-4 h-4" /></button>
                  </div>
                );
              })}
              <button type="button" onClick={() => set("options", [...form.values.options, { ...BLANK_OPTION }])} className={`${btnGhost} flex items-center gap-2`}><Plus className="w-4 h-4" /> Ajouter une option</button>
              <p className="text-xs text-gray-500">Prix = supplément en DA (0 = gratuit). L'interrupteur indique si l'option est en stock.</p>
            </fieldset>
          </form>
        </Modal>
      )}

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog open={Boolean(groupToDelete)} onOpenChange={(open) => !open && setGroupToDelete(null)}>
        <AlertDialogContent className="bg-white border border-gray-200">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-900 font-bold text-lg">
              Supprimer le groupe d'options
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600 text-sm">
              Supprimer le groupe « <span className="font-semibold text-gray-900">{groupToDelete?.name}</span> » et ses options ?
              {groupToDelete?.productCount > 0 && (
                <span className="block mt-2 text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200 text-xs font-semibold">
                  ⚠️ Ce groupe est utilisé par {groupToDelete.productCount} produit(s). Il sera retiré de ces produits.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex gap-2 justify-end">
            <AlertDialogCancel disabled={deleting} className="border-gray-300 text-gray-700 hover:bg-gray-100">
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={handleConfirmDelete}
              className="bg-red-600 text-white hover:bg-red-700 font-bold"
            >
              {deleting ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}