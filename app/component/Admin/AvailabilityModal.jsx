"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Search,
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Utensils,
  Layers,
  ImageOff,
  Check,
} from "lucide-react";
import { api, formatPrice } from "./adminApi";
import { Modal, Toggle, Badge, ErrorBox, btnGhost, btnPrimary, inputClass } from "./Ui";
import { useI18n } from "@/lib/i18n/I18nContext";

function ProductThumb({ src, name }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        aria-hidden="true"
        className="w-12 h-12 rounded-xl flex-none bg-gradient-to-br from-orange-100 to-amber-200 text-orange-600 font-extrabold flex items-center justify-center text-sm shadow-inner"
      >
        {name?.charAt(0)?.toUpperCase() || "P"}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      loading="lazy"
      onError={() => setFailed(true)}
      className="w-12 h-12 rounded-xl object-cover flex-none border border-gray-200 shadow-sm"
    />
  );
}

export default function AvailabilityModal({ onClose }) {
  const { t, isRTL } = useI18n();
  // Catalog data
  const [products, setProducts] = useState([]);
  const [optionGroups, setOptionGroups] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");

  // In-flight updates
  const [busyIds, setBusyIds] = useState(new Set());

  // UI tabs & filters
  const [activeTab, setActiveTab] = useState("products"); // "products" | "groups"
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [onlyUnavailable, setOnlyUnavailable] = useState(false);

  // Accordion state for products: Set of product IDs whose options are expanded
  const [expandedProductIds, setExpandedProductIds] = useState(new Set());

  // Fetch all catalog items
  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    setActionError("");
    try {
      const [prodRes, groupsRes, catRes] = await Promise.all([
        api.get("/api/admin/products"),
        api.get("/api/admin/option-groups"),
        api.get("/api/admin/categories"),
      ]);
      setProducts(prodRes?.items || []);
      setOptionGroups(groupsRes?.items || []);
      setCategories(catRes?.items || []);
    } catch (err) {
      setError(err.message || "Impossible de charger les données du catalogue.");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Map optionGroups by id for quick lookup
  const groupsMap = useMemo(() => {
    const map = new Map();
    optionGroups.forEach((g) => map.set(g.id, g));
    return map;
  }, [optionGroups]);

  // Global counts for badges
  const totalProducts = products.length;
  const unavailableProductsCount = useMemo(
    () => products.filter((p) => !p.available).length,
    [products]
  );

  const allOptions = useMemo(
    () => optionGroups.flatMap((g) => g.options || []),
    [optionGroups]
  );
  const totalOptions = allOptions.length;
  const unavailableOptionsCount = useMemo(
    () => allOptions.filter((o) => !o.available).length,
    [allOptions]
  );

  // Product toggle availability handler
  const toggleProduct = async (product) => {
    const newAvailable = !product.available;
    setActionError("");
    setBusyIds((s) => new Set(s).add(product.id));

    // Optimistic update
    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, available: newAvailable } : p))
    );

    try {
      await api.patch(`/api/admin/products/${product.id}`, { available: newAvailable });
    } catch (err) {
      // Revert on error
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, available: !newAvailable } : p))
      );
      setActionError(
        err.message || `Erreur lors de la mise à jour de « ${product.name} ».`
      );
    } finally {
      setBusyIds((s) => {
        const next = new Set(s);
        next.delete(product.id);
        return next;
      });
    }
  };

  // Option toggle availability handler
  const toggleOption = async (option) => {
    const newAvailable = !option.available;
    setActionError("");
    setBusyIds((s) => new Set(s).add(option.id));

    // Optimistic update in optionGroups
    setOptionGroups((prev) =>
      prev.map((g) => ({
        ...g,
        options: (g.options || []).map((o) =>
          o.id === option.id ? { ...o, available: newAvailable } : o
        ),
      }))
    );

    try {
      await api.patch(`/api/admin/options/${option.id}`, { available: newAvailable });
    } catch (err) {
      // Revert on error
      setOptionGroups((prev) =>
        prev.map((g) => ({
          ...g,
          options: (g.options || []).map((o) =>
            o.id === option.id ? { ...o, available: !newAvailable } : o
          ),
        }))
      );
      setActionError(
        err.message || `Erreur lors de la mise à jour de l'option « ${option.name} ».`
      );
    } finally {
      setBusyIds((s) => {
        const next = new Set(s);
        next.delete(option.id);
        return next;
      });
    }
  };

  // Expand / collapse product accordion
  const toggleExpand = (productId) => {
    setExpandedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  const expandAll = (ids) => setExpandedProductIds(new Set(ids));
  const collapseAll = () => setExpandedProductIds(new Set());

  // Filter products
  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (selectedCategory && p.categoryId !== selectedCategory) return false;

      const pGroups = (p.groupIds || []).map((gid) => groupsMap.get(gid)).filter(Boolean);
      const hasUnavailOption = pGroups.some((g) =>
        (g.options || []).some((o) => !o.available)
      );

      if (onlyUnavailable && p.available && !hasUnavailOption) {
        return false;
      }

      if (!q) return true;

      const matchName = p.name.toLowerCase().includes(q);
      const matchCat = (p.categoryName || "").toLowerCase().includes(q);
      const matchOption = pGroups.some((g) =>
        (g.options || []).some((o) => o.name.toLowerCase().includes(q))
      );

      return matchName || matchCat || matchOption;
    });
  }, [products, selectedCategory, search, onlyUnavailable, groupsMap]);

  // Filter option groups
  const filteredOptionGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    return optionGroups.filter((g) => {
      const hasUnavailOption = (g.options || []).some((o) => !o.available);
      if (onlyUnavailable && !hasUnavailOption) return false;

      if (!q) return true;

      const matchGroupName = g.name.toLowerCase().includes(q);
      const matchOptName = (g.options || []).some((o) => o.name.toLowerCase().includes(q));
      return matchGroupName || matchOptName;
    });
  }, [optionGroups, search, onlyUnavailable]);

  return (
    <Modal
      title={t("Admin.availability.title", {}, "Disponibilité des produits & options")}
      onClose={onClose}
      wide="sm:max-w-3xl lg:max-w-4xl"
      footer={
        <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <p className="text-gray-500 font-medium text-center sm:text-left">
            💡 {t("Admin.availability.footerTip", {}, "Toute modification s'enregistre immédiatement et met à jour le menu des clients.")}
          </p>
          <button
            type="button"
            onClick={onClose}
            className={`${btnPrimary} px-6 whitespace-nowrap`}
          >
            {t("Admin.availability.done", {}, "Terminé")}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
      

        {/* Global Action / Error Messages */}
        {actionError && <ErrorBox message={actionError} />}
        {error && <ErrorBox message={error} onRetry={() => loadData()} />}

        {/* Search, Filter & Tabs Bar */}
        <div className="space-y-3 pt-1">
          {/* Main Controls row */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* View Switch: Products vs Option Groups */}
            <div className="flex items-center bg-gray-100 p-1 rounded-xl self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setActiveTab("products")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition ${
                  activeTab === "products"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <Utensils className="w-3.5 h-3.5" />
                {t("Admin.availability.tabProducts", {}, "Produits")}
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-gray-200 text-gray-700">
                  {products.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("groups")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition ${
                  activeTab === "groups"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                {t("Admin.availability.tabGroups", {}, "Groupes d'options")}
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-gray-200 text-gray-700">
                  {optionGroups.length}
                </span>
              </button>
            </div>

            {/* Quick Filter: Ruptures uniquement */}
            <button
              type="button"
              onClick={() => setOnlyUnavailable((v) => !v)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition self-start sm:self-auto ${
                onlyUnavailable
                  ? "bg-red-50 border-red-300 text-red-700 ring-2 ring-red-500/20"
                  : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  onlyUnavailable ? "bg-red-500" : "bg-gray-300"
                }`}
              />
              {t("Admin.availability.onlyUnavailable", {}, "Ruptures uniquement")}
              {(unavailableProductsCount > 0 || unavailableOptionsCount > 0) && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                    onlyUnavailable ? "bg-red-200 text-red-900" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {unavailableProductsCount + unavailableOptionsCount}
                </span>
              )}
            </button>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                activeTab === "products"
                  ? t("Admin.availability.searchPlaceholder", {}, "Rechercher un plat, boisson ou ingrédient...")
                  : t("Admin.options.title", {}, "Rechercher un groupe d'options ou une option...")
              }
              className={`${inputClass} ps-10 pe-9`}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Effacer"
                className="absolute end-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Categories bar (visible in products tab) */}
          {activeTab === "products" && categories.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
              <button
                type="button"
                onClick={() => setSelectedCategory("")}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs transition active:scale-95 ${
                  selectedCategory === ""
                    ? "bg-orange-500 text-white font-extrabold shadow-sm"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200 font-semibold"
                }`}
              >
                {t("Admin.history.statusAll", {}, "Toutes")}
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedCategory(c.id)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs transition active:scale-95 ${
                    selectedCategory === c.id
                      ? "bg-orange-500 text-white font-extrabold shadow-sm"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200 font-semibold"
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}

          {/* Expand/Collapse buttons for products view */}
          {activeTab === "products" && filteredProducts.length > 0 && (
            <div className="flex items-center justify-between text-xs text-gray-500 px-1">
              <span>
                {filteredProducts.length} {t("Admin.products.title", {}, "produits")}
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => expandAll(filteredProducts.map((p) => p.id))}
                  className="font-semibold text-orange-600 hover:underline"
                >
                  {t("Admin.availability.expandAll", {}, "Tout déplier")}
                </button>
                <span>·</span>
                <button
                  type="button"
                  onClick={collapseAll}
                  className="font-semibold text-gray-600 hover:underline"
                >
                  {t("Admin.availability.collapseAll", {}, "Tout replier")}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className="max-h-[56vh] overflow-y-auto pr-1 space-y-3">
          {loading ? (
            <div className="space-y-3 py-6">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-20 rounded-2xl bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : activeTab === "products" ? (
            /* ================= TAB 1: PRODUCTS ================= */
            filteredProducts.length === 0 ? (
              <div className="py-12 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200 space-y-1">
                <p className="font-extrabold text-gray-700">Aucun produit trouvé</p>
                <p className="text-xs text-gray-500">
                  Essayez de modifier votre recherche ou vos filtres.
                </p>
              </div>
            ) : (
              filteredProducts.map((p) => {
                const pGroups = (p.groupIds || [])
                  .map((gid) => groupsMap.get(gid))
                  .filter(Boolean);
                const isExpanded = expandedProductIds.has(p.id);
                const isProductBusy = busyIds.has(p.id);

                const unavailableOptions = pGroups.flatMap((g) =>
                  (g.options || []).filter((o) => !o.available)
                );
                const hasUnavailableOptions = unavailableOptions.length > 0;

                return (
                  <div
                    key={p.id}
                    className={`rounded-2xl border transition ${
                      !p.available
                        ? "bg-red-50/40 border-red-200"
                        : hasUnavailableOptions
                        ? "bg-amber-50/30 border-amber-200"
                        : "bg-white border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    {/* Main Product Row */}
                    <div className="p-3.5 flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
                      {/* Left: image + product info */}
                      <div className="flex items-center gap-3 min-w-0">
                        <ProductThumb src={p.imageUrl} name={p.name} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4
                              className={`text-sm font-extrabold truncate ${
                                p.available ? "text-gray-900" : "text-gray-500 line-through"
                              }`}
                            >
                              {p.name}
                            </h4>
                            {p.categoryName && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                                {p.categoryName}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                            <span className="font-black text-orange-600">
                              {formatPrice(p.price)}
                            </span>
                            {pGroups.length > 0 && (
                              <>
                                <span>·</span>
                                <span className="text-[11px] font-semibold text-gray-600">
                                  {pGroups.length} groupe{pGroups.length > 1 ? "s" : ""} d'options
                                </span>
                              </>
                            )}
                            {hasUnavailableOptions && (
                              <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                                {unavailableOptions.length} option{unavailableOptions.length > 1 ? "s" : ""} épuisée{unavailableOptions.length > 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: toggle + options accordion button */}
                      <div className="flex items-center gap-3 ml-auto flex-none">
                        {/* Status label */}
                        <span
                          className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                            p.available
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-red-50 text-red-700 border-red-200"
                          }`}
                        >
                          {p.available ? t("Admin.availability.available", {}, "Disponible") : t("Admin.availability.outOfStock", {}, "Épuisé")}
                        </span>

                        {/* Product toggle */}
                        <div className="flex items-center gap-1.5">
                          {isProductBusy && (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-500" />
                          )}
                          <Toggle
                            checked={p.available}
                            disabled={isProductBusy}
                            onChange={() => toggleProduct(p)}
                            label={`Disponibilité de ${p.name}`}
                          />
                        </div>

                        {/* Accordion trigger if product has options */}
                        {pGroups.length > 0 && (
                          <button
                            type="button"
                            onClick={() => toggleExpand(p.id)}
                            aria-label={isExpanded ? "Replier les options" : "Déplier les options"}
                            className="p-1.5 rounded-xl border border-gray-200 hover:bg-gray-100 text-gray-600 transition"
                            title={isExpanded ? "Replier les options" : "Déplier les options"}
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-orange-600" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Accordion Body: Option Groups */}
                    {pGroups.length > 0 && isExpanded && (
                      <div className="px-4 pb-4 pt-1 border-t border-gray-100 bg-gray-50/60 rounded-b-2xl space-y-3">
                        <p className="text-[11px] font-extrabold uppercase tracking-wider text-gray-500 pt-1">
                          Options du produit :
                        </p>

                        <div className="space-y-3">
                          {pGroups.map((g) => (
                            <div
                              key={g.id}
                              className="bg-white p-3 rounded-xl border border-gray-200 space-y-2 shadow-xs"
                            >
                              <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-2">
                                <span className="font-extrabold text-xs text-gray-900">
                                  {g.name}
                                </span>
                                <span className="text-[10px] font-semibold text-gray-500">
                                  {g.selection === "SINGLE" ? "Choix unique" : "Choix multiple"}
                                </span>
                              </div>

                              <ul className="divide-y divide-gray-100">
                                {(g.options || []).map((o) => {
                                  const isOptionBusy = busyIds.has(o.id);
                                  return (
                                    <li
                                      key={o.id}
                                      className="flex items-center justify-between gap-2 py-1.5 text-xs"
                                    >
                                      <div className="flex items-center gap-2">
                                        <span
                                          className={`font-semibold ${
                                            o.available
                                              ? "text-gray-800"
                                              : "text-gray-400 line-through"
                                          }`}
                                        >
                                          {o.name}
                                        </span>
                                        {o.price > 0 && (
                                          <span className="text-[11px] text-gray-500">
                                            +{formatPrice(o.price)}
                                          </span>
                                        )}
                                      </div>

                                      <div className="flex items-center gap-2">
                                        <span
                                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                            o.available
                                              ? "bg-emerald-50 text-emerald-700"
                                              : "bg-red-50 text-red-600"
                                          }`}
                                        >
                                          {o.available ? t("Admin.availability.dispo", {}, "Dispo") : t("Admin.availability.rupture", {}, "Rupture")}
                                        </span>
                                        {isOptionBusy && (
                                          <Loader2 className="w-3 h-3 animate-spin text-orange-500" />
                                        )}
                                        <Toggle
                                          checked={o.available}
                                          disabled={isOptionBusy}
                                          onChange={() => toggleOption(o)}
                                          label={`Disponibilité de l'option ${o.name}`}
                                        />
                                      </div>
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )
          ) : (
            /* ================= TAB 2: OPTION GROUPS ================= */
            filteredOptionGroups.length === 0 ? (
              <div className="py-12 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200 space-y-1">
                <p className="font-extrabold text-gray-700">Aucun groupe d'options trouvé</p>
                <p className="text-xs text-gray-500">
                  Essayez de modifier votre recherche ou vos filtres.
                </p>
              </div>
            ) : (
              filteredOptionGroups.map((g) => {
                const unavailableInGroup = (g.options || []).filter((o) => !o.available);
                return (
                  <div
                    key={g.id}
                    className="p-4 rounded-2xl border border-gray-200 bg-white space-y-3 shadow-xs"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="font-extrabold text-sm text-gray-900">{g.name}</h4>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200">
                            {g.selection === "SINGLE" ? "Choix unique" : "Choix multiple"}
                          </span>
                          {g.productCount > 0 && (
                            <span className="text-[10px] font-semibold text-gray-500">
                              Utilisé par {g.productCount} produit{g.productCount > 1 ? "s" : ""}
                            </span>
                          )}
                          {unavailableInGroup.length > 0 && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                              {unavailableInGroup.length} option{unavailableInGroup.length > 1 ? "s" : ""} en rupture
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <ul className="divide-y divide-gray-100 border-t border-gray-100 pt-1">
                      {(g.options || []).map((o) => {
                        const isOptionBusy = busyIds.has(o.id);
                        return (
                          <li
                            key={o.id}
                            className="flex items-center justify-between gap-3 py-2 text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className={`font-bold ${
                                  o.available
                                    ? "text-gray-800"
                                    : "text-gray-400 line-through"
                                }`}
                              >
                                {o.name}
                              </span>
                              <span className="text-gray-500 font-semibold">
                                {o.price > 0 ? `+ ${formatPrice(o.price)}` : "gratuit"}
                              </span>
                            </div>

                            <div className="flex items-center gap-2.5">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                  o.available
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : "bg-red-50 text-red-700 border-red-200"
                                }`}
                              >
                                {o.available ? t("Admin.availability.available", {}, "Disponible") : t("Admin.availability.outOfStock", {}, "Épuisé")}
                              </span>
                              {isOptionBusy && (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-500" />
                              )}
                              <Toggle
                                checked={o.available}
                                disabled={isOptionBusy}
                                onChange={() => toggleOption(o)}
                                label={`Disponibilité de ${o.name}`}
                              />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })
            )
          )}
        </div>
      </div>
    </Modal>
  );
}
