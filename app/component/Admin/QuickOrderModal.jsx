"use client";

import { useEffect, useState, useMemo } from "react";
import {
  X, Plus, Minus, Trash2, Search, ShoppingBag, Truck, Store, Check,
  AlertCircle, RefreshCw, ImageOff, User, Phone, MapPin, StickyNote,
} from "lucide-react";
import { api, formatPrice } from "./adminApi";
import { inputClass, btnPrimary } from "./Ui";
import { useI18n } from "@/lib/i18n/I18nContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/* ------------------------------------------------------------------ */
/* Helpers & shared UI                                                 */
/* ------------------------------------------------------------------ */

const minOf = (g) => (g.required ? Math.max(g.min || 1, 1) : g.min || 0);

const lineKey = (productId, options) =>
  `${productId}|${options.map((o) => o.id).sort().join(",")}`;

function ProductImage({ src, name, className = "" }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 text-gray-300 ${className}`}>
        <ImageOff className="w-6 h-6" />
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
      className={`object-cover ${className}`}
    />
  );
}

function Chip({ active, disabled, onClick, children, className = "" }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={!!active}
      className={`shrink-0 flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
        active
          ? "border-orange-500 bg-orange-500 text-white shadow-md shadow-orange-500/30 font-extrabold"
          : "border-gray-300 bg-white text-gray-800 hover:border-orange-300 hover:bg-orange-50 font-semibold"
      } ${className}`}
    >
      {active && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
      {children}
    </button>
  );
}

function SectionLabel({ children, right }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-2">
      <p className="text-[11px] font-extrabold uppercase tracking-wider text-gray-500">{children}</p>
      {right}
    </div>
  );
}

function QtyStepper({ value, onMinus, onPlus, size = "md" }) {
  const box = size === "sm" ? "w-6 h-6" : "w-8 h-8";
  const icon = size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5";
  return (
    <div className="flex items-center gap-1.5 rounded-full bg-white border border-gray-300 p-1">
      <button
        type="button"
        onClick={onMinus}
        aria-label="Moins"
        className={`${box} rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center`}
      >
        <Minus className={icon} />
      </button>
      <span className={`text-center font-extrabold text-sm ${size === "sm" ? "w-5" : "w-6"}`}>{value}</span>
      <button
        type="button"
        onClick={onPlus}
        aria-label="Plus"
        className={`${box} rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center`}
      >
        <Plus className={icon} />
      </button>
    </div>
  );
}

/** Overlay used only for the product options popup */
function Sheet({ title, onClose, children, footer }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full sm:max-w-3xl max-h-[94vh] flex flex-col bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-200 bg-gradient-to-r from-orange-50 to-white">
          <h3 className="font-extrabold text-gray-900 text-lg leading-tight truncate">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="w-9 h-9 rounded-full bg-white border border-gray-200 hover:bg-gray-100 flex items-center justify-center flex-none"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-gray-200 bg-gray-50">{footer}</div>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Product options popup                                               */
/* ------------------------------------------------------------------ */

function OptionsModal({ product, onClose, onAdd }) {
  const { t } = useI18n();
  const groups = product.optionGroups || [];

  // Pre-select the first available option of required / single groups
  const [selected, setSelected] = useState(() => {
    const init = {};
    groups.forEach((g) => {
      if (g.type !== "single" && minOf(g) === 0) return;
      const first = (g.options || []).find((o) => o.available);
      if (first) init[g.id] = [first.id];
    });
    return init;
  });
  const [qty, setQty] = useState(1);

  const toggle = (g, opt) => {
    if (!opt.available) return;
    setSelected((prev) => {
      const cur = prev[g.id] || [];
      if (g.type === "single") return { ...prev, [g.id]: [opt.id] };
      if (cur.includes(opt.id)) return { ...prev, [g.id]: cur.filter((x) => x !== opt.id) };
      if (g.max && cur.length >= g.max) return prev;
      return { ...prev, [g.id]: [...cur, opt.id] };
    });
  };

  const chosen = useMemo(
    () =>
      groups.flatMap((g) =>
        (g.options || [])
          .filter((o) => (selected[g.id] || []).includes(o.id))
          .map((o) => ({ groupId: g.id, groupName: g.name, id: o.id, name: o.name, price: o.price || 0 }))
      ),
    [groups, selected]
  );

  const unitPrice = product.price + chosen.reduce((s, o) => s + o.price, 0);
  const missing = groups.filter((g) => (selected[g.id] || []).length < minOf(g));
  const valid = missing.length === 0;

  return (
    <Sheet
      title={product.name}
      onClose={onClose}
      footer={
        <div className="space-y-2">
          {!valid && (
            <p className="text-xs font-semibold text-red-600 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              Choisissez : {missing.map((g) => g.name).join(", ")}
            </p>
          )}
          <div className="flex items-center gap-3">
            <QtyStepper
              value={qty}
              onMinus={() => setQty((q) => Math.max(1, q - 1))}
              onPlus={() => setQty((q) => q + 1)}
            />
            <button
              type="button"
              disabled={!valid}
              onClick={() => onAdd(chosen, qty, unitPrice)}
              className={`${btnPrimary} flex-1 flex items-center justify-between gap-2 px-5 disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <span>{t("OrderingPage.product.addToCart", {}, "Ajouter")}</span>
              <span className="font-black">{formatPrice(unitPrice * qty)}</span>
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        {groups.map((g) => {
          const cur = selected[g.id] || [];
          const hint =
            g.type === "single" ? "1 choix" : g.max ? `Max ${g.max}` : "Plusieurs";

          return (
            <fieldset key={g.id}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <legend className="font-extrabold text-gray-900 text-sm">{g.name}</legend>
                <span className="text-[11px] font-bold text-gray-500">
                  {g.required ? "Obligatoire" : "Optionnel"} · {hint}
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {(g.options || []).map((o) => {
                  const active = cur.includes(o.id);
                  return (
                    <Chip key={o.id} active={active} disabled={!o.available} onClick={() => toggle(g, o)}>
                      <span>{o.name}</span>
                      {o.price > 0 && (
                        <span className={`text-xs font-bold ${active ? "text-orange-100" : "text-gray-500"}`}>
                          +{formatPrice(o.price)}
                        </span>
                      )}
                    </Chip>
                  );
                })}
              </div>
            </fieldset>
          );
        })}
      </div>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* Main modal (single screen)                                          */
/* ------------------------------------------------------------------ */

export default function QuickOrderModal({ onClose, onOrderCreated }) {
  const { t } = useI18n();

  // Catalog
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [municipalities, setMunicipalities] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");

  // Filters
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");

  // Order fields
  const [customerName, setCustomerName] = useState("Client Comptoir");
  const [customerPhone, setCustomerPhone] = useState("0550000000");
  const [fulfillment, setFulfillment] = useState("pickup");
  const [municipalityName, setMunicipalityName] = useState("");
  const [address, setAddress] = useState("");
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [status] = useState("CONFIRMED");
  const [notes, setNotes] = useState("");

  // Cart
  const [items, setItems] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // UI
  const [optionsProduct, setOptionsProduct] = useState(null);
  const [tab, setTab] = useState("menu"); // mobile only: "menu" | "order"

  // Escape closes the main modal (unless the options popup is open: it handles its own)
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !optionsProduct && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, optionsProduct]);

  // Load catalog
  useEffect(() => {
    let alive = true;
    Promise.all([api.get("/api/products"), api.get("/api/delivery/municipalities")])
      .then(([prodData, muniData]) => {
        if (!alive) return;
        setProducts(prodData?.products || []);
        setCategories(prodData?.categories || []);
        const munis = muniData?.municipalities || [];
        setMunicipalities(munis);
        if (munis.length > 0) {
          setMunicipalityName((cur) => cur || munis[0].name);
          if (munis[0].deliveryFee != null) {
            setDeliveryFee((cur) => (cur > 0 ? cur : (munis[0].deliveryFee || 0)));
          }
        }
      })
      .catch((err) => {
        if (alive) setCatalogError(err.message || "Impossible de charger le catalogue.");
      })
      .finally(() => {
        if (alive) setCatalogLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter(
      (p) =>
        p.available &&
        (!selectedCategory || p.categoryId === selectedCategory) &&
        (!q || p.name.toLowerCase().includes(q))
    );
  }, [products, selectedCategory, search]);

  const qtyByProduct = useMemo(() => {
    const map = {};
    items.forEach((it) => {
      map[it.productId] = (map[it.productId] || 0) + it.quantity;
    });
    return map;
  }, [items]);

  /* ----------------------------- cart actions ----------------------------- */

  const addLine = (product, options, quantity, unitPrice) => {
    const key = lineKey(product.id, options);
    setItems((prev) => {
      const idx = prev.findIndex((it) => it.key === key);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], quantity: copy[idx].quantity + quantity };
        return copy;
      }
      return [
        ...prev,
        { key, productId: product.id, name: product.name, image: product.image, unitPrice, quantity, options },
      ];
    });
    setFormError("");
  };

  const handleSelectProduct = (product) => {
    if ((product.optionGroups || []).length > 0) setOptionsProduct(product);
    else addLine(product, [], 1, product.price);
  };

  const handleUpdateQty = (idx, delta) => {
    setItems((prev) => {
      const copy = [...prev];
      const newQty = copy[idx].quantity + delta;
      if (newQty <= 0) return copy.filter((_, i) => i !== idx);
      copy[idx] = { ...copy[idx], quantity: newQty };
      return copy;
    });
  };

  const handleRemoveItem = (idx) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const selectMunicipality = (m) => {
    if (!m) return;
    setMunicipalityName(m.name);
    if (m.deliveryFee != null) setDeliveryFee(m.deliveryFee);
  };

  // Auto-select first municipality by default when municipalities load
  useEffect(() => {
    if (municipalities.length > 0 && !municipalityName) {
      selectMunicipality(municipalities[0]);
    }
  }, [municipalities, municipalityName]);

  const subtotal = useMemo(
    () => items.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0),
    [items]
  );
  const itemCount = items.reduce((s, it) => s + it.quantity, 0);
  const total = subtotal + (fulfillment === "delivery" ? deliveryFee : 0);

  /* -------------------------------- submit -------------------------------- */

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (items.length === 0) return setFormError("Veuillez sélectionner au moins un article.");
    if (fulfillment === "delivery" && !address.trim())
      return setFormError("Veuillez renseigner l'adresse de livraison.");

    setSubmitting(true);
    setFormError("");

    try {
      const payload = {
        customerName: customerName.trim() || "Client Comptoir",
        customerPhone: customerPhone.trim() || "0550000000",
        fulfillment: fulfillment === "delivery" ? "DELIVERY" : "PICKUP",
        municipalityName: fulfillment === "delivery" ? municipalityName : null,
        address: fulfillment === "delivery" ? address : null,
        deliveryFee: fulfillment === "delivery" ? deliveryFee : 0,
        status,
        notes: notes.trim() || null,
        items: items.map((it) => ({
          productId: it.productId,
          name: it.name,
          unitPrice: it.unitPrice,
          quantity: it.quantity,
          options: it.options || [],
        })),
      };

      const res = await api.post("/api/admin/orders", payload);
      onOrderCreated?.(res.order || res);
      onClose();
    } catch (err) {
      setFormError(err.message || "Erreur lors de la création de la commande.");
    } finally {
      setSubmitting(false);
    }
  };

  /* --------------------------------- render -------------------------------- */

  return (
    <>
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-3"
        onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("Admin.orders.addOrder", {}, "Nouvelle commande")}
          className="w-full h-full sm:h-[96vh] sm:max-w-[1500px] flex flex-col bg-white sm:rounded-3xl shadow-2xl overflow-hidden"
        >
          {/* ---------- Header ---------- */}
          <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-gray-200 bg-gradient-to-r from-orange-50 to-white flex-none">
            <h2 className="font-extrabold text-gray-900 text-lg truncate">
              {t("Admin.orders.addOrder", {}, "Nouvelle commande")}
            </h2>

            {/* Mobile toggle */}
            <div className="lg:hidden flex items-center rounded-full bg-gray-100 p-1 text-xs font-extrabold">
              <button
                type="button"
                onClick={() => setTab("menu")}
                className={`px-3 py-1.5 rounded-full transition ${tab === "menu" ? "bg-orange-500 text-white shadow" : "text-gray-600"}`}
              >
                {t("Admin.nav.products", {}, "Menu")}
              </button>
              <button
                type="button"
                onClick={() => setTab("order")}
                className={`px-3 py-1.5 rounded-full transition flex items-center gap-1.5 ${tab === "order" ? "bg-orange-500 text-white shadow" : "text-gray-600"}`}
              >
                {t("Admin.history.items", {}, "Commande")}
                {itemCount > 0 && (
                  <span className={`min-w-5 h-5 px-1 rounded-full text-[10px] flex items-center justify-center ${tab === "order" ? "bg-white text-orange-600" : "bg-orange-500 text-white"}`}>
                    {itemCount}
                  </span>
                )}
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer"
              className="w-9 h-9 rounded-full bg-white border border-gray-200 hover:bg-gray-100 flex items-center justify-center flex-none"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* ---------- Body ---------- */}
          <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
            {/* ===== LEFT: products (takes the remaining width) ===== */}
            <section
              className={`${tab === "menu" ? "flex" : "hidden"} lg:flex flex-1 basis-0 min-w-0 min-h-0 flex-col`}
            >
              <div className="flex-none p-4 pb-2 space-y-3">
                <div className="relative">
                  <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder={t("OrderingPage.catalog.searchPlaceholder", {}, "Rechercher un plat, boisson...")}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className={`${inputClass} ps-10`}
                  />
                </div>
                <div className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
                  <Chip active={selectedCategory === ""} onClick={() => setSelectedCategory("")}>
                    {t("OrderingPage.catalog.allCategories", {}, "Tout")}
                  </Chip>
                  {categories.map((c) => (
                    <Chip key={c.id} active={selectedCategory === c.id} onClick={() => setSelectedCategory(c.id)}>
                      {c.name}
                    </Chip>
                  ))}
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable] px-4 pb-4">
                {catalogLoading ? (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-2.5">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <div key={i} className="aspect-square rounded-2xl bg-gray-100 animate-pulse" />
                    ))}
                  </div>
                ) : catalogError ? (
                  <div role="alert" className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-bold text-red-600 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-none" />
                    {catalogError}
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="text-center py-10 text-gray-400 text-sm">
                    {t("OrderingPage.cart.empty", {}, "Aucun produit disponible.")}
                  </div>
                ) : (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-2.5">
                    {filteredProducts.map((p) => {
                      const count = qtyByProduct[p.id] || 0;
                      const hasOptions = (p.optionGroups || []).length > 0;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleSelectProduct(p)}
                          className={`relative aspect-square overflow-hidden rounded-2xl border bg-gray-100 text-start transition active:scale-[0.97] hover:shadow-md ${
                            count
                              ? "border-orange-400 ring-2 ring-orange-400/40"
                              : "border-gray-200 hover:border-orange-300"
                          }`}
                        >
                          <ProductImage src={p.image} name={p.name} className="absolute inset-0 w-full h-full" />

                          {/* Name + price over the image */}
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-2 pb-2 pt-8">
                            <p className="text-[12px] font-extrabold leading-tight text-white line-clamp-2">{p.name}</p>
                            <p className="text-xs font-black text-orange-300 mt-0.5">{formatPrice(p.price)}</p>
                          </div>

                          {/* Has options */}
                          {hasOptions && (
                            <span className="absolute top-1.5 start-1.5 rounded-full bg-white/90 px-1.5 py-0.5 text-[9px] font-extrabold text-gray-700 shadow">
                              {t("Admin.nav.options", {}, "Options")}
                            </span>
                          )}

                          {/* Quantity in cart */}
                          {count > 0 && (
                            <span className="absolute top-1.5 end-1.5 min-w-6 h-6 px-1.5 rounded-full bg-orange-600 text-white text-xs font-black flex items-center justify-center shadow">
                              {count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Mobile bottom bar */}
              <div className="lg:hidden flex-none border-t border-gray-200 bg-white p-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
                    {t("OrderingPage.cart.subtotal", {}, "Sous-total")} · {itemCount}
                  </p>
                  <p className="text-lg font-black text-gray-900">{formatPrice(subtotal)}</p>
                </div>
                <button
                  type="button"
                  disabled={items.length === 0}
                  onClick={() => setTab("order")}
                  className={`${btnPrimary} flex items-center gap-2 px-6 disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <ShoppingBag className="w-4 h-4" />
                  {t("OrderingPage.bar.view", {}, "Continuer")}
                </button>
              </div>
            </section>

            {/* ===== RIGHT: cart + client + delivery (fixed width) ===== */}
            <form
              onSubmit={handleSubmit}
              className={`${tab === "order" ? "flex" : "hidden"} lg:flex min-h-0 min-w-0 flex-1 lg:flex-none lg:shrink-0 lg:grow-0 lg:w-[440px] xl:w-[500px] flex-col bg-gray-50 border-t lg:border-t-0 lg:border-s border-gray-200`}
            >
              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable] p-4 space-y-5">
                {formError && (
                  <div role="alert" className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-bold text-red-600 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-none" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Cart */}
                <div>
                  <SectionLabel
                    right={
                      items.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setItems([])}
                          className="text-[11px] text-red-500 hover:text-red-700 font-semibold"
                        >
                          {t("OrderingPage.cart.remove", {}, "Vider")}
                        </button>
                      )
                    }
                  >
                    {t("Admin.history.items", {}, "Articles")} ({itemCount})
                  </SectionLabel>

                  {items.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-gray-300 bg-white py-6 text-center text-xs font-semibold text-gray-400">
                      {t("OrderingPage.cart.empty", {}, "Aucun article")}
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[34vh] overflow-y-auto pe-1">
                      {items.map((it, idx) => (
                        <div key={it.key} className="flex items-center gap-2.5 p-2 rounded-xl bg-white border border-gray-200">
                          <ProductImage src={it.image} name={it.name} className="w-12 h-12 rounded-lg flex-none" />
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-gray-900 text-xs truncate">{it.name}</p>
                            {it.options.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-0.5">
                                {it.options.map((o) => (
                                  <span
                                    key={o.id}
                                    className="text-[10px] font-semibold text-orange-700 bg-orange-50 border border-orange-100 rounded-full px-1.5"
                                  >
                                    {o.name}
                                  </span>
                                ))}
                              </div>
                            )}
                            <p className="text-gray-500 font-mono text-[11px] mt-0.5">{formatPrice(it.unitPrice)}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1 flex-none">
                            <QtyStepper
                              size="sm"
                              value={it.quantity}
                              onMinus={() => handleUpdateQty(idx, -1)}
                              onPlus={() => handleUpdateQty(idx, 1)}
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              aria-label="Supprimer"
                              className="text-gray-400 hover:text-red-500"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Client */}
                <div>
                  <SectionLabel>{t("Admin.history.client", {}, "Client")}</SectionLabel>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-3">
                    <div className="relative">
                      <User className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      <input
                        type="text"
                        aria-label="Nom du client"
                        placeholder={t("OrderingPage.checkout.namePlaceholder", {}, "Client Comptoir")}
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className={`${inputClass} ps-10`}
                      />
                    </div>
                    <div className="relative">
                      <Phone className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      <input
                        type="tel"
                        inputMode="tel"
                        aria-label="Téléphone"
                        placeholder="05..."
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        className={`${inputClass} ps-10`}
                        dir="ltr"
                      />
                    </div>
                  </div>
                </div>

                {/* Mode */}
                <div>
                  <SectionLabel>{t("Admin.history.mode", {}, "Mode")}</SectionLabel>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: "pickup", label: t("OrderingPage.checkout.pickup", {}, "Retrait"), Icon: Store },
                      { id: "delivery", label: t("OrderingPage.checkout.delivery", {}, "Livraison"), Icon: Truck },
                    ].map(({ id, label, Icon }) => {
                      const active = fulfillment === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => {
                            setFulfillment(id);
                            if (id === "delivery" && municipalities.length > 0 && !municipalityName) {
                              selectMunicipality(municipalities[0]);
                            }
                          }}
                          aria-pressed={active}
                          className={`flex items-center justify-center gap-2 rounded-2xl border py-3 font-extrabold text-sm transition active:scale-[0.98] ${
                            active
                              ? "bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-500/30"
                              : "bg-white border-gray-300 text-gray-800 hover:border-orange-300 hover:bg-orange-50"
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Delivery details */}
                {fulfillment === "delivery" && (
                  <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4">
                    <div>
                      <SectionLabel
                        right={
                          municipalityName && (
                            <span className="text-[11px] font-bold text-orange-600">
                              {t("Admin.orders.deliveryFee", { fee: deliveryFee ? formatPrice(deliveryFee) : "Gratuit" })}
                            </span>
                          )
                        }
                      >
                        {t("OrderingPage.checkout.municipality", {}, "Commune")}
                      </SectionLabel>
                      {municipalities.length > 0 ? (
                        <Select
                          value={municipalityName || municipalities[0]?.name}
                          onValueChange={(val) => {
                            const m = municipalities.find((item) => item.name === val);
                            if (m) selectMunicipality(m);
                            else setMunicipalityName(val);
                          }}
                        >
                          <SelectTrigger className="w-full h-11 rounded-xl border border-gray-200 bg-white px-3.5 text-sm text-gray-900 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 shadow-sm">
                            <SelectValue placeholder={t("OrderingPage.checkout.municipalityPlaceholder", {}, "Sélectionner une commune")} />
                          </SelectTrigger>
                          <SelectContent className="bg-white border border-gray-200 shadow-xl max-h-60 z-[150]">
                            {municipalities.map((m) => (
                              <SelectItem key={m.id} value={m.name} className="py-2.5 cursor-pointer text-sm font-medium">
                                <div className="flex items-center justify-between w-full gap-4">
                                  <span className="font-semibold text-gray-900">{m.name}</span>
                                  <span className="text-xs font-bold text-orange-600">
                                    {m.deliveryFee ? `${formatPrice(m.deliveryFee)}` : "Gratuit"}
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <input
                          type="text"
                          placeholder={t("OrderingPage.checkout.municipalityPlaceholder", {}, "Nom de la commune")}
                          value={municipalityName}
                          onChange={(e) => setMunicipalityName(e.target.value)}
                          className={inputClass}
                        />
                      )}
                    </div>

                    <div>
                      <SectionLabel>{t("OrderingPage.checkout.address", {}, "Adresse complète")}</SectionLabel>
                      <div className="relative">
                        <MapPin className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        <input
                          type="text"
                          placeholder={t("OrderingPage.checkout.addressPlaceholder", {}, "Quartier, rue, numéro de porte...")}
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          className={`${inputClass} ps-10`}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Notes */}
                <div>
                  <SectionLabel>{t("OrderingPage.checkout.notes", {}, "Note pour la cuisine")}</SectionLabel>
                  <div className="relative">
                    <StickyNote className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <input
                      type="text"
                      placeholder={t("OrderingPage.checkout.notesPlaceholder", {}, "Ex : sans sel, sauce à part...")}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className={`${inputClass} ps-10`}
                    />
                  </div>
                </div>
              </div>

              {/* Totals + submit (always visible) */}
              <div className="flex-none border-t border-gray-200 bg-white p-4 space-y-3">
                <div className="space-y-1 text-xs text-gray-600">
                  <div className="flex justify-between">
                    <span>{t("OrderingPage.cart.subtotal", {}, "Sous-total articles")}</span>
                    <span className="font-mono font-bold text-gray-900">{formatPrice(subtotal)}</span>
                  </div>
                  {fulfillment === "delivery" && (
                    <div className="flex justify-between">
                      <span>{t("OrderingPage.checkout.deliveryFee", {}, "Frais de livraison")}</span>
                      <span className="font-mono font-bold text-gray-900">{formatPrice(deliveryFee)}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
                      {t("OrderingPage.cart.total", {}, "Total à payer")}
                    </p>
                    <p className="text-2xl font-black text-orange-600">{formatPrice(total)}</p>
                  </div>
                  <button
                    type="submit"
                    disabled={submitting || items.length === 0}
                    className={`${btnPrimary} flex items-center gap-2 px-8 disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {submitting ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" strokeWidth={3} />
                    )}
                    {t("OrderingPage.cart.confirm", {}, "Valider")}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Options popup (the only secondary modal) */}
      {optionsProduct && (
        <OptionsModal
          key={optionsProduct.id}
          product={optionsProduct}
          onClose={() => setOptionsProduct(null)}
          onAdd={(options, qty, unitPrice) => {
            addLine(optionsProduct, options, qty, unitPrice);
            setOptionsProduct(null);
          }}
        />
      )}
    </>
  );
}