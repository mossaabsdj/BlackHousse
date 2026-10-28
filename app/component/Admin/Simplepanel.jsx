"use client";
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { api, useList } from "./adminApi";
import { Field, Modal, Toggle, ErrorBox, btnDanger, btnGhost, btnPrimary, card, inputClass } from "./Ui";
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

/**
 * Generic CRUD table (used for categories and municipalities).
 * fields:  [{ key, label, type: "text" | "int" | "switch", nullable?, hint? }]
 * columns: [{ key, label, render?(item) }]
 */
export default function SimplePanel({ title, url, columns, fields, blank, addLabel, describeDelete }) {
  const { items, loading, error, reload } = useList(url);
  const [form, setForm] = useState(null); // { id?, values }
  const [formError, setFormError] = useState({ message: "", fields: {} });
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [itemToDelete, setItemToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const open = (item) => {
    setFormError({ message: "", fields: {} });
    setForm({
      id: item?.id,
      values: Object.fromEntries(fields.map((f) => [f.key, item ? (f.type === "switch" ? item[f.key] : item[f.key] ?? "") : blank[f.key] ?? (f.type === "switch" ? true : "")])),
    });
  };

  const buildBody = () =>
    Object.fromEntries(
      fields.map((f) => {
        const v = form.values[f.key];
        if (f.type === "switch") return [f.key, !!v];
        if (f.type === "int") return [f.key, v === "" || v === null ? (f.nullable ? null : undefined) : Number(v)];
        return [f.key, String(v).trim()];
      })
    );

  const save = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setFormError({ message: "", fields: {} });
    try {
      if (form.id) await api.patch(`${url}/${form.id}`, buildBody());
      else await api.post(url, buildBody());
      setForm(null);
      reload(true);
    } catch (err) {
      setFormError({ message: err.message, fields: err.fields || {} });
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (item) => {
    setActionError("");
    try {
      await api.patch(`${url}/${item.id}`, { isActive: !item.isActive });
      reload(true);
    } catch (err) {
      setActionError(err.message);
    }
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    setDeleting(true);
    setActionError("");
    try {
      await api.del(`${url}/${itemToDelete.id}`);
      setItemToDelete(null);
      reload(true);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-2xl font-extrabold text-gray-900">{title}</h2>
        <button type="button" onClick={() => open(null)} className={`${btnPrimary} flex items-center gap-2`}>
          <Plus className="w-4 h-4" /> {addLabel}
        </button>
      </div>

      {error && <ErrorBox message={error} onRetry={() => reload()} />}
      {actionError && <ErrorBox message={actionError} />}

      <div className={`${card} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-100">
              {columns.map((c) => (
                <th key={c.key} className="px-4 py-3 font-semibold">{c.label}</th>
              ))}
              <th className="px-4 py-3 font-semibold">Visible</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={columns.length + 2} className="px-4 py-8 text-center text-gray-500">Chargement...</td></tr>
            )}
            {!loading && items.length === 0 && !error && (
              <tr><td colSpan={columns.length + 2} className="px-4 py-8 text-center text-gray-500">Aucun élément pour le moment.</td></tr>
            )}
            {items.map((item) => (
              <tr key={item.id} className="border-b border-gray-100 last:border-0">
                {columns.map((c) => (
                  <td key={c.key} className="px-4 py-3 text-gray-900">{c.render ? c.render(item) : item[c.key]}</td>
                ))}
                <td className="px-4 py-3"><Toggle checked={item.isActive} onChange={() => toggleActive(item)} label={`Visible : ${item.name}`} /></td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => open(item)} aria-label={`Modifier ${item.name}`} className={btnGhost}><Pencil className="w-4 h-4" /></button>
                    <button type="button" onClick={() => setItemToDelete(item)} aria-label={`Supprimer ${item.name}`} className={btnDanger}><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {form && (
        <Modal
          title={form.id ? "Modifier" : addLabel}
          onClose={() => setForm(null)}
          footer={
            <>
              <button type="button" onClick={() => setForm(null)} className={btnGhost}>Annuler</button>
              <button type="submit" form="simple-form" disabled={busy} className={btnPrimary}>{busy ? "Enregistrement..." : "Enregistrer"}</button>
            </>
          }
        >
          <form id="simple-form" onSubmit={save} className="space-y-4" noValidate>
            {formError.message && <ErrorBox message={formError.message} />}
            {fields.map((f) =>
              f.type === "switch" ? (
                <div key={f.key} className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-gray-900">{f.label}</span>
                  <Toggle checked={!!form.values[f.key]} onChange={(v) => setForm((s) => ({ ...s, values: { ...s.values, [f.key]: v } }))} label={f.label} />
                </div>
              ) : (
                <Field key={f.key} label={f.label} hint={f.hint} error={formError.fields[f.key]}>
                  <input
                    className={inputClass}
                    type={f.type === "int" ? "number" : "text"}
                    min={f.type === "int" ? 0 : undefined}
                    value={form.values[f.key]}
                    onChange={(e) => setForm((s) => ({ ...s, values: { ...s.values, [f.key]: e.target.value } }))}
                  />
                </Field>
              )
            )}
          </form>
        </Modal>
      )}

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog open={Boolean(itemToDelete)} onOpenChange={(open) => !open && setItemToDelete(null)}>
        <AlertDialogContent className="bg-white border border-gray-200">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-900 font-bold text-lg">
              Confirmer la suppression
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600 text-sm">
              {itemToDelete && describeDelete ? describeDelete(itemToDelete) : "Voulez-vous vraiment supprimer cet élément ?"}
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