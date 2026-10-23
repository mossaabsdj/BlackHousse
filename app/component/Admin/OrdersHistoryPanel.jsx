"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Search,
  RefreshCw,
  Calendar,
  CheckCircle2,
  XCircle,
  TrendingUp,
  PackageCheck,
  Ban,
  ArrowRight,
  Truck,
  Store,
  Filter,
} from "lucide-react";
import { api, formatDate, formatPrice, useList } from "./adminApi";
import { Badge, ErrorBox, btnGhost, card, inputClass } from "./Ui";
import { useI18n } from "@/lib/i18n/I18nContext";

export default function OrdersHistoryPanel() {
  const { t } = useI18n();
  const [period, setPeriod] = useState("all");

  const periodPresets = useMemo(
    () => [
      { id: "all", label: t("Admin.history.periods.all", {}, "Toute la période") },
      { id: "today", label: t("Admin.history.periods.today", {}, "Aujourd'hui") },
      { id: "yesterday", label: t("Admin.history.periods.yesterday", {}, "Hier") },
      { id: "this_week", label: t("Admin.history.periods.this_week", {}, "Cette semaine") },
      { id: "this_month", label: t("Admin.history.periods.this_month", {}, "Ce mois-ci") },
      { id: "custom", label: t("Admin.history.periods.custom", {}, "Personnalisé") },
    ],
    [t]
  );
  const [customFrom, setCustomFrom] = useState(() => {
    const d = new Date();
    d.setUTCDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [customTo, setCustomTo] = useState(() => new Date().toISOString().slice(0, 10));

  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [savingRef, setSavingRef] = useState(null);
  const [actionError, setActionError] = useState("");

  // Debounce text search
  useEffect(() => {
    const id = setTimeout(() => {
      setQDebounced(q.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(id);
  }, [q]);

  // Compute date range based on period
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
    if (period === "custom") {
      return { from: customFrom, to: customTo };
    }
    return {};
  }, [period, customFrom, customTo]);

  // Query params
  const params = new URLSearchParams({
    page: String(page),
    scope: "history",
  });
  if (status) params.set("status", status);
  if (qDebounced) params.set("q", qDebounced);
  if (dateParams.from) params.set("from", dateParams.from);
  if (dateParams.to) params.set("to", dateParams.to);

  const { items, extra, loading, error, reload } = useList(`/api/admin/orders?${params}`);

  const summary = extra.summary || null;
  const statuses = extra.statuses ?? [];
  const allStatuses = extra.allStatuses ?? [];
  const pages = Math.max(1, Math.ceil((extra.total ?? 0) / (extra.pageSize ?? 20)));

  const changeStatus = async (order, next) => {
    if (next === order.status) return;
    const label = allStatuses.find((s) => s.value === next)?.label ?? next;
    setSavingRef(order.reference);
    setActionError("");
    try {
      await api.patch(`/api/admin/orders/${order.reference}`, { status: next });
      await reload(true);
    } catch (err) {
      setActionError(`${order.reference} → « ${label} » : ${err.message}`);
    } finally {
      setSavingRef(null);
    }
  };

  const completionRate = useMemo(() => {
    if (!summary || summary.totalCount === 0) return 0;
    return Math.round((summary.completedCount / summary.totalCount) * 100);
  }, [summary]);

  return (
    <section className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-900">{t("Admin.history.title", {}, "Historique des Commandes")}</h2>
          <p className="text-xs sm:text-sm text-gray-500">
            {t("Admin.history.subtitle", {}, "Archives des commandes traitées (Livrées, Récupérées ou Annulées)")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => reload()}
          className={`${btnGhost} flex items-center gap-2 text-xs sm:text-sm`}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> {t("Admin.orders.refresh", {}, "Actualiser")}
        </button>
      </div>

      {/* KPI Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className={`${card} p-4 flex items-center gap-4 bg-gradient-to-br from-white to-emerald-50/30 border-emerald-100`}>
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center flex-none">
              <PackageCheck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{t("Admin.history.completedOrders", {}, "Commandes Servies")}</p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-gray-900">{summary.completedCount}</span>
                <span className="text-xs font-extrabold text-emerald-600">
                  {formatPrice(summary.completedRevenue)}
                </span>
              </div>
            </div>
          </div>

          <div className={`${card} p-4 flex items-center gap-4 bg-gradient-to-br from-white to-red-50/30 border-red-100`}>
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-500 flex items-center justify-center flex-none">
              <Ban className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{t("Admin.history.cancelledOrders", {}, "Commandes Annulées")}</p>
              <p className="text-2xl font-black text-gray-900">{summary.cancelledCount}</p>
            </div>
          </div>

          <div className={`${card} p-4 flex items-center gap-4 bg-gradient-to-br from-white to-blue-50/30 border-blue-100`}>
            <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center flex-none">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{t("Admin.history.completionRate", {}, "Taux de Réalisation")}</p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-gray-900">{completionRate}%</span>
                <span className="text-xs text-gray-500 font-medium">
                  ({summary.totalCount} total)
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter and Period Selection Bar */}
      <div className={`${card} p-4 space-y-4`}>
        {/* Preset Period Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-gray-500 flex items-center gap-1.5 mr-1">
            <Calendar className="w-3.5 h-3.5 text-orange-500" /> {t("Admin.history.periodsLabel", {}, "Période :")}
          </span>
          {periodPresets.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setPeriod(p.id);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${
                period === p.id
                  ? "bg-orange-500 border-orange-500 text-white shadow-sm"
                  : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom Date Range Row */}
        {period === "custom" && (
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-100">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-500 font-semibold">Du :</span>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => {
                  setCustomFrom(e.target.value);
                  setPage(1);
                }}
                className={`${inputClass} text-xs py-1.5`}
              />
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-500 font-semibold">Au :</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => {
                  setCustomTo(e.target.value);
                  setPage(1);
                }}
                className={`${inputClass} text-xs py-1.5`}
              />
            </div>
          </div>
        )}

        {/* Search & Status Filters */}
        <div className="flex flex-wrap gap-3 pt-2 border-t border-gray-100">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              aria-label="Rechercher une commande archivée"
              className={`${inputClass} ps-9`}
              placeholder={t("Admin.history.searchPlaceholder", {}, "Nom du client, téléphone ou référence...")}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <select
            aria-label="Filtrer par statut historique"
            className={`${inputClass} max-w-[240px] font-semibold`}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">{t("Admin.history.allStatuses", {}, "Tous les statuts archivés")}</option>
            {statuses.map((s) => (
              <option key={s.value} value={s.value}>
                {t(`OrderStatus.${s.value}`, {}, s.label)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {actionError && <ErrorBox message={actionError} />}
      {error && <ErrorBox message={error} onRetry={() => reload()} />}

      {loading && items.length === 0 && (
        <p className="text-gray-500 text-center py-12">{t("Admin.history.loading", {}, "Chargement de l'historique...")}</p>
      )}

      {!loading && items.length === 0 && !error && (
        <div className="p-12 text-center bg-white rounded-3xl border border-gray-200 space-y-3">
          <CheckCircle2 className="w-12 h-12 text-gray-300 mx-auto" />
          <p className="font-extrabold text-gray-700 text-lg">{t("Admin.history.noOrdersFound", {}, "Aucune commande trouvée")}</p>
          <p className="text-xs text-gray-500 max-w-md mx-auto">
            {t("Admin.orders.allProcessed", {}, "Aucune commande archivée ne correspond aux filtres sélectionnés.")}
          </p>
        </div>
      )}

      {/* Orders List */}
      <div className="space-y-4">
        {items.map((o) => {
          const isCancelled = o.status === "CANCELLED";
          return (
            <article
              key={o.id}
              className={`${card} p-5 space-y-3 relative overflow-hidden transition-all duration-200 hover:shadow-md ${
                isCancelled ? "bg-red-50/20 border-red-100" : ""
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {o.dailyNumber != null && (
                    <span
                      className={`flex items-center justify-center min-w-9 h-9 px-2.5 rounded-xl font-black text-base shadow-sm ring-2 ${
                        isCancelled
                          ? "bg-red-500 text-white ring-red-200/50"
                          : "bg-emerald-600 text-white ring-emerald-200/50"
                      }`}
                      title={`Commande #${o.dailyNumber} de la journée du ${formatDate(o.createdAt)}`}
                    >
                      #{o.dailyNumber}
                    </span>
                  )}
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-mono font-bold text-gray-900">{o.reference}</p>
                      {o.dailyNumber != null && (
                        <span className="text-xs px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 font-medium">
                          N° {o.dailyNumber} du jour
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">{formatDate(o.createdAt)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Badge tone={o.fulfillment === "delivery" ? "orange" : "blue"}>
                    {o.fulfillment === "delivery" ? "Livraison" : "Retrait"}
                  </Badge>

                  {/* Status selector allowing correction back to active status if needed */}
                  <select
                    aria-label={`Modifier statut de ${o.reference}`}
                    className={`${inputClass} w-auto font-semibold ${
                      isCancelled ? "text-red-600 border-red-200 bg-red-50/50" : "text-emerald-700 border-emerald-200 bg-emerald-50/50"
                    }`}
                    value={o.status}
                    disabled={savingRef === o.reference}
                    onChange={(e) => changeStatus(o, e.target.value)}
                  >
                    {allStatuses.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Customer and Delivery info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="font-bold text-gray-900">{o.customerName}</p>
                  <a href={`tel:${o.customerPhone}`} className="text-orange-600 font-semibold hover:underline">
                    {o.customerPhone}
                  </a>
                </div>
                {o.fulfillment === "delivery" && (
                  <div className="text-gray-700">
                    <p className="font-semibold">{o.municipalityName}</p>
                    <p className="text-xs text-gray-500">{o.address}</p>
                  </div>
                )}
              </div>

              {/* Items Summary */}
              <ul className="text-sm space-y-1 bg-gray-50/60 p-3 rounded-2xl border border-gray-100">
                {o.items.map((it, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span className="text-gray-900">
                      <span className="font-bold">{it.quantity}×</span> {it.name}
                      {it.options.length > 0 && (
                        <span className="block text-xs text-gray-500">{it.options.join(", ")}</span>
                      )}
                    </span>
                    <span className="text-gray-700 whitespace-nowrap font-mono">{formatPrice(it.total)}</span>
                  </li>
                ))}
              </ul>

              {o.notes && (
                <p className="text-xs rounded-xl bg-amber-50/60 border border-amber-200 px-3 py-2 text-amber-900">
                  📝 {o.notes}
                </p>
              )}

              {/* Totals footer */}
              <div className="flex justify-end gap-6 text-sm border-t border-gray-100 pt-3">
                {o.deliveryFee > 0 && (
                  <span className="text-gray-600">Livraison : {formatPrice(o.deliveryFee)}</span>
                )}
                <span className={`font-black text-base ${isCancelled ? "text-gray-400 line-through" : "text-gray-900"}`}>
                  Total : {formatPrice(o.total)}
                </span>
              </div>
            </article>
          );
        })}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-4">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className={btnGhost}
          >
            Précédent
          </button>
          <span className="text-sm text-gray-600">
            Page {page} / {pages} ({extra.total ?? 0} au total)
          </span>
          <button
            type="button"
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
            className={btnGhost}
          >
            Suivant
          </button>
        </div>
      )}
    </section>
  );
}

