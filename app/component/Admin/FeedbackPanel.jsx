"use client";

import { useEffect, useState, useCallback } from "react";
import {
  MessageSquare,
  CheckCircle2,
  XCircle,
  Clock,
  Trash2,
  RefreshCw,
  Loader2,
  Search,
  Star,
  Filter,
  AlertCircle,
  ThumbsUp,
  ThumbsDown,
  Check,
  X,
} from "lucide-react";
import { api, formatDate } from "./adminApi";
import { card, inputClass, btnPrimary, btnGhost, btnDanger, Modal } from "./Ui";
import { useRealtimeFeedback } from "@/lib/Firebase";
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

function Burgers({ value, className = "" }) {
  return (
    <span className={`inline-flex gap-0.5 text-base ${className}`} aria-label={`${value} / 5`}>
      {[1, 2, 3, 4, 5].map((v) => (
        <span key={v} className={v <= Math.round(value) ? "" : "opacity-25 grayscale"}>
          🍔
        </span>
      ))}
    </span>
  );
}

export default function FeedbackPanel() {
  const [statusFilter, setStatusFilter] = useState("ALL"); // ALL | PENDING | APPROVED | REJECTED
  const [ratingFilter, setRatingFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(12);

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0, total: 0 });
  const [overallStats, setOverallStats] = useState({ avg: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [error, setError] = useState("");

  const [deletingId, setDeletingId] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Fetch feedback data from admin API
  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const sp = new URLSearchParams();
      if (statusFilter !== "ALL") sp.set("status", statusFilter);
      if (ratingFilter) sp.set("rating", ratingFilter);
      if (search.trim()) sp.set("q", search.trim());
      sp.set("page", String(page));
      sp.set("pageSize", String(pageSize));

      const res = await api.get(`/api/admin/feedback?${sp.toString()}`);
      setItems(res.items || []);
      setTotal(res.total || 0);
      setCounts(res.counts || { pending: 0, approved: 0, rejected: 0, total: 0 });
      setOverallStats(res.overallStats || { avg: 0, total: 0 });
    } catch (err) {
      console.error("[FeedbackPanel] fetch error:", err);
      setError(err?.message || "Impossible de charger les avis.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, ratingFilter, search, page, pageSize]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Real-time listener for new feedback or moderation updates
  useRealtimeFeedback({
    onNewFeedback: () => loadData(),
    onFeedbackStatusChange: () => loadData(),
  });

  // Handle status update (APPROVE / REJECT)
  const handleUpdateStatus = async (id, newStatus) => {
    setActionLoading((prev) => ({ ...prev, [id]: true }));
    try {
      await api.patch(`/api/admin/feedback/${id}`, { status: newStatus });
      // Optimistic local update
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: newStatus } : item))
      );
      // Reload counters
      loadData();
    } catch (err) {
      alert(err?.message || "Erreur lors de la mise à jour du statut.");
    } finally {
      setActionLoading((prev) => ({ ...prev, [id]: false }));
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!deletingId) return;
    setDeleteLoading(true);
    setDeleteError("");
    try {
      await api.del(`/api/admin/feedback/${deletingId}`);
      setDeletingId(null);
      loadData();
    } catch (err) {
      setDeleteError(err?.message || "Erreur lors de la suppression de l'avis.");
    } finally {
      setDeleteLoading(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      {/* 1. Header & KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* En attente */}
        <div
          onClick={() => {
            setStatusFilter("PENDING");
            setPage(1);
          }}
          className={`${card} p-5 cursor-pointer transition hover:border-amber-400 hover:shadow-lg ${
            statusFilter === "PENDING" ? "ring-2 ring-amber-500 border-amber-500 bg-amber-50/30" : ""
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
              En attente de modération
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center font-bold">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-gray-900">{counts.pending}</span>
            <span className="text-xs text-gray-500">avis à traiter</span>
          </div>
          {counts.pending > 0 && (
            <p className="text-[11px] font-semibold text-amber-700 mt-1 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              Action requise
            </p>
          )}
        </div>

        {/* Approuvés */}
        <div
          onClick={() => {
            setStatusFilter("APPROVED");
            setPage(1);
          }}
          className={`${card} p-5 cursor-pointer transition hover:border-emerald-400 hover:shadow-lg ${
            statusFilter === "APPROVED" ? "ring-2 ring-emerald-500 border-emerald-500 bg-emerald-50/30" : ""
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              Commentaires approuvés
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-gray-900">{counts.approved}</span>
            <span className="text-xs text-gray-500">visibles en ligne</span>
          </div>
          <p className="text-[11px] text-gray-500 mt-1">Affichés sur le site</p>
        </div>

        {/* Rejetés */}
        <div
          onClick={() => {
            setStatusFilter("REJECTED");
            setPage(1);
          }}
          className={`${card} p-5 cursor-pointer transition hover:border-rose-400 hover:shadow-lg ${
            statusFilter === "REJECTED" ? "ring-2 ring-rose-500 border-rose-500 bg-rose-50/30" : ""
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-700">
              Commentaires rejetés
            </span>
            <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center font-bold">
              <XCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-gray-900">{counts.rejected}</span>
            <span className="text-xs text-gray-500">masqués</span>
          </div>
          <p className="text-[11px] text-gray-500 mt-1">Non visibles au public</p>
        </div>

        {/* Note globale moyenne */}
        <div
          onClick={() => {
            setStatusFilter("ALL");
            setPage(1);
          }}
          className={`${card} p-5 cursor-pointer transition hover:border-orange-400 hover:shadow-lg ${
            statusFilter === "ALL" ? "ring-2 ring-orange-500 border-orange-500 bg-orange-50/30" : ""
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-orange-700">
              Note moyenne globale
            </span>
            <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
              <Star className="w-5 h-5 fill-orange-500 text-orange-500" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-gray-900">
              {overallStats.avg ? overallStats.avg.toFixed(1).replace(".", ",") : "0,0"}
            </span>
            <span className="text-xs text-gray-500">/ 5 ({overallStats.total} notes)</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            <Burgers value={overallStats.avg} className="text-xs" />
            <span className="text-[10px] text-gray-500 font-medium">calculée sur toutes les notes</span>
          </div>
        </div>
      </div>

      {/* 2. Filters & Search Bar */}
      <div className={`${card} p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4`}>
        {/* Status Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: "ALL", label: "Tous", count: counts.total },
            { id: "PENDING", label: "En attente", count: counts.pending },
            { id: "APPROVED", label: "Approuvés", count: counts.approved },
            { id: "REJECTED", label: "Rejetés", count: counts.rejected },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setStatusFilter(tab.id);
                setPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-2 ${
                statusFilter === tab.id
                  ? "bg-orange-500 text-white shadow-md shadow-orange-500/25"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  statusFilter === tab.id ? "bg-white/20 text-white" : "bg-gray-200 text-gray-700"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Rating & Search controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Note Filter */}
          <div className="relative">
            <select
              value={ratingFilter}
              onChange={(e) => {
                setRatingFilter(e.target.value);
                setPage(1);
              }}
              className={`${inputClass} text-xs py-2 pr-8 pl-3 font-semibold`}
            >
              <option value="">Toutes les notes</option>
              <option value="5">5 burgers (🍔🍔🍔🍔🍔)</option>
              <option value="4">4 burgers (🍔🍔🍔🍔)</option>
              <option value="3">3 burgers (🍔🍔🍔)</option>
              <option value="2">2 burgers (🍔🍔)</option>
              <option value="1">1 burger (🍔)</option>
            </select>
          </div>

          {/* Search input */}
          <div className="relative flex-1 sm:w-60">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Rechercher client ou mot-clé..."
              className={`${inputClass} pl-9 text-xs py-2`}
            />
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={loadData}
            title="Rafraîchir"
            className="p-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-100 text-gray-600 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-orange-500" : ""}`} />
          </button>
        </div>
      </div>

      {/* 3. Feedback Items List */}
      {error ? (
        <div className={`${card} p-8 text-center text-red-600 space-y-2`}>
          <AlertCircle className="w-8 h-8 mx-auto" />
          <p className="font-bold">{error}</p>
          <button type="button" onClick={loadData} className={`${btnGhost} text-xs mt-2`}>
            Réessayer
          </button>
        </div>
      ) : loading && items.length === 0 ? (
        <div className={`${card} p-12 text-center text-gray-500 space-y-3`}>
          <RefreshCw className="w-8 h-8 mx-auto animate-spin text-orange-500" />
          <p className="text-sm font-semibold">Chargement des avis clients...</p>
        </div>
      ) : items.length === 0 ? (
        <div className={`${card} p-12 text-center text-gray-500 space-y-3`}>
          <MessageSquare className="w-10 h-10 mx-auto text-gray-300" />
          <p className="text-base font-bold text-gray-700">Aucun avis trouvé</p>
          <p className="text-xs text-gray-400 max-w-sm mx-auto">
            {statusFilter === "PENDING"
              ? "Aucun commentaire en attente de modération pour le moment."
              : "Aucun résultat ne correspond aux filtres appliqués."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((r) => {
            const isProcessing = Boolean(actionLoading[r.id]);

            const statusBadge = {
              PENDING: {
                label: "En attente",
                bg: "bg-amber-100 text-amber-700 border-amber-300",
                icon: Clock,
              },
              APPROVED: {
                label: "Approuvé",
                bg: "bg-emerald-100 text-emerald-700 border-emerald-300",
                icon: CheckCircle2,
              },
              REJECTED: {
                label: "Rejeté",
                bg: "bg-rose-100 text-rose-700 border-rose-300",
                icon: XCircle,
              },
            }[r.status] || {
              label: r.status,
              bg: "bg-gray-100 text-gray-700 border-gray-300",
              icon: Clock,
            };

            const StatusIcon = statusBadge.icon;

            return (
              <div
                key={r.id}
                className={`${card} p-5 flex flex-col justify-between transition-all duration-200 border-2 ${
                  r.status === "PENDING"
                    ? "border-amber-400/70 shadow-md bg-amber-50/10"
                    : "border-gray-200"
                }`}
              >
                {/* Header: Name, Date, Status */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-orange-500 to-amber-500 text-white font-extrabold flex items-center justify-center text-sm shadow-sm flex-none">
                        {(r.name || "?").trim().charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900 text-sm truncate">{r.name}</p>
                        <p className="text-[11px] text-gray-400">{formatDate(r.createdAt)}</p>
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border flex-none ${statusBadge.bg}`}
                    >
                      <StatusIcon className="w-3.5 h-3.5" />
                      <span>{statusBadge.label}</span>
                    </span>
                  </div>

                  {/* Rating & Topics */}
                  <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                    <Burgers value={r.rating} />
                    <span className="text-xs font-bold text-gray-700">{r.rating} / 5</span>
                  </div>

                  {/* Topics badges */}
                  {r.topics && r.topics.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {r.topics.map((topic, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 border border-gray-200 text-gray-600"
                        >
                          {topic}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Comment Body */}
                  <div className="pt-2">
                    {r.comment ? (
                      <p className="text-xs text-gray-700 leading-relaxed bg-gray-50 border border-gray-100 p-3 rounded-2xl italic">
                        « {r.comment} »
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400 italic">
                        Aucun commentaire rédigé (note seule).
                      </p>
                    )}
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="pt-4 mt-4 border-t border-gray-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {/* Approve button */}
                    {r.status !== "APPROVED" && (
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => handleUpdateStatus(r.id, "APPROVED")}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white border border-emerald-300 transition flex items-center gap-1.5 disabled:opacity-50"
                        title="Approuver le commentaire (visible en ligne)"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Approuver</span>
                      </button>
                    )}

                    {/* Reject button */}
                    {r.status !== "REJECTED" && (
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => handleUpdateStatus(r.id, "REJECTED")}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white border border-rose-300 transition flex items-center gap-1.5 disabled:opacity-50"
                        title="Rejeter le commentaire (masqué)"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Rejeter</span>
                      </button>
                    )}
                  </div>

                  {/* Delete button */}
                  <button
                    type="button"
                    onClick={() => {
                      setDeletingId(r.id);
                      setDeleteError("");
                    }}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                    title="Supprimer définitivement cet avis"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 text-xs text-gray-600">
          <div>
            Page <span className="font-bold text-gray-900">{page}</span> sur{" "}
            <span className="font-bold text-gray-900">{totalPages}</span> ({total} avis au total)
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className={`${btnGhost} text-xs py-1.5 px-3 disabled:opacity-40`}
            >
              Précédent
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className={`${btnGhost} text-xs py-1.5 px-3 disabled:opacity-40`}
            >
              Suivant
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog open={Boolean(deletingId)} onOpenChange={(open) => { if (!open) { setDeletingId(null); setDeleteError(""); } }}>
        <AlertDialogContent className="bg-white border border-gray-200">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-900 font-bold text-lg">
              Confirmer la suppression
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600 text-sm space-y-2">
              <span className="block">
                Êtes-vous sûr de vouloir supprimer définitivement cet avis client ? Cette action est irréversible.
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
              disabled={deleteLoading}
              className="border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteLoading}
              onClick={handleDelete}
              className="bg-red-600 text-white hover:bg-red-700 font-bold flex items-center gap-2"
            >
              {deleteLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{deleteLoading ? "Suppression..." : "Supprimer définitivement"}</span>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

