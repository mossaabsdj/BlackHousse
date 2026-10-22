"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingBag,
  Calendar,
  RefreshCw,
  Truck,
  Store,
  ArrowUpRight,
  ArrowDownRight,
  Receipt,
  Percent,
  ArrowRight,
} from "lucide-react";
import { api, formatPrice } from "./adminApi";
import { card, inputClass, btnPrimary, btnGhost, ErrorBox } from "./Ui";
import { EXPENSE_CATEGORIES } from "@/lib/admin/finance";

const PERIOD_OPTIONS = [
  { id: "today", label: "Aujourd'hui" },
  { id: "yesterday", label: "Hier" },
  { id: "this_week", label: "Cette semaine" },
  { id: "this_month", label: "Ce mois-ci" },
  { id: "last_month", label: "Mois dernier" },
  { id: "custom", label: "Personnalisé" },
];

export default function FinancePanel({ onNavigateToExpenses }) {
  // Period filter states
  const [period, setPeriod] = useState("today");
  const [customFrom, setCustomFrom] = useState(() => {
    const d = new Date();
    d.setUTCDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [customTo, setCustomTo] = useState(() => new Date().toISOString().slice(0, 10));

  // Stats data
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState("");

  // Load Financial Stats
  const loadStats = useCallback(
    async (silent = false) => {
      if (!silent) setStatsLoading(true);
      setStatsError("");
      try {
        let url = `/api/admin/finance/stats?period=${period}`;
        if (period === "custom") {
          url += `&from=${customFrom}&to=${customTo}`;
        }
        const data = await api.get(url);
        console.log("Finance stats loaded:", data);
        setStats(data);
      } catch (err) {
        setStatsError(err.message || "Erreur lors du chargement des statistiques financières");
      } finally {
        setStatsLoading(false);
      }
    },
    [period, customFrom, customTo]
  );

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Timeline max value calculation for chart scaling
  const chartMax = useMemo(() => {
    if (!stats?.timeline || stats.timeline.length === 0) return 1000;
    const maxVal = Math.max(
      ...stats?.timeline?.map((t) => Math.max(t?.revenue || 0, t?.expenses || 0, Math.abs(t?.profit || 0)))
    );
    return Math.max(1000, maxVal * 1.15);
  }, [stats?.timeline]);

  return (
    <section className="space-y-6">
      {/* ----------------- Top Header & Period Selector ----------------- */}
    

      {/* Period Filter Tabs */}
      <div className={`${card} p-4 space-y-3`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5 mr-1">
            <Calendar className="w-3.5 h-3.5 text-orange-500" /> Période :
          </span>
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setPeriod(opt.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                period === opt.id
                  ? "bg-orange-500 text-white shadow-md shadow-orange-500/20"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {period === "custom" && (
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-100">
            <div className="flex items-center gap-2 text-sm">
              <label htmlFor="custom-from" className="font-semibold text-gray-700 text-xs">
                Du :
              </label>
              <input
                id="custom-from"
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className={`${inputClass} w-auto text-xs py-1.5`}
              />
            </div>
            <div className="flex items-center gap-2 text-sm">
              <label htmlFor="custom-to" className="font-semibold text-gray-700 text-xs">
                Au :
              </label>
              <input
                id="custom-to"
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className={`${inputClass} w-auto text-xs py-1.5`}
              />
            </div>
            <button
              type="button"
              onClick={() => loadStats()}
              className="px-3 py-1.5 rounded-xl bg-orange-600 text-white text-xs font-bold hover:bg-orange-700 transition"
            >
              Appliquer
            </button>
          </div>
        )}
      </div>

      {statsError && <ErrorBox message={statsError} onRetry={() => loadStats()} />}

      {/* ----------------- Key Performance Indicators (Cards) ----------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Revenue Card */}
        <div className={`${card} p-5 space-y-3 bg-gradient-to-br from-white to-orange-50/30 border-orange-100`}>
          <div className="flex items-center justify-between">
<span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Recettes</span>            <div className="w-10 h-10 rounded-2xl bg-orange-500/10 text-orange-600 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
              {formatPrice(stats?.summary?.collectedRevenue ?? 0)}
            </p>
            {typeof stats?.comparisons?.revenueChangePct === "number" && (
              <div className="flex items-center gap-1.5 mt-1">
                {stats?.comparisons?.revenueChangePct >= 0 ? (
                  <span className="inline-flex items-center text-xs font-bold text-emerald-600">
                    <ArrowUpRight className="w-3.5 h-3.5" />+{stats?.comparisons?.revenueChangePct}%
                  </span>
                ) : (
                  <span className="inline-flex items-center text-xs font-bold text-red-500">
                    <ArrowDownRight className="w-3.5 h-3.5" />
                    {stats?.comparisons?.revenueChangePct}%
                  </span>
                )}
                <span className="text-[11px] text-gray-400">vs période préc.</span>
              </div>
            )}
          </div>
          <div className="pt-2 border-t border-gray-100 text-xs text-gray-500 flex justify-end">
            <span>Commandes : <strong className="text-gray-900">{stats?.summary?.completedCount ?? 0}</strong></span>
          </div>
        </div>

        {/* Expenses Card */}
        <div className={`${card} p-5 space-y-3 bg-gradient-to-br from-white to-red-50/30 border-red-100`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total des Dépenses</span>
            <div className="w-10 h-10 rounded-2xl bg-red-500/10 text-red-600 flex items-center justify-center">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-black text-red-600 tracking-tight">
              {formatPrice(stats?.summary?.totalExpenses ?? 0)}
            </p>
            {typeof stats?.comparisons?.expensesChangePct === "number" && (
              <div className="flex items-center gap-1.5 mt-1">
                {stats?.comparisons?.expensesChangePct <= 0 ? (
                  <span className="inline-flex items-center text-xs font-bold text-emerald-600">
                    <ArrowDownRight className="w-3.5 h-3.5" />
                    {stats?.comparisons?.expensesChangePct}%
                  </span>
                ) : (
                  <span className="inline-flex items-center text-xs font-bold text-red-500">
                    <ArrowUpRight className="w-3.5 h-3.5" />+{stats?.comparisons?.expensesChangePct}%
                  </span>
                )}
                <span className="text-[11px] text-gray-400">vs période préc.</span>
              </div>
            )}
          </div>
          <div className="pt-2 border-t border-gray-100 text-xs text-gray-500 flex justify-end">
            <span>Depenses : <strong className="text-gray-900">{stats?.summary?.expenseCount ?? 0}</strong></span>
          </div>
        </div>

        {/* Net Profit Card */}
        <div
          className={`${card} p-5 space-y-3 ${
            (stats?.summary?.netProfit ?? 0) >= 0
              ? "bg-gradient-to-br from-white to-emerald-50/40 border-emerald-100"
              : "bg-gradient-to-br from-white to-red-50/40 border-red-100"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Bénéfice Net</span>
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                (stats?.summary?.netProfit ?? 0) >= 0
                  ? "bg-emerald-500/10 text-emerald-600"
                  : "bg-red-500/10 text-red-600"
              }`}
            >
              {(stats?.summary?.netProfit ?? 0) >= 0 ? (
                <TrendingUp className="w-5 h-5" />
              ) : (
                <TrendingDown className="w-5 h-5" />
              )}
            </div>
          </div>
          <div>
            <p
              className={`text-2xl sm:text-3xl font-black tracking-tight ${
                (stats?.summary?.netProfit ?? 0) >= 0 ? "text-emerald-600" : "text-red-600"
              }`}
            >
              {formatPrice(stats?.summary?.netProfit ?? 0)}
            </p>
            <div className="flex items-center gap-1.5 mt-1">
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  (stats?.summary?.netProfit ?? 0) >= 0
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {(stats?.summary?.netProfit ?? 0) >= 0 ? "Bénéficiaire" : "Déficitaire"}
              </span>
              <span className="text-[11px] text-gray-400">Recettes - Dépenses</span>
            </div>
          </div>
          <div className="pt-2 border-t border-gray-100 text-xs text-gray-500 flex justify-end">
            <span>Période préc. : <strong className="text-gray-900">{formatPrice(stats?.comparisons?.previousNetProfit ?? 0)}</strong></span>
            {typeof stats?.comparisons?.netProfitChangePct === "number" && (
              <span className={stats?.comparisons?.netProfitChangePct >= 0 ? "text-emerald-600 font-bold" : "text-red-500 font-bold"}>
                {stats?.comparisons?.netProfitChangePct >= 0 ? "+" : ""}{stats?.comparisons?.netProfitChangePct}%
              </span>
            )}
          </div>
        </div>

        {/* Profit Margin Card */}
        <div className={`${card} p-5 space-y-3 bg-gradient-to-br from-white to-blue-50/30 border-blue-100`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Marge Nette</span>
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <Percent className="w-5 h-5" />
            </div>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
              {stats?.summary?.profitMarginPct ?? 0}%
            </p>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-gray-500">
              <span>{stats?.summary?.profitMarginPct >= 20 ? "Excellente marge" : stats?.summary?.profitMarginPct >= 0 ? "Marge correcte" : "Marge négative"}</span>
            </div>
          </div>
          <div className="pt-2 border-t border-gray-100 text-xs text-gray-500 flex justify-between">
            <span>Servies : <strong className="text-emerald-600">{stats?.summary?.completedCount ?? 0}</strong></span>
            <span>Annulées : <strong className="text-red-500">{stats?.summary?.cancelledCount ?? 0}</strong></span>
          </div>
        </div>
      </div>

      {/* ----------------- Charts & Distribution Breakdowns ----------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Timeline Chart (2 cols) */}
        <div className={`${card} p-5 lg:col-span-2 space-y-4`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-extrabold text-gray-900">Évolution Quotidienne</h3>
              <p className="text-xs text-gray-500">Comparaison Recettes, Dépenses et Bénéfice par jour</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-gray-700 font-semibold">
                <span className="w-3 h-3 rounded-full bg-orange-500 inline-block" />
                Recettes
              </span>
              <span className="flex items-center gap-1.5 text-gray-700 font-semibold">
                <span className="w-3 h-3 rounded-full bg-red-400 inline-block" />
                Dépenses
              </span>
              <span className="flex items-center gap-1.5 text-gray-700 font-semibold">
                <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
                Bénéfice
              </span>
            </div>
          </div>

          {/* Interactive Responsive SVG Bar Chart */}
          <div className="w-full pt-4">
            {stats?.timeline && stats.timeline.length > 0 ? (
              <div className="w-full overflow-x-auto pb-2">
                <div className="min-w-[420px] h-64 flex items-end gap-2 border-b border-gray-200 px-2 pb-2">
                  {stats?.timeline?.map((point) => {
                    const revHeight = Math.min(100, Math.max(4, (point.revenue / chartMax) * 100));
                    const expHeight = Math.min(100, Math.max(4, (point.expenses / chartMax) * 100));
                    return (
                      <div
                        key={point.date}
                        className="flex-1 flex flex-col items-center justify-end h-full group relative"
                      >
                        {/* Hover Tooltip */}
                        <div className="absolute -top-16 opacity-0 group-hover:opacity-100 transition pointer-events-none z-20 bg-gray-900 text-white rounded-xl p-2 text-[11px] shadow-xl whitespace-nowrap">
                          <p className="font-bold text-orange-400">{point.label}</p>
                          <p>Recettes : {formatPrice(point.revenue)}</p>
                          <p>Dépenses : {formatPrice(point.expenses)}</p>
                          <p className={point.profit >= 0 ? "text-emerald-400" : "text-red-400"}>
                            Bénéfice : {formatPrice(point.profit)}
                          </p>
                        </div>

                        {/* Side by side bars */}
                        <div className="w-full flex items-end justify-center gap-1 h-52">
                          {point.revenue > 0 && (
                            <div
                              style={{ height: `${revHeight}%` }}
                              className="w-full max-w-[14px] rounded-t-md bg-gradient-to-t from-orange-600 to-orange-400 shadow-sm transition-all duration-300 group-hover:brightness-110"
                            />
                          )}
                          {point.expenses > 0 && (
                            <div
                              style={{ height: `${expHeight}%` }}
                              className="w-full max-w-[14px] rounded-t-md bg-gradient-to-t from-red-500 to-red-400 shadow-sm transition-all duration-300 group-hover:brightness-110"
                            />
                          )}
                          {point.revenue === 0 && point.expenses === 0 && (
                            <div className="h-1 w-2 bg-gray-200 rounded-full" />
                          )}
                        </div>

                        {/* Date label */}
                        <span className="text-[10px] text-gray-500 font-medium mt-2 truncate max-w-[36px] text-center">
                          {point.label.split(" ")[0]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="text-gray-400 text-center py-16 text-sm">Aucune donnée sur cette période.</p>
            )}
          </div>
        </div>

        {/* Expense Categories Distribution (1 col) */}
        <div className={`${card} p-5 space-y-4`}>
          <div>
            <h3 className="text-lg font-extrabold text-gray-900">Répartition des Dépenses</h3>
            <p className="text-xs text-gray-500">Par catégorie de charge</p>
          </div>

          <div className="space-y-3 pt-1">
            {stats?.expenseCategories && stats.expenseCategories.filter((c) => c.total > 0).length > 0 ? (
              stats?.expenseCategories
                ?.filter((c) => c.total > 0)
                .map((cat) => (
                  <div key={cat.category} className="space-y-1">
                    <div className="flex justify-between items-center text-xs font-semibold">
                      <span className="text-gray-700 truncate max-w-[180px]">{cat.label}</span>
                      <span className="font-mono text-gray-900">{formatPrice(cat.total)} ({cat.percentage}%)</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div
                        style={{
                          width: `${cat.percentage}%`,
                          backgroundColor:
                            EXPENSE_CATEGORIES.find((c) => c.value === cat.category)?.color || "#f97316",
                        }}
                        className="h-full rounded-full transition-all duration-500"
                      />
                    </div>
                  </div>
                ))
            ) : (
              <div className="text-center py-10 space-y-2">
                <Receipt className="w-8 h-8 text-gray-300 mx-auto" />
                <p className="text-xs text-gray-400">Aucune dépense enregistrée sur cette période.</p>
              </div>
            )}
          </div>

          {/* Sales Channels Breakdown */}
          <div className="pt-4 border-t border-gray-100 space-y-2">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Canaux de Vente</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-100 space-y-1">
                <div className="flex items-center gap-1.5 text-gray-600 font-semibold">
                  <Truck className="w-3.5 h-3.5 text-orange-500" /> Livraison
                </div>
                <p className="font-black text-sm text-gray-900">
                  {formatPrice(stats?.fulfillment?.delivery?.total || 0)}
                </p>
                <span className="text-[11px] text-gray-500">
                  {stats?.fulfillment?.delivery?.count || 0} commandes
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-100 space-y-1">
                <div className="flex items-center gap-1.5 text-gray-600 font-semibold">
                  <Store className="w-3.5 h-3.5 text-blue-500" /> À emporter
                </div>
                <p className="font-black text-sm text-gray-900">
                  {formatPrice(stats?.fulfillment?.pickup?.total || 0)}
                </p>
                <span className="text-[11px] text-gray-500">
                  {stats?.fulfillment?.pickup?.count || 0} commandes
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ----------------- Top 5 Selling Products ----------------- */}
      {stats?.topProducts && stats.topProducts.length > 0 && (
        <div className={`${card} p-5 space-y-3`}>
          <h3 className="text-lg font-extrabold text-gray-900">Top 5 des Produits les Plus Vendus</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {stats?.topProducts?.map((p, idx) => (
              <div
                key={idx}
                className="p-3 rounded-2xl bg-gray-50 border border-gray-100 flex flex-col justify-between space-y-2"
              >
                <div>
                  <span className="text-xs px-2 py-0.5 rounded-md bg-orange-100 text-orange-700 font-bold">
                    #{idx + 1}
                  </span>
                  <p className="font-bold text-gray-900 text-sm mt-1 truncate">{p.name}</p>
                </div>
                <div className="flex justify-between items-end text-xs">
                  <span className="text-gray-500">{p.quantity} vendus</span>
                  <span className="font-extrabold text-orange-600">{formatPrice(p.revenue)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ----------------- Standalone Expenses Link Banner ----------------- */}
      <div className={`${card} p-6 bg-gradient-to-br from-white via-orange-50/20 to-white border-orange-100 flex flex-col sm:flex-row items-center justify-between gap-4`}>
        <div className="space-y-1 text-center sm:text-left">
          <div className="flex items-center gap-2 justify-center sm:justify-start">
            <Receipt className="w-5 h-5 text-orange-600" />
            <h3 className="text-lg font-extrabold text-gray-900">Registre et Suivi des Dépenses</h3>
          </div>
          <p className="text-xs sm:text-sm text-gray-500 max-w-xl">
            Toutes les dépenses (ingrédients, salaires, loyer, équipements, factures) sont gérées de manière autonome dans l'onglet dédié « Dépenses ».
          </p>
        </div>
        {onNavigateToExpenses && (
          <button
            type="button"
            onClick={onNavigateToExpenses}
            className={`${btnPrimary} flex items-center gap-2 text-sm whitespace-nowrap shadow-md shadow-orange-500/20`}
          >
            Accéder à l'onglet Dépenses <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </section>
  );
}
