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
} from "lucide-react";
import { api, formatPrice } from "./adminApi";
import { inputClass, btnPrimary, btnGhost, Modal, Field, Badge } from "./Ui";

export default function QuickOrderModal({ onClose, onOrderCreated }) {
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
  const [status, setStatus] = useState("CONFIRMED");
  const [notes, setNotes] = useState("");

  // Cart / items
  const [items, setItems] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

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

  // Add product to cart
  const handleAddProduct = (product) => {
    setItems((prev) => {
      const idx = prev.findIndex((it) => it.productId === product.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], quantity: copy[idx].quantity + 1 };
        return copy;
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          unitPrice: product.price,
          quantity: 1,
          options: [],
        },
      ];
    });
    setFormError("");
  };

  // Change quantity
  const handleUpdateQty = (idx, delta) => {
    setItems((prev) => {
      const copy = [...prev];
      const newQty = copy[idx].quantity + delta;
      if (newQty <= 0) {
        return copy.filter((_, i) => i !== idx);
      }
      copy[idx] = { ...copy[idx], quantity: newQty };
      return copy;
    });
  };

  // Remove item
  const handleRemoveItem = (idx) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  // Select municipality
  const handleMunicipalityChange = (e) => {
    const val = e.target.value;
    setMunicipalityName(val);
    const m = municipalities.find((x) => x.name === val || x.id === val);
    if (m && m.deliveryFee != null) {
      setDeliveryFee(m.deliveryFee);
    }
  };

  // Calculations
  const subtotal = useMemo(
    () => items.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0),
    [items]
  );
  const total = subtotal + (fulfillment === "delivery" ? deliveryFee : 0);

  // Submit order
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

  return (
    <Modal
      title="Ajouter une commande rapidement"
      onClose={onClose}
      wide={true}
      footer={
        <div className="w-full flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-500">Total :</span>
            <span className="text-xl font-black text-gray-900">{formatPrice(total)}</span>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className={btnGhost} disabled={submitting}>
              Annuler
            </button>
            <button
              type="submit"
              form="quick-order-form"
              disabled={submitting || items.length === 0}
              className={`${btnPrimary} flex items-center gap-2 px-6`}
            >
              {submitting && <RefreshCw className="w-4 h-4 animate-spin" />}
              Valider la commande
            </button>
          </div>
        </div>
      }
    >
      <form id="quick-order-form" onSubmit={handleSubmit} className="space-y-5">
        {formError && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-bold text-red-600 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-none" />
            <span>{formError}</span>
          </div>
        )}

        {/* ---------------- Client & Fulfillment Details ---------------- */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-2xl bg-gray-50 border border-gray-200/80">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Client</label>
            <input
              type="text"
              required
              placeholder="Nom du client"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className={`${inputClass} text-xs py-1.5`}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Téléphone</label>
            <input
              type="tel"
              placeholder="05..."
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              className={`${inputClass} text-xs py-1.5`}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Mode de retrait</label>
            <div className="flex rounded-xl overflow-hidden border border-gray-300 bg-white p-0.5">
              <button
                type="button"
                onClick={() => setFulfillment("pickup")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1 text-xs font-bold rounded-lg transition ${
                  fulfillment === "pickup"
                    ? "bg-orange-500 text-white shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <Store className="w-3.5 h-3.5" /> Sur place
              </button>
              <button
                type="button"
                onClick={() => setFulfillment("delivery")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1 text-xs font-bold rounded-lg transition ${
                  fulfillment === "delivery"
                    ? "bg-orange-500 text-white shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <Truck className="w-3.5 h-3.5" /> Livraison
              </button>
            </div>
          </div>

          {fulfillment === "delivery" && (
            <>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Commune</label>
                {municipalities.length > 0 ? (
                  <select
                    value={municipalityName}
                    onChange={handleMunicipalityChange}
                    className={`${inputClass} text-xs py-1.5`}
                  >
                    <option value="">Sélectionner une commune</option>
                    {municipalities.map((m) => (
                      <option key={m.id} value={m.name}>
                        {m.name} ({m.deliveryFee ? `${m.deliveryFee} DA` : "Gratuit"})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder="Nom de la commune"
                    value={municipalityName}
                    onChange={(e) => setMunicipalityName(e.target.value)}
                    className={`${inputClass} text-xs py-1.5`}
                  />
                )}
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-gray-700 mb-1">Adresse complète</label>
                <input
                  type="text"
                  required
                  placeholder="Quartier, rue, numéro de porte..."
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className={`${inputClass} text-xs py-1.5`}
                />
              </div>
            </>
          )}
        </div>

        {/* ---------------- Split Layout: Product Picker & Current Cart ---------------- */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left Column: Product Catalog (7 cols) */}
          <div className="lg:col-span-7 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">
                Menu & Produits
              </span>
              <span className="text-xs text-gray-400">Cliquez pour ajouter</span>
            </div>

            {/* Search & Category Pills */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher un plat, boisson..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={`${inputClass} pl-8 text-xs py-1.5`}
                />
              </div>
              <select
                aria-label="Catégorie"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className={`${inputClass} w-auto text-xs py-1.5`}
              >
                <option value="">Toutes les catégories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Products Grid */}
            <div className="max-h-64 overflow-y-auto pr-1">
              {catalogLoading ? (
                <div className="text-center py-8 text-gray-400 text-xs">Chargement du menu...</div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-xs">Aucun produit disponible.</div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {filteredProducts.map((p) => {
                    const inCart = items.find((it) => it.productId === p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleAddProduct(p)}
                        className={`p-2.5 rounded-xl border text-left transition relative flex flex-col justify-between ${
                          inCart
                            ? "bg-orange-50 border-orange-300 shadow-sm"
                            : "bg-white border-gray-200 hover:border-orange-300 hover:bg-orange-50/50"
                        }`}
                      >
                        {inCart && (
                          <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-orange-600 text-white font-bold text-[10px] flex items-center justify-center shadow-sm">
                            {inCart.quantity}
                          </span>
                        )}
                        <p className="font-bold text-gray-900 text-xs truncate max-w-[120px]">{p.name}</p>
                        <p className="text-xs font-black text-orange-600 mt-1">{formatPrice(p.price)}</p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Selected Order Items (5 cols) */}
          <div className="lg:col-span-5 space-y-3 p-3 rounded-2xl bg-gray-50 border border-gray-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                <span className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
                  <ShoppingBag className="w-3.5 h-3.5 text-orange-500" /> Articles choisis ({items.length})
                </span>
                {items.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setItems([])}
                    className="text-[11px] text-red-500 hover:text-red-700 font-semibold"
                  >
                    Vider
                  </button>
                )}
              </div>

              {/* Items List */}
              <div className="max-h-52 overflow-y-auto space-y-2 py-2 pr-1">
                {items.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-8">
                    Sélectionnez des articles à gauche pour constituer la commande.
                  </p>
                ) : (
                  items.map((it, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white border border-gray-200 text-xs shadow-2xs"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 truncate">{it.name}</p>
                        <p className="text-gray-500 font-mono text-[11px]">{formatPrice(it.unitPrice)}</p>
                      </div>

                      <div className="flex items-center gap-1.5 flex-none">
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(idx, -1)}
                          className="w-5 h-5 rounded-md bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-700"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-5 text-center font-bold text-gray-900">{it.quantity}</span>
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(idx, 1)}
                          className="w-5 h-5 rounded-md bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-700"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="w-5 h-5 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-500 flex items-center justify-center ml-1"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Subtotals & Notes */}
            <div className="pt-2 border-t border-gray-200 space-y-2 text-xs">
              <input
                type="text"
                placeholder="Note pour la cuisine (ex: sans sel, sauce à part...)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className={`${inputClass} text-xs py-1.5`}
              />

              <div className="space-y-1 pt-1 text-gray-600">
                <div className="flex justify-between">
                  <span>Sous-total articles :</span>
                  <span className="font-mono font-bold text-gray-900">{formatPrice(subtotal)}</span>
                </div>
                {fulfillment === "delivery" && (
                  <div className="flex justify-between">
                    <span>Frais de livraison :</span>
                    <span className="font-mono font-bold text-gray-900">{formatPrice(deliveryFee)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-black text-gray-900 pt-1 border-t border-gray-200">
                  <span>Total à payer :</span>
                  <span className="text-orange-600">{formatPrice(total)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
}

