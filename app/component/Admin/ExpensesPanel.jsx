"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Plus,
  RefreshCw,
  Edit2,
  Trash2,
  Receipt,
  DollarSign,
  TrendingDown,
  AlertCircle,
  Filter,
  Calendar,
  Search,
  Tag,
  ChevronDown,
} from "lucide-react";
import { api, formatPrice, formatDate } from "./adminApi";
import { card, inputClass, btnPrimary, btnGhost, btnDanger, Modal, Field, ErrorBox } from "./Ui";
import { EXPENSE_CATEGORIES } from "@/lib/admin/finance";
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

const PERIOD_PRESETS = [
  { id: "this_month", label: "Ce mois-ci" },
  { id: "today", label: "Aujourd'hui" },
  { id: "yesterday", label: "Hier" },
  { id: "this_week", label: "Cette semaine" },
  { id: "last_month", label: "Mois dernier" },
  { id: "all", label: "Tout l'historique" },
  { id: "custom", label: "Personnalisé" },
];

// Au niveau du module : évite de recréer le select à chaque rendu
const SelectField = ({ icon: Icon, label, value, onChange, className = "", children }) => (
  <div className={`relative ${className}`}>
    <Icon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-500" />
    <select
      aria-label={label}
      value={value}
      onChange={onChange}
      className={`${inputClass} appearance-none cursor-pointer pl-9 pr-9 font-semibold truncate`}
    >
      {children}
    </select>
    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
  </div>
);

export default function ExpensesPanel() {
  const [period, setPeriod] = useState("this_month");
  const [customFrom, setCustomFrom] = useState(() => {
    const d = new Date();
    d.setUTCDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [customTo, setCustomTo] = useState(() => new Date().toISOString().slice(0, 10));

  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [page, setPage] = useState(1);

  const [expenses, setExpenses] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modal states
  const [modalState, setModalState] = useState(null); // 'create' | { ...expense } | null
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [deletingExpense, setDeletingExpense] = useState(null);
  const [deletingLoading, setDeletingLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Form inputs
  const [formAmount, setFormAmount] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategory, setFormCategory] = useState("INGREDIENTS");
  const [formDate, setFormDate] = useState(() => new Date().toISOString().slice(0, 10));

  // Debounce search input
  useEffect(() => {
    const id = setTimeout(() => {
      setSearchDebounced(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(id);
  }, [search]);

  // Compute date params based on period
  const dateParams = useMemo(() => {
    const now = new Date();
    if (period === "today") {
      const t = now.toISOString().slice(0, 10);
      return { from: t, to: t };
    }
    if (period === "yesterday") {
      const y = new Date();
      y.setUTCDate(y.getUTCDate() - 1);
      const t = y.toISOString().slice(0, 10);
      return { from: t, to: t };
    }
    if (period === "this_week") {
      const d = new Date();
      const day = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() - day + 1);
      return { from: d.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
    }
    if (period === "this_month") {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      return { from: d.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
    }
    if (period === "last_month") {
      const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
      const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
      return { from: first.toISOString().slice(0, 10), to: last.toISOString().slice(0, 10) };
    }
    if (period === "custom") {
      return { from: customFrom, to: customTo };
    }
    return {};
  }, [period, customFrom, customTo]);

  // Load expenses from API
  const loadExpenses = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: "15",
        });
        if (searchDebounced) params.set("q", searchDebounced);
        if (category) params.set("category", category);
        if (dateParams.from) params.set("from", dateParams.from);
        if (dateParams.to) params.set("to", dateParams.to);

        const data = await api.get(`/api/admin/expenses?${params.toString()}`);
        setExpenses(data.items || []);
        setTotalCount(data.total || 0);
        setTotalAmount(data.totalAmount || 0);
      } catch (err) {
        setError(err.message || "Erreur lors du chargement des dépenses");
      } finally {
        setLoading(false);
      }
    },
    [page, searchDebounced, category, dateParams]
  );

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setFormAmount("");
    setFormDescription("");
    setFormCategory("INGREDIENTS");
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormError("");
    setModalState("create");
  };

  // Open Edit Modal
  const handleOpenEdit = (exp) => {
    setFormAmount(String(exp.amount));
    setFormDescription(exp.description);
    setFormCategory(exp.category || "AUTRE");
    setFormDate(exp.date ? exp.date.slice(0, 10) : new Date().toISOString().slice(0, 10));
    setFormError("");
    setModalState(exp);
  };

  // Save (Create or Update)
  const handleSaveExpense = async (e) => {
    e.preventDefault();
    setFormError("");

    const parsedAmount = parseInt(formAmount, 10);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setFormError("Veuillez saisir un montant valide supérieur à 0.");
      return;
    }
    if (!formDescription.trim()) {
      setFormError("La description est obligatoire.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        amount: parsedAmount,
        description: formDescription.trim(),
        category: formCategory,
        date: formDate,
      };

      if (modalState === "create") {
        await api.post("/api/admin/expenses", payload);
      } else {
        await api.patch(`/api/admin/expenses/${modalState.id}`, payload);
      }

      setModalState(null);
      await loadExpenses(true);
    } catch (err) {
      setFormError(err.message || "Erreur lors de l'enregistrement de la dépense.");
    } finally {
      setSaving(false);
    }
  };

  // Delete
  const handleDeleteExpense = async () => {
    if (!deletingExpense) return;
    setDeletingLoading(true);
    setDeleteError("");
    try {
      await api.del(`/api/admin/expenses/${deletingExpense.id}`);
      setDeletingExpense(null);
      await loadExpenses(true);
    } catch (err) {
      setDeleteError(err.message || "Erreur lors de la suppression de la dépense.");
    } finally {
      setDeletingLoading(false);
    }
  };

  const pages = Math.max(1, Math.ceil(totalCount / 15));
  const averageAmount = totalCount > 0 ? Math.round(totalAmount / totalCount) : 0;

  return (
    <section className="space-y-3">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className={`${card} p-3 flex items-center gap-3 bg-gradient-to-br from-white to-red-50/40 border-red-100`}>
          <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center flex-none">
            <TrendingDown className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Total Dépensé</p>
            <p className="text-xl font-black text-gray-900">{formatPrice(totalAmount)}</p>
          </div>
        </div>

        <div className={`${card} p-3 flex items-center gap-3 bg-gradient-to-br from-white to-orange-50/40 border-orange-100`}>
          <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center flex-none">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Nombre de Dépenses</p>
            <p className="text-xl font-black text-gray-900">{totalCount}</p>
          </div>
        </div>

        <div className={`${card} p-3 flex items-center gap-3 bg-gradient-to-br from-white to-blue-50/40 border-blue-100`}>
          <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center flex-none">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Dépense Moyenne</p>
            <p className="text-xl font-black text-gray-900">{formatPrice(averageAmount)}</p>
          </div>
        </div>
      </div>

      {/* Recherche + filtres + actions (une seule ligne sur PC) */}
      <div className={`${card} p-2.5 sm:p-3`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 lg:flex lg:flex-wrap lg:items-center">
          {/* Recherche */}
          <div className="relative sm:col-span-2 lg:col-span-1 lg:flex-1 lg:min-w-[200px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              aria-label="Rechercher une dépense"
              placeholder="Rechercher par description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${inputClass} pl-9`}
            />
          </div>

          {/* Période */}
          <SelectField
            icon={Calendar}
            label="Filtrer par période"
            value={period}
            onChange={(e) => {
              setPeriod(e.target.value);
              setPage(1);
            }}
            className="w-full lg:w-48"
          >
            {PERIOD_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </SelectField>

          {/* Catégorie */}
          <SelectField
            icon={Tag}
            label="Filtrer par catégorie"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
            className="w-full lg:w-52"
          >
            <option value="">Toutes les catégories</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </SelectField>

          {/* Dates personnalisées */}
          {period === "custom" && (
            <div className="sm:col-span-2 lg:col-span-1 flex items-center gap-2 w-full lg:w-auto rounded-xl bg-orange-50/60 border border-orange-100 px-2 py-1.5">
              <input
                type="date"
                aria-label="Date de début"
                value={customFrom}
                onChange={(e) => {
                  setCustomFrom(e.target.value);
                  setPage(1);
                }}
                className={`${inputClass} text-xs py-1.5 flex-1 min-w-0 lg:w-36 lg:flex-none`}
              />
              <span className="text-gray-400 text-xs font-bold">→</span>
              <input
                type="date"
                aria-label="Date de fin"
                value={customTo}
                onChange={(e) => {
                  setCustomTo(e.target.value);
                  setPage(1);
                }}
                className={`${inputClass} text-xs py-1.5 flex-1 min-w-0 lg:w-36 lg:flex-none`}
              />
            </div>
          )}

          {/* Actions */}
          <div className="sm:col-span-2 lg:col-span-1 flex items-center gap-2 lg:ml-auto">
            <button
              type="button"
              onClick={handleOpenCreate}
              className={`${btnPrimary} flex flex-1 lg:flex-none items-center justify-center gap-2 text-xs sm:text-sm whitespace-nowrap shadow-md shadow-orange-500/25`}
            >
              <Plus className="w-4 h-4" />
              Nouvelle dépense
            </button>
            <button
              type="button"
              onClick={() => loadExpenses()}
              title="Actualiser"
              aria-label="Actualiser"
              className={`${btnGhost} flex flex-1 lg:flex-none items-center justify-center gap-2 text-xs sm:text-sm whitespace-nowrap`}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              <span className="lg:hidden xl:inline">Actualiser</span>
            </button>
          </div>
        </div>
      </div>

      {error && <ErrorBox message={error} onRetry={() => loadExpenses()} />}

      {/* Expenses Table */}
      <div className={`${card} overflow-hidden shadow-sm`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50/80 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-2.5">Date</th>
                <th className="px-4 py-2.5">Description</th>
                <th className="px-4 py-2.5">Catégorie</th>
                <th className="px-4 py-2.5 text-right">Montant</th>
                <th className="px-4 py-2.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && expenses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-gray-400">
                    Chargement des dépenses...
                  </td>
                </tr>
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-gray-400">
                    Aucune dépense enregistrée sur cette sélection.
                  </td>
                </tr>
              ) : (
                expenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-gray-50/70 transition">
                    <td className="px-4 py-2.5 text-gray-600 font-mono text-xs whitespace-nowrap">
                      {formatDate(exp.date)}
                    </td>
                    <td className="px-4 py-2.5 font-bold text-gray-900">{exp.description}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span
                        style={{
                          color: exp.categoryColor,
                          backgroundColor: `${exp.categoryColor}15`,
                          borderColor: `${exp.categoryColor}40`,
                        }}
                        className="px-2.5 py-1 rounded-full text-xs font-bold border inline-block"
                      >
                        {exp.categoryLabel}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-black text-gray-900 whitespace-nowrap text-base">
                      {formatPrice(exp.amount)}
                    </td>
                    <td className="px-4 py-2.5 text-center whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(exp)}
                          title="Modifier cette dépense"
                          className="p-1.5 rounded-lg border border-gray-200 hover:border-orange-400 hover:text-orange-600 text-gray-600 transition"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeletingExpense(exp);
                            setDeleteError("");
                          }}
                          title="Supprimer cette dépense"
                          className="p-1.5 rounded-lg border border-gray-200 hover:border-red-400 hover:text-red-600 text-gray-600 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100 bg-gray-50/50">
            <span className="text-xs text-gray-500">
              Page {page} sur {pages} ({totalCount} dépense{totalCount > 1 ? "s" : ""})
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className={`${btnGhost} text-xs py-1 px-3`}
              >
                Précédent
              </button>
              <button
                type="button"
                disabled={page >= pages}
                onClick={() => setPage((p) => p + 1)}
                className={`${btnGhost} text-xs py-1 px-3`}
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Expense Modal */}
      {modalState && (
        <Modal
          title={modalState === "create" ? "Ajouter une dépense" : "Modifier la dépense"}
          onClose={() => setModalState(null)}
          footer={
            <>
              <button
                type="button"
                onClick={() => setModalState(null)}
                className={btnGhost}
                disabled={saving}
              >
                Annuler
              </button>
              <button
                type="submit"
                form="expense-form-panel"
                disabled={saving}
                className={`${btnPrimary} flex items-center gap-2`}
              >
                {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
                {modalState === "create" ? "Enregistrer la dépense" : "Sauvegarder"}
              </button>
            </>
          }
        >
          <form id="expense-form-panel" onSubmit={handleSaveExpense} className="space-y-4">
            {formError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-bold text-red-600 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-none" />
                <span>{formError}</span>
              </div>
            )}

            <Field label="Montant en Dinars (DA)">
              <input
                type="number"
                min="1"
                step="1"
                required
                placeholder="Ex: 5000"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                className={`${inputClass} text-lg font-bold font-mono`}
              />
            </Field>

            <Field label="Description">
              <input
                type="text"
                required
                maxLength={250}
                placeholder="Ex: 20kg viande hachée, Facture électricité..."
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                className={inputClass}
              />
            </Field>

            <Field label="Catégorie de charge">
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                className={`${inputClass} font-semibold`}
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Date de la dépense">
              <input
                type="date"
                required
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className={inputClass}
              />
            </Field>
          </form>
        </Modal>
      )}

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog open={Boolean(deletingExpense)} onOpenChange={(open) => { if (!open) { setDeletingExpense(null); setDeleteError(""); } }}>
        <AlertDialogContent className="bg-white border border-gray-200">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-900 font-bold text-lg">
              Confirmer la suppression
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600 text-sm space-y-2">
              <span className="block">
                Êtes-vous sûr de vouloir supprimer cette dépense ?
              </span>
              {deletingExpense && (
                <span className="block p-3.5 rounded-xl bg-gray-50 border border-gray-200 space-y-1">
                  <span className="block font-extrabold text-gray-900">{deletingExpense.description}</span>
                  <span className="block text-sm font-black text-orange-600">{formatPrice(deletingExpense.amount)}</span>
                  <span className="block text-xs text-gray-500">Date : {formatDate(deletingExpense.date)}</span>
                </span>
              )}
              <span className="block text-xs text-gray-500">
                Cette action est irréversible et mettra à jour les calculs de finances et de bénéfice net.
              </span>
              {deleteError && (
                <span className="block text-xs font-semibold text-red-700 bg-red-50 p-2 rounded border border-red-200">
                  {deleteError}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex gap-2 justify-end">
            <AlertDialogCancel
              disabled={deletingLoading}
              className="border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deletingLoading}
              onClick={handleDeleteExpense}
              className="bg-red-600 text-white hover:bg-red-700 font-bold flex items-center gap-2"
            >
              {deletingLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
              {deletingLoading ? "Suppression..." : "Supprimer définitivement"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}