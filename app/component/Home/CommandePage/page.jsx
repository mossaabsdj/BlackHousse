"use client";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, ClipboardList, Search, ShoppingBag } from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nContext";
import { createOrder, fetchCatalog, fetchMunicipalities } from "./api";
import { computeTotals, fmt, formatPrice, norm, resolveLine, useCart, useMyOrders } from "./Logic";
import { Thumb, primaryBtn } from "./UI";
import ProductModal from "./Productmodal";
import CartDrawer from "./Cartdrawer";
import CheckoutModal from "./Checkoutmodal";
import TrackModal from "./Trackmodal";
import { useRealtimeProducts } from "@/lib/Firebase.js";
import Progression from "@/app/component/Proogression/page";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";


// Doit correspondre à l'id de l'emplacement dans le header (AppNavbar)
const HEADER_SLOT_ID = "header-mobile-slot";

export default function OrderingPage() {
  const { content, isRTL, currency, locale } = useI18n();
  const t = content.OrderingPage;
  const cart = useCart();
  const myOrders = useMyOrders();

  const [catalog, setCatalog] = useState({ status: "loading", categories: [], products: [] });
  const [municipalities, setMunicipalities] = useState({ status: "idle", list: [] });
  const [query, setQuery] = useState("");
  const [productModal, setProductModal] = useState(null); // { product, line? }
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [trackOpen, setTrackOpen] = useState(null); // { phone, autoSearch, reference }
  const [headerSlot, setHeaderSlot] = useState(null); // emplacement des boutons dans le header (mobile)
  const abortRef = useRef(null);


  // Retrouve l'emplacement du header (quelques essais au cas où il se monte après la page)
  useEffect(() => {
    const find = () => {
      const el = document.getElementById(HEADER_SLOT_ID);
      if (el) setHeaderSlot(el);
      return !!el;
    };
    if (find()) return;
    let tries = 0;
    const id = setInterval(() => {
      if (find() || ++tries > 20) clearInterval(id);
    }, 100);
    return () => clearInterval(id);
  }, []);

  /* ----------------------------- data loading ---------------------------- */
  const loadCatalog = useCallback(async ({ silent = false } = {}) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    if (!silent) setCatalog((c) => ({ ...c, status: "loading" }));
    try {
      const data = await fetchCatalog(ctrl.signal);
      setCatalog({ status: "ready", ...data });
    } catch (e) {
      if (e?.name === "AbortError") return;
      // a failed silent refresh keeps the last good catalog
      setCatalog((c) => (silent && c.status === "ready" ? c : { ...c, status: "error" }));
    }
  }, []);

  useEffect(() => {
    loadCatalog();
    return () => abortRef.current?.abort();
  }, [loadCatalog]);

  // Synchronize product availability in real-time across all connected users via Firebase
  useRealtimeProducts((id, changes) => {
    setCatalog((prev) => {
      if (prev.status !== "ready") return prev;
      let hasChange = false;
      const updatedProducts = prev.products.map((p) => {
        if (p.id === id) {
          hasChange = true;
          return {
            ...p,
            ...(changes.available !== undefined ? { available: changes.available } : {}),
            ...(changes.isActive !== undefined ? { isActive: changes.isActive } : {}),
            ...(changes.price !== undefined ? { price: changes.price } : {}),
            ...(changes.name !== undefined ? { name: changes.name } : {}),
          };
        }
        return p;
      });
      return hasChange ? { ...prev, products: updatedProducts } : prev;
    });

    // If customer is currently customizing this product in the modal
    setProductModal((curr) => {
      if (curr?.product?.id === id) {
        if (changes.available === false || changes.isActive === false) {
          return null;
        }
        return { ...curr, product: { ...curr.product, ...changes } };
      }
      return curr;
    });
  });

  const loadMunicipalities = useCallback(async () => {
    if (municipalities.status !== "idle") return;
    setMunicipalities({ status: "loading", list: [] });
    const list = await fetchMunicipalities();
    setMunicipalities({ status: "ready", list });
  }, [municipalities.status]);

  /* ------------------------------ derived data --------------------------- */
  const catalogReady = catalog.status === "ready";
  const productsById = useMemo(() => new Map(catalog.products.map((p) => [p.id, p])), [catalog.products]);
  const resolved = useMemo(
    () => (catalogReady ? cart.lines.map((l) => resolveLine(l, productsById)) : []),
    [catalogReady, cart.lines, productsById]
  );
  const totals = useMemo(() => computeTotals(resolved), [resolved]);
  const itemCount = cart.lines.reduce((s, l) => s + l.quantity, 0);

  // One flat list (no category sections): search filter, available products first
  const visibleProducts = useMemo(() => {
    const q = norm(query);
    const list = catalog.products.filter(
      (p) => !q || norm(p.name).includes(q) || norm(p.description).includes(q)
    );
    return [...list].sort((a, b) => Number(b.available) - Number(a.available));
  }, [catalog.products, query]);

  /* -------------------------------- actions ------------------------------ */
  const openProduct = (product) => product.available && setProductModal({ product });
  const openCheckout = () => {
    setCartOpen(false);
    setCheckoutOpen(true);
    loadCatalog({ silent: true }); // re-validate availability & prices right before ordering
    loadMunicipalities();
  };
  const onPlaced = (order, who) => {
    cart.clear(); // only now, after the order really exists
    myOrders.save(order, who);
  };
  const openTrack = () => setTrackOpen({ phone: myOrders.customer.phone, autoSearch: false });

  // Handle direct navigation from push notifications (/Commande?track=BH-...)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const trackRef = params.get("track");
    if (trackRef) {
      setTrackOpen({
        phone: myOrders.customer.phone || "",
        reference: trackRef,
        autoSearch: Boolean(myOrders.customer.phone),
      });
    }
  }, [myOrders.customer.phone]);

  const showBar = cart.hydrated && cart.lines.length > 0;
  const hasOrders = myOrders.hasOrders;
  const barLabel = fmt(itemCount === 1 ? t.bar.itemOne : t.bar.itemOther, { count: itemCount });
  const titleLines = (t?.title || "").split("\n");

  // Espace en bas de page : navigation du bas (mobile) / barre flottante (PC)
  const bottomPad = `pb-28 ${showBar || hasOrders ? "lg:pb-36" : "lg:pb-12"}`;
const reduceMotion = useReducedMotion();
const prevShowBar = useRef(showBar);
const [justActivated, setJustActivated] = useState(false);

useEffect(() => {
  const wasActive = prevShowBar.current;
  prevShowBar.current = showBar;

  if (!showBar) {
    setJustActivated(false);
    return;
  }
  if (!wasActive) {
    setJustActivated(true);
    const id = setTimeout(() => setJustActivated(false), 900);
    return () => clearTimeout(id);
  }
}, [showBar]);

  return (
    <>
      <Progression isVisible={catalog.status === "loading"} />
      <main className={`min-h-screen overflow-x-hidden bg-gray-100 px-6 py-12 ${bottomPad}`}>
      <div className="max-w-7xl mx-auto space-y-10">
        {/* Header */}


        {/* Search */}
        <div className="space-y-4">
          <div className="relative max-w-xl mx-auto">
            <Search className={`absolute ${isRTL ? "right-4" : "left-4"} top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none`} />
            <input
              type="search"
              aria-label={t.searchLabel}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.searchPlaceholder}
              className={`w-full ${isRTL ? "pr-12 pl-4" : "pl-12 pr-4"} py-3 bg-white border border-gray-300 rounded-full text-gray-900 placeholder-gray-400 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20`}
            />
          </div>

        </div>

        {/* Catalog states */}
        {catalog.status === "loading" && (
          <div aria-busy="true" aria-label={t.loading} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="h-80 rounded-3xl bg-white border border-gray-200 animate-pulse" />
            ))}
          </div>
        )}

        {catalog.status === "error" && (
          <div role="alert" className="max-w-md mx-auto text-center space-y-4 rounded-3xl bg-white border border-gray-200 p-8 shadow-xl shadow-gray-300/60">
            <AlertTriangle className="w-8 h-8 mx-auto text-red-600" />
            <p className="text-gray-600">{t.loadError}</p>
            <button onClick={() => loadCatalog()} className={primaryBtn}>
              {t.retry}
            </button>
          </div>
        )}

        {catalogReady && catalog.products.length === 0 && <p className="text-center text-gray-600">{t.emptyCatalog}</p>}
        {catalogReady && catalog.products.length > 0 && visibleProducts.length === 0 && <p className="text-center text-gray-600">{t.noResults}</p>}

        {/* Flat products grid: 1 col mobile, 2 sm, 3 md (tablet), 4 lg (PC) */}
        {catalogReady && visibleProducts.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {visibleProducts.map((p, i) => (
              <motion.article
                key={p.id}
                role="button"
                tabIndex={p.available ? 0 : -1}
                aria-disabled={!p.available}
                aria-label={`${t.select} ${p.name}`}
                onClick={() => openProduct(p)}
                onKeyDown={(e) => {
                  if (e.target !== e.currentTarget) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openProduct(p);
                  }
                }}
                className={`rounded-3xl overflow-hidden shadow-xl shadow-gray-300/60 bg-white border border-gray-200 p-4 flex flex-col outline-none focus-visible:ring-4 focus-visible:ring-orange-500/30 ${
                  p.available ? "cursor-pointer" : "opacity-60 cursor-not-allowed"
                }`}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: (i % 4) * 0.08 }}
                viewport={{ once: true, amount: 0.2 }}
                whileHover={p.available ? { y: -6 } : undefined}
              >
                <div className="relative">
                  <Thumb src={p.image} name={p.name} className="w-full h-78 rounded-2xl" />
                  {!p.available && (
                    <span className="absolute top-3 left-3 px-3 py-1 bg-white border border-gray-300 rounded-full text-xs text-gray-600">{t.unavailable}</span>
                  )}
                </div>
                <div className="flex-1 pt-4 space-y-2">
                  <h3 className="text-xl font-extrabold text-gray-900">{p.name}</h3>
                  {p.description && <p className="text-sm text-gray-600 line-clamp-3">{p.description}</p>}
                </div>
                <div className="flex items-center justify-between pt-4">
                  <span className="text-xl font-extrabold text-orange-600">{formatPrice(p.price, t.currency)}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openProduct(p);
                    }}
                    disabled={!p.available}
                    aria-label={`${t.select} ${p.name}`}
                    className="px-5 py-2 text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-full font-bold text-sm transition shadow-lg shadow-orange-500/30"
                  >
                    {t.select}
                  </button>
                </div>
              </motion.article>
            ))}
          </div>
        )}
      </div>

      {/* Mobile : « Confirmer » et « Suivre » dans le header (grisés s'il n'y a rien à confirmer / suivre) */}
      {headerSlot &&
        createPortal(
          <div className="flex items-center gap-1.5 sm:gap-2">
          <motion.button
  type="button"
  onClick={() => setCartOpen(true)}
  disabled={!showBar}
  aria-label={showBar ? barLabel : "Panier vide"}
  title={
    showBar
      ? `${barLabel} · ${catalogReady ? formatPrice(totals.subtotal, t.currency) : t.bar.unknownTotal}`
      : "Panier vide"
  }
  animate={
    justActivated && !reduceMotion
      ? { scale: [1, 1.16, 0.97, 1] }
      : { scale: 1 }
  }
  transition={{ duration: 0.6, ease: "easeOut" }}
  whileHover={showBar && !reduceMotion ? { y: -2 } : undefined}
  whileTap={showBar ? { scale: 0.95 } : undefined}
  className={`relative flex flex-col items-center justify-center gap-0.5 w-14 sm:w-16 h-11 sm:h-12 rounded-xl border text-[9px] sm:text-[10px] font-bold transition-[background-color,border-color,color,box-shadow] duration-500 ${
    showBar
      ? "bg-orange-500 border-orange-500 text-white shadow-md shadow-orange-500/30"
      : "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed"
  }`}
>
  {/* Shine sweep (clipped inside the button) */}
  <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
    <AnimatePresence>
      {justActivated && !reduceMotion && (
        <motion.span
          className="absolute inset-y-0 left-0 w-2/5 -skew-x-[20deg] bg-gradient-to-r from-transparent via-white/50 to-transparent"
          initial={{ x: "-150%" }}
          animate={{ x: "380%" }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
        />
      )}
    </AnimatePresence>
  </span>

  {/* Expanding ring pulse */}
  <AnimatePresence>
    {justActivated && !reduceMotion && (
      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-xl border-2 border-orange-400"
        initial={{ opacity: 0.7, scale: 1 }}
        animate={{ opacity: 0, scale: 1.7 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />
    )}
  </AnimatePresence>

  {/* Icon wiggle */}
  <motion.span
    className="flex"
    animate={
      justActivated && !reduceMotion
        ? { rotate: [0, -14, 10, -5, 0] }
        : { rotate: 0 }
    }
    transition={{ duration: 0.7, delay: 0.1 }}
  >
    <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5" />
  </motion.span>

  <span>{isRTL ? "تأكيد" : locale === 'en' ? "Confirm" : "Confirmer"}</span>

  {/* Badge: springs in, bumps when the count changes */}
  <AnimatePresence>
    {showBar && (
      <motion.span
        key="badge"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 18 }}
        className="absolute -top-1.5 -right-1.5 min-w-4 sm:min-w-5 h-4 sm:h-5 px-1 rounded-full bg-black text-white text-[9px] sm:text-[10px] leading-none flex items-center justify-center"
      >
        <motion.span
          key={itemCount}
          initial={reduceMotion ? false : { scale: 1.5 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 15 }}
        >
          {itemCount}
        </motion.span>
      </motion.span>
    )}
  </AnimatePresence>
</motion.button>

            <button
              type="button"
              onClick={openTrack}
              disabled={!hasOrders}
              aria-label={hasOrders ? t.track.floating : "Aucune commande à suivre"}
              title={hasOrders ? t.track.floating : "Aucune commande à suivre"}
              className={`flex flex-col items-center justify-center gap-0.5 w-14 sm:w-16 h-11 sm:h-12 rounded-xl border text-[9px] sm:text-[10px] font-bold transition active:scale-95 ${
                hasOrders
                  ? "bg-white border-gray-300 text-gray-900 hover:border-orange-400 hover:text-orange-600"
                  : "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed"
              }`}
            >
              <ClipboardList className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>{isRTL ? "تتبع" : locale === 'en' ? "Track" : "Suivre"}</span>
            </button>
          </div>,
          headerSlot
        )}

      {/* PC : bouton flottant « Suivre commande » (persiste après la première commande) */}
      <AnimatePresence>
        {hasOrders && (
          <motion.button
            key="track-fab"
            onClick={openTrack}
            className={`hidden lg:flex fixed right-4 z-40 items-center gap-2 px-5 py-3 bg-white border border-gray-300 rounded-full font-bold text-gray-900 shadow-xl hover:border-orange-400 hover:text-orange-600 ${showBar ? "lg:bottom-24" : "lg:bottom-6"}`}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
          >
            <ClipboardList className="w-5 h-5" /> {t.track.floating}
          </motion.button>
        )}
      </AnimatePresence>

      {/* PC : barre flottante du panier (sur mobile, le bouton « Confirmer » est dans le header) */}
      <AnimatePresence>
        {showBar && (
          <motion.div
            key="order-bar"
            className="hidden lg:block fixed inset-x-4 bottom-4 z-40 mx-auto max-w-xl"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
          >
            <button
              onClick={() => setCartOpen(true)}
              className="w-full flex items-center justify-between gap-4 rounded-full bg-black text-white pl-5 pr-2 py-2 shadow-2xl"
            >
              <span className="flex items-center gap-3" aria-live="polite">
                <ShoppingBag className="w-5 h-5" />
                <span className="font-semibold">{barLabel}</span>
              </span>
              <span className="flex items-center gap-3">
                <span className="font-extrabold">{catalogReady ? formatPrice(totals.subtotal, t.currency) : t.bar.unknownTotal}</span>
                <span className="bg-orange-500 rounded-full px-4 py-2 text-sm font-bold">{t.bar.view}</span>
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overlays: everything happens on this page */}
      <AnimatePresence>
        {cartOpen && (
          <CartDrawer
            key="cart"
            t={t}
            resolved={resolved}
            totals={totals}
            catalogStatus={catalog.status}
            onClose={() => setCartOpen(false)}
            onQuantity={cart.setQuantity}
            onRemove={cart.remove}
            onEdit={(r) => setProductModal({ product: r.product, line: r.line })}
            onConfirm={openCheckout}
            onRetry={() => loadCatalog()}
          />
        )}
        {productModal && (
          <ProductModal
            key={`product-${productModal.product.id}-${productModal.line?.key ?? "new"}`}
            product={productModal.product}
            mode={productModal.line ? "edit" : "add"}
            initialSelection={productModal.line?.selection}
            initialQuantity={productModal.line?.quantity ?? 1}
            level={cartOpen ? 1 : 0}
            t={t}
            onClose={() => setProductModal(null)}
            onSubmit={(selection, quantity) => {
              if (productModal.line) cart.replace(productModal.line.key, productModal.product.id, selection, quantity);
              else cart.add(productModal.product.id, selection, quantity);
              setProductModal(null);
            }}
          />
        )}
        {checkoutOpen && (
          <CheckoutModal
            key="checkout"
            t={t}
            resolved={resolved}
            totals={totals}
            municipalities={municipalities.list}
            municipalitiesLoading={municipalities.status === "loading"}
            initialCustomer={myOrders.customer}
            canTrackAfter
            onClose={() => setCheckoutOpen(false)}
            onBackToCart={() => {
              setCheckoutOpen(false);
              setCartOpen(true);
            }}
            onSubmitOrder={createOrder}
            onCatalogStale={() => loadCatalog({ silent: true })}
            onPlaced={onPlaced}
            onTrack={(order, phone) => {
              setCheckoutOpen(false);
              setTrackOpen({ phone, autoSearch: true });
            }}
          />
        )}
        {trackOpen && (
          <TrackModal
            key="track"
            t={t}
            initialPhone={trackOpen.phone}
            initialReference={trackOpen.reference}
            autoSearch={trackOpen.autoSearch}
            onClose={() => setTrackOpen(null)}
          />
        )}
      </AnimatePresence>
    </main>
    </>
  );
}