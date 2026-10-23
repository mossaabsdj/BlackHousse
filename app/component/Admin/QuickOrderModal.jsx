"use client";

import { useEffect, useState, useMemo } from "react";
import {
  X,
  Plus,
  Minus,
  Trash2,
  Search,
  ShoppingBag,
  Truck,
  Store,
  Check,
  AlertCircle,
  RefreshCw,
  ArrowLeft,
  ImageOff,
  User,
  Phone,
  MapPin,
  StickyNote,
} from "lucide-react";
import { api, formatPrice } from "./adminApi";
import { inputClass, btnPrimary, btnGhost, Modal } from "./Ui";
import { useI18n } from "@/lib/i18n/I18nContext";

/* ------------------------------------------------------------------ */
/* Helpers & shared UI                                                 */
/* ------------------------------------------------------------------ */

const minOf = (g) => (g.required ? Math.max(g.min || 1, 1) : g.min || 0);

const lineKey = (productId, options) =>
  `${productId}|${options
    .map((o) => o.id)
    .sort()
    .join(",")}`;

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

/** One chip style used everywhere (options, communes, categories) */
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

/** Overlay used for the step-2 and step-3 modals (stacked above the main modal) */
function Sheet({ title, step, onClose, onBack, children, footer, size = "md" }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const width = size === "lg" ? "sm:max-w-4xl" : "sm:max-w-2xl";

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`w-full ${width} max-h-[94vh] flex flex-col bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden`}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-200 bg-gradient-to-r from-orange-50 to-white">
          <div className="flex items-center gap-3 min-w-0">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                aria-label="Retour"
                className="w-9 h-9 rounded-full bg-white border border-gray-200 hover:bg-gray-100 flex items-center justify-center flex-none"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="min-w-0">
              {step && (
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-orange-600">{step}</p>
              )}
              <h3 className="font-extrabold text-gray-900 text-lg leading-tight truncate">{title}</h3>
            </div>
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
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-gray-200 bg-gray-50">{footer}</div>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 2: product options modal (image left, chips right)             */
/* ------------------------------------------------------------------ */

function OptionsModal({ product, onClose, onAdd }) {
  const { t } = useI18n();
  const groups = product.optionGroups || [];
  // groupId -> [optionId]; starts with the first available option of each single / required group
  const [selected, setSelected] = useState(() => {
    const init = {};
    groups.forEach((g) => {
      if (g.type !== "single" && minOf(g) === 0) return; // optional multi-choice groups start empty
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

  const extras = chosen.reduce((s, o) => s + o.price, 0);
  const unitPrice = product.price + extras;
  const missing = groups.filter((g) => (selected[g.id] || []).length < minOf(g));
  const valid = missing.length === 0;

  return (
    <Sheet
      title={product.name}
      step=""
      onClose={onClose}
      footer={
        <div className="space-y-3">
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
              <span>{t("OrderingPage.product.addToCart", {}, "Ajouter à la commande")}</span>
              <span className="font-black">{formatPrice(unitPrice * qty)}</span>
            </button>
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-5">
        {/* Left: product card */}
        <div className="flex sm:flex-col items-center sm:items-stretch gap-4 sm:gap-3 sm:sticky sm:top-0 self-start">
          <ProductImage
            src={product.image}
            name={product.name}
            className="w-24 h-24 sm:w-full sm:h-40 rounded-2xl flex-none shadow-md"
          />
          <div className="min-w-0">
            <p className="font-extrabold text-gray-900">{product.name}</p>
            {product.description && <p className="text-xs text-gray-500 line-clamp-3 mt-0.5">{product.description}</p>}
            <p className="text-lg font-black text-orange-600 mt-1">{formatPrice(unitPrice)}</p>
            {extras > 0 && (
              <p className="text-[11px] text-gray-500">
                {formatPrice(product.price)} + {formatPrice(extras)} d'options
              </p>
            )}
          </div>
        </div>

        {/* Right: option groups as chips */}
        <div className="space-y-5 min-w-0">
          {groups.map((g, gi) => {
            const cur = selected[g.id] || [];
            const done = cur.length >= minOf(g);
            const hint =
              g.type === "single"
                ? "Choisissez 1"
                : g.max
                ? `Jusqu'à ${g.max}`
                : "Plusieurs choix";
            return (
              <fieldset key={g.id} className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black flex-none ${
                        done ? "bg-emerald-500 text-white" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {done ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : gi + 1}
                    </span>
                    <legend className="font-extrabold text-gray-900 text-sm truncate">{g.name}</legend>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                      g.required ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-500"
                    }`}
                  >
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
      </div>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* Main modal                                                          */
/* ------------------------------------------------------------------ */

export default function QuickOrderModal({ onClose, onOrderCreated }) {
  const { t, isRTL } = useI18n();
  // Catalog data
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [municipalities, setMunicipalities] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");

  // Product search & category filter
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");

  // Order fields
  const [customerName, setCustomerName] = useState("Client Comptoir");
  const [customerPhone, setCustomerPhone] = useState("0550000000");
  const [fulfillment, setFulfillment] = useState("pickup"); // "pickup" | "delivery"
  const [municipalityName, setMunicipalityName] = useState("");
  const [address, setAddress] = useState("");
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [status] = useState("CONFIRMED");
  const [notes, setNotes] = useState("");

  // Cart / items
  const [items, setItems] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Steps: 1 = products (main modal), 2 = options modal, 3 = client modal
  const [optionsProduct, setOptionsProduct] = useState(null);
  const [clientOpen, setClientOpen] = useState(false);

  // Load products and municipalities
  useEffect(() => {
    let alive = true;
    Promise.all([api.get("/api/products"), api.get("/api/delivery/municipalities")])
      .then(([prodData, muniData]) => {
        if (!alive) return;
        setProducts(prodData?.products || []);
        setCategories(prodData?.categories || []);
        setMunicipalities(muniData?.municipalities || []);
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

  // Filter products by category and search
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat = !selectedCategory || p.categoryId === selectedCategory;
      const matchSearch =
        !search.trim() || p.name.toLowerCase().includes(search.trim().toLowerCase());
      return matchCat && matchSearch && p.available;
    });
  }, [products, selectedCategory, search]);

  // Quantity of a product already in the order (all variants)
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

  // Step 1 -> 2: products with options open their options modal, others are added directly
  const handleSelectProduct = (product) => {
    if ((product.optionGroups || []).length > 0) {
      setOptionsProduct(product);
    } else {
      addLine(product, [], 1, product.price);
    }
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

  const handleRemoveItem = (idx) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  // Select municipality (chip)
  const selectMunicipality = (m) => {
    setMunicipalityName(m.name);
    if (m.deliveryFee != null) setDeliveryFee(m.deliveryFee);
  };

  // Calculations
  const subtotal = useMemo(
    () => items.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0),
    [items]
  );
  const itemCount = items.reduce((s, it) => s + it.quantity, 0);
  const total = subtotal + (fulfillment === "delivery" ? deliveryFee : 0);

  // If the cart becomes empty while the client modal is open, go back to the products
  useEffect(() => {
    if (clientOpen && items.length === 0) setClientOpen(false);
  }, [clientOpen, items.length]);

  // Submit order (step 3)
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (items.length === 0) {
      return setFormError("Veuillez sélectionner au moins un article.");
    }
    if (fulfillment === "delivery" && !address.trim()) {
      return setFormError("Veuillez renseigner l'adresse de livraison.");
    }

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
      {/* ============ STEP 1: products with images ============ */}
      <Modal
        title={t("Admin.orders.addOrder", {}, "Nouvelle commande")}
        onClose={onClose}
        wide={true}
        footer={
          <div className="w-full flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
                {t("OrderingPage.cart.subtotal", {}, "Sous-total")}{itemCount > 0 ? ` · ${itemCount} ${t("OrderingPage.bar.itemOther", { count: itemCount }, "articles")}` : ""}
              </p>
              <p className="text-xl font-black text-gray-900">{formatPrice(subtotal)}</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={onClose} className={btnGhost}>
                {t("common.cancel", {}, "Annuler")}
              </button>
              <button
                type="button"
                disabled={items.length === 0}
                onClick={() => setClientOpen(true)}
                className={`${btnPrimary} flex items-center gap-2 px-6 disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <ShoppingBag className="w-4 h-4" />
                {t("OrderingPage.bar.view", {}, "Continuer")}
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Search */}
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

          {/* Categories: one horizontal row of chips */}
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

          {/* Products grid with images */}
          {catalogLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                <div key={i} className="h-44 rounded-2xl bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : catalogError ? (
            <div role="alert" className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-bold text-red-600 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-none" />
              {catalogError}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">{t("OrderingPage.cart.empty", {}, "Aucun produit disponible.")}</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[58vh] overflow-y-auto pr-1">
              {filteredProducts.map((p) => {
                const count = qtyByProduct[p.id] || 0;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectProduct(p)}
                    className={`relative text-left rounded-2xl border overflow-hidden bg-white transition hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] ${
                      count ? "border-orange-400 ring-2 ring-orange-400/30" : "border-gray-200 hover:border-orange-300"
                    }`}
                  >
                    <ProductImage src={p.image} name={p.name} className="w-full h-28 sm:h-32" />
                    {count > 0 && (
                      <span className="absolute top-2 end-2 min-w-6 h-6 px-1.5 rounded-full bg-orange-600 text-white text-xs font-black flex items-center justify-center shadow">
                        {count}
                      </span>
                    )}
                    <div className="p-2.5">
                      <p className="font-extrabold text-gray-900 text-sm truncate">{p.name}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-sm font-black text-orange-600">{formatPrice(p.price)}</span>
                        {(p.optionGroups || []).length > 0 && (
                          <span className="text-[10px] font-bold text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">
                            {t("Admin.nav.options", {}, "Options")}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </Modal>

      {/* ============ STEP 2: options of the selected product ============ */}
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

      {/* ============ STEP 3: client + delivery / pickup ============ */}
      {clientOpen && (
        <Sheet
          title={t("OrderingPage.checkout.title", {}, "Client et livraison")}
          step=""
          size="lg"
          onClose={() => setClientOpen(false)}
          onBack={() => setClientOpen(false)}
          footer={
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">{t("OrderingPage.cart.total", {}, "Total à payer")}</p>
                <p className="text-2xl font-black text-gray-900">{formatPrice(total)}</p>
              </div>
              <button
                type="submit"
                form="quick-order-form"
                disabled={submitting || items.length === 0}
                className={`${btnPrimary} flex items-center gap-2 px-8 disabled:opacity-50`}
              >
                {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" strokeWidth={3} />}
                {t("OrderingPage.cart.confirm", {}, "Valider la commande")}
              </button>
            </div>
          }
        >
          <form id="quick-order-form" onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-5">
            {/* ---------- Left: client + mode ---------- */}
            <div className="md:col-span-3 space-y-5 min-w-0">
              {formError && (
                <div role="alert" className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-bold text-red-600 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-none" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Client: name + phone side by side */}
              <div>
                <SectionLabel>{t("Admin.history.client", {}, "Client")}</SectionLabel>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="relative">
                    <User className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <input
                      id="qo-name"
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
                      id="qo-phone"
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

              {/* Mode: two cards side by side */}
              <div>
                <SectionLabel>{t("Admin.history.mode", {}, "Mode")}</SectionLabel>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: "pickup", label: t("OrderingPage.checkout.pickup", {}, "Retrait"), sub: t("Admin.orders.badgeReadyPickup", {}, "Le client récupère"), Icon: Store },
                    { id: "delivery", label: t("OrderingPage.checkout.delivery", {}, "Livraison"), sub: t("Admin.orders.badgeInDelivery", {}, "Livré à l'adresse"), Icon: Truck },
                  ].map(({ id, label, sub, Icon }) => {
                    const active = fulfillment === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setFulfillment(id)}
                        aria-pressed={active}
                        className={`flex items-center gap-3 rounded-2xl border p-3 text-start transition active:scale-[0.98] ${
                          active
                            ? "bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-500/30"
                            : "bg-white border-gray-300 text-gray-800 hover:border-orange-300 hover:bg-orange-50"
                        }`}
                      >
                        <span
                          className={`w-10 h-10 rounded-full flex items-center justify-center flex-none ${
                            active ? "bg-white/20" : "bg-gray-100"
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                        </span>
                        <span className="min-w-0">
                          <span className="block font-extrabold text-sm">{label}</span>
                          <span className={`block text-[11px] ${active ? "text-orange-100" : "text-gray-500"}`}>{sub}</span>
                        </span>
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
                      <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                        {municipalities.map((m) => (
                          <Chip key={m.id} active={municipalityName === m.name} onClick={() => selectMunicipality(m)}>
                            <span>{m.name}</span>
                            <span
                              className={`text-xs font-bold ${municipalityName === m.name ? "text-orange-100" : "text-gray-500"}`}
                            >
                              {m.deliveryFee ? `${m.deliveryFee} DA` : "Gratuit"}
                            </span>
                          </Chip>
                        ))}
                      </div>
                    ) : (
                      <input
                        id="qo-commune"
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
                        id="qo-address"
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

              {/* Kitchen note */}
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

            {/* ---------- Right: order recap ---------- */}
            <div className="md:col-span-2 min-w-0">
              <div className="rounded-2xl bg-gray-50 border border-gray-200 p-3 space-y-3 md:sticky md:top-0">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
                    <ShoppingBag className="w-3.5 h-3.5 text-orange-500" /> {t("Admin.history.items", {}, "Articles")} ({itemCount})
                  </span>
                  <button
                    type="button"
                    onClick={() => setItems([])}
                    className="text-[11px] text-red-500 hover:text-red-700 font-semibold"
                  >
                    {t("OrderingPage.cart.remove", {}, "Vider")}
                  </button>
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
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

                <div className="space-y-1 pt-2 border-t border-gray-200 text-xs text-gray-600">
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
                  <div className="flex justify-between text-sm font-black text-gray-900 pt-1 border-t border-gray-200">
                    <span>{t("OrderingPage.cart.total", {}, "Total")}</span>
                    <span className="text-orange-600">{formatPrice(total)}</span>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </Sheet>
      )}
    </>
  );
}