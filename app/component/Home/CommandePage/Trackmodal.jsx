"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  Clock,
  Loader2,
  RefreshCw,
  PackageSearch,
  XCircle,
  X,
  Receipt,
  MapPin,
  Truck,
  Store,
  Ban,
  ChevronDown,
  Search,
} from "lucide-react";
import Overlay from "./Overlay";
import { inputClass, primaryBtn } from "./UI";
import { trackOrders, cancelCustomerOrder } from "./api";
import { formatDate, isValidPhone, normalizePhone, formatPrice } from "./Logic";
import { useRealtimeOrder } from "@/lib/Firebase";
import CustomerNotificationButton from "./CustomerNotificationButton";
import { useI18n } from "@/lib/i18n/I18nContext";

export const isInactiveOrder = (status) => {
  if (!status) return false;
  const s = String(status).trim().toUpperCase();
  return s === "COMPLETED" || s.includes("TERMIN");
};

export const isCancelledOrder = (status) => {
  if (!status) return false;
  const s = String(status).trim().toUpperCase();
  return s === "CANCELLED" || s.includes("ANNUL");
};

/**
 * Normalizes any raw status string or legacy French label to standard OrderStatus enum key
 */
export function normalizeStatusKey(rawStatusOrLabel) {
  if (!rawStatusOrLabel) return "";
  const s = String(rawStatusOrLabel).trim().toUpperCase();
  if (
    [
      "PENDING",
      "CONFIRMED",
      "PREPARING",
      "READY",
      "OUT_FOR_DELIVERY",
      "COMPLETED",
      "CANCELLED",
    ].includes(s)
  ) {
    return s;
  }
  if (s.includes("CONFIRMATION")) return "PENDING";
  if (s.includes("PRÉPARATION") || s.includes("PREPARATION")) {
    return s.includes("ATTENTE") ? "CONFIRMED" : "PREPARING";
  }
  if (s.includes("LIVRAISON")) {
    return s.includes("ATTENTE") ? "READY_DELIVERY" : "OUT_FOR_DELIVERY";
  }
  if (
    s.includes("RETRAIT") ||
    s.includes("PRÊTE") ||
    s.includes("PRETE") ||
    s.includes("READY")
  ) {
    return "READY_PICKUP";
  }
  if (s.includes("TERMIN") || s.includes("COMPLET")) return "COMPLETED";
  if (s.includes("ANNUL") || s.includes("CANCEL")) return "CANCELLED";
  return s;
}

/**
 * Returns localized order status label strictly following active i18n content (Arabic, French, English)
 */
export function getLocalizedOrderStatus(statusKey, fulfillment, content) {
  if (!statusKey) return "";
  const key = normalizeStatusKey(statusKey);
  const dict = content?.OrderStatus || {};
  const isDelivery =
    String(fulfillment ?? "").toUpperCase() === "DELIVERY" ||
    String(fulfillment ?? "").toLowerCase() === "delivery";

  if (key === "READY" || key === "READY_DELIVERY" || key === "READY_PICKUP") {
    if (isDelivery && dict.READY_DELIVERY) return dict.READY_DELIVERY;
    if (!isDelivery && dict.READY_PICKUP) return dict.READY_PICKUP;
    if (dict.READY) return dict.READY;
  }

  if (dict[key]) {
    return dict[key];
  }

  return statusKey;
}

/** Horizontal steps (oldest first), auto-scrolled to the current step. RTL-safe. */
function HorizontalSteps({ steps, isCancelled = false, title, fulfillment, content }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const isRtl = getComputedStyle(el).direction === "rtl";
    el.scrollTo({
      left: isRtl ? -el.scrollWidth : el.scrollWidth,
      behavior: "smooth",
    });
  }, [steps.length]);

  return (
    <div className="px-4 pt-4">
      <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-3">{title}</p>
      <ol
        ref={ref}
        className="flex overflow-x-auto overflow-y-hidden overscroll-x-contain pb-3 snap-x snap-mandatory [scrollbar-width:thin] [scrollbar-color:#fdba74_transparent]"
      >
        {steps.map((h, i) => {
          const isCurrent = i === steps.length - 1;
          const isStepCancelled = isCancelled && isCurrent;

          return (
            <li key={i} className="relative flex-1 min-w-[110px] snap-center text-center px-1">
              {i > 0 && (
                <span
                  aria-hidden="true"
                  className={`absolute top-3 end-1/2 w-full h-0.5 ${
                    isStepCancelled ? "bg-red-300" : isCurrent ? "bg-orange-300" : "bg-emerald-400"
                  }`}
                />
              )}
              <span
                className={`relative z-10 mx-auto flex w-6 h-6 items-center justify-center rounded-full text-white ${
                  isStepCancelled
                    ? "bg-red-500 ring-4 ring-red-100"
                    : isCurrent
                    ? "bg-orange-500 ring-4 ring-orange-100"
                    : "bg-emerald-500"
                }`}
              >
                {isStepCancelled ? (
                  <X className="w-3.5 h-3.5" strokeWidth={3} />
                ) : isCurrent ? (
                  <span className="w-2 h-2 rounded-full bg-white" />
                ) : (
                  <Check className="w-3.5 h-3.5" strokeWidth={3} />
                )}
              </span>
              <p
                className={`mt-2 text-xs leading-tight ${
                  isStepCancelled
                    ? "font-extrabold text-red-600"
                    : isCurrent
                    ? "font-extrabold text-gray-900"
                    : "font-semibold text-gray-700"
                }`}
              >
                {getLocalizedOrderStatus(h.status || h.label, fulfillment, content) || h.label}
              </p>
              {formatDate(h.at) && <p className="mt-0.5 text-[10px] text-gray-500">{formatDate(h.at)}</p>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function TrackedOrder({ order, t }) {
  const { content, locale } = useI18n();
  const k = t.track;
  const ar = locale === "ar";
  const { liveOrder } = useRealtimeOrder(order.reference);

  // ⚠️ All hooks BEFORE any early return (rules of hooks)
  const [cancelling, setCancelling] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const cancelInFlight = useRef(false);

  const status = liveOrder?.statusLabel ?? liveOrder?.status ?? order.statusLabel ?? order.status;
  const rawStatus = liveOrder?.status ?? order.status;
  const isCancelled = isCancelledOrder(rawStatus) || isCancelledOrder(status);

  if (isInactiveOrder(rawStatus) || isInactiveOrder(status)) return null;

  const when = formatDate(liveOrder?.updatedAt ?? order.updatedAt ?? order.createdAt);
  const normalizedStatus = String(rawStatus ?? "").toUpperCase();
  const isCancellable = ["PENDING", "CONFIRMED"].includes(normalizedStatus);
  const localizedStatus = getLocalizedOrderStatus(rawStatus || status, order.fulfillment, content);
  const disabledMsg =
    k.cancelDisabled ||
    (ar
      ? "بدأ تحضير طلبك بالفعل ولا يمكن إلغاؤه الآن."
      : "La préparation de la commande a déjà commencé. Annulation impossible.");

  const handleCancel = async () => {
    if (cancelInFlight.current || cancelling || !isCancellable) return;
    cancelInFlight.current = true;
    setCancelling(true);
    setCancelError("");
    try {
      await cancelCustomerOrder({ reference: order.reference, phone: order.customerPhone });
      setConfirmingCancel(false);
    } catch (err) {
      setCancelError(
        err?.code === "ORDER_NOT_CANCELLABLE" || err?.status === 422
          ? disabledMsg
          : err?.message || k.errors.generic
      );
    } finally {
      cancelInFlight.current = false;
      setCancelling(false);
    }
  };

  const onCancelClick = () => {
    if (!isCancellable) {
      setShowHint((v) => !v);
      return;
    }
    setCancelError("");
    setConfirmingCancel((v) => !v);
  };

  let history = (order.statusHistory || []).filter((h) => h.label);
  if (
    liveOrder &&
    liveOrder.status &&
    (!history.length || history[history.length - 1].status !== liveOrder.status)
  ) {
    history = [
      ...history,
      {
        status: liveOrder.status,
        label: liveOrder.statusLabel || liveOrder.status,
        at: liveOrder.updatedAt || new Date().toISOString(),
      },
    ];
  }

  const itemsCount = (order.items || []).reduce((n, it) => n + (Number(it.quantity) || 1), 0);

  return (
    <li className="rounded-3xl border border-gray-200 bg-white overflow-hidden shadow-sm transition hover:shadow-md">
      {/* Accent bar */}
      <div
        className={`h-1 w-full ${
          isCancelled ? "bg-red-500" : "bg-gradient-to-r from-orange-400 via-orange-500 to-amber-400"
        }`}
      />

    {/* Header: customer · cancelled badge */}
<div className="flex items-start justify-between gap-3 px-4 pt-4">
  <div className="min-w-0 flex-1">
    <p className="font-extrabold text-gray-900 truncate leading-tight">{order.customerName}</p>
    <div className="flex flex-wrap items-center gap-1.5 mt-1">
      {order.reference && (
        <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 font-semibold">
          {order.reference}
        </span>
      )}
      {order.dailyNumber && (
        <span className="text-[11px] px-2 py-0.5 rounded-md bg-orange-100 text-orange-800 font-bold">
          #{order.dailyNumber}
        </span>
      )}
    </div>
  </div>
{/* Actions: right in LTR, left in RTL */}
{!isCancelled && (
  <div className="flex flex-wrap items-center justify-center  ">
    <CustomerNotificationButton
      orderReference={order.reference}
      customerPhone={order.customerPhone}
      alwaysActive={true}
    />

    <button
      type="button"
      onClick={onCancelClick}
      disabled={cancelling}
      aria-disabled={!isCancellable}
      title={isCancellable ? undefined : disabledMsg}
      className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-bold whitespace-nowrap transition active:scale-95 ${
        !isCancellable
          ? "border-gray-200 bg-gray-100 text-gray-400 opacity-70"
          : confirmingCancel
          ? "border-red-400 bg-red-50 text-red-700"
          : "border-red-200 bg-white text-red-600 hover:bg-red-50 hover:border-red-400"
      }`}
    >
      {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
      <span>{k.cancelOrder || (ar ? "إلغاء الطلب" : "Annuler")}</span>
    </button>
  </div>
)}
  {isCancelled && (
    <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-100 border border-red-200 text-[10px] text-red-700 font-bold">
      <XCircle className="w-3 h-3" />
      {content?.OrderStatus?.CANCELLED || (ar ? "ملغاة" : "Annulée")}
    </span>
  )}
</div>


      {/* Inline feedback under header */}
      {!isCancelled && showHint && !isCancellable && (
        <p
          role="status"
          className="mx-4 mt-3 text-xs font-semibold text-gray-600 bg-gray-50 border border-gray-200 rounded-xl p-2.5"
        >
          {disabledMsg}
        </p>
      )}

      {cancelError && (
        <p role="alert" className="mx-4 mt-3 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-xl p-2.5">
          {cancelError}
        </p>
      )}

      {!isCancelled && confirmingCancel && (
        <div className="mx-4 mt-3 rounded-2xl border border-red-200 bg-red-50/70 p-3.5 space-y-2.5 animate-in fade-in slide-in-from-top-1 duration-200">
          <p className="text-xs font-bold text-red-900">
            {k.cancelConfirm ||
              (ar ? "هل أنت متأكد من رغبتك في إلغاء طلبك؟" : "Êtes-vous sûr de vouloir annuler votre commande ?")}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={cancelling}
              onClick={handleCancel}
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold shadow-sm transition disabled:opacity-50"
            >
              {cancelling && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {cancelling
                ? k.cancelling || (ar ? "جاري الإلغاء..." : "Annulation en cours...")
                : ar
                ? "نعم، إلغاء الطلب"
                : "Oui, annuler"}
            </button>
            <button
              type="button"
              disabled={cancelling}
              onClick={() => {
                setConfirmingCancel(false);
                setCancelError("");
              }}
              className="py-2 px-3 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-xs font-bold transition disabled:opacity-50"
            >
              {ar ? "تراجع" : "Retour"}
            </button>
          </div>
        </div>
      )}

      {/* Status hero */}
      {isCancelled ? (
        <div className="mx-4 mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 flex items-center gap-3">
          <span className="flex w-11 h-11 shrink-0 items-center justify-center rounded-full bg-red-500 text-white shadow-lg shadow-red-500/20">
            <XCircle className="w-6 h-6" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-red-600">
              {ar ? "حالة الطلب" : "Statut de la commande"}
            </p>
            <p className="text-lg font-black text-red-900 leading-tight break-words">
              {localizedStatus || (ar ? "تم إلغاء الطلب" : "Commande annulée")}
            </p>
            {when && <p className="text-xs text-red-600/80 mt-0.5">{when}</p>}
          </div>
        </div>
      ) : localizedStatus ? (
        <div className="mx-4 mt-4 rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 p-4 flex items-center gap-3">
          <span className="relative flex w-11 h-11 shrink-0 items-center justify-center rounded-full bg-orange-500 text-white shadow-lg shadow-orange-500/30">
            <span className="absolute inset-0 rounded-full bg-orange-400/40 animate-ping" />
            <Clock className="relative w-5 h-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-orange-600">
              {k.currentStatus || (ar ? "الحالة الحالية" : "Statut actuel")}
            </p>
            <p className="text-lg font-extrabold text-gray-900 leading-tight break-words">{localizedStatus}</p>
            {when && <p className="text-xs text-gray-600 mt-0.5">{when}</p>}
          </div>
        </div>
      ) : null}

      {/* History */}
      {history.length > 0 && (
        <HorizontalSteps
          steps={history}
          isCancelled={isCancelled}
          title={k.history}
          fulfillment={order.fulfillment}
          content={content}
        />
      )}

      {/* Order details (collapsible) */}
      {order.items && order.items.length > 0 && (
        <div className="mx-4 my-4 rounded-2xl border border-gray-200 bg-gray-50/80 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            aria-expanded={showDetails}
            className="w-full flex items-center justify-between gap-3 p-3.5 text-start hover:bg-gray-100/70 transition"
          >
            <span className="flex items-center gap-2 min-w-0">
              <Receipt className="w-4 h-4 text-orange-600 shrink-0" />
              <span className="text-xs font-extrabold uppercase tracking-wider text-gray-700 truncate">
                {ar ? "تفاصيل الطلب" : "Détails de la commande"}
              </span>
              <span className="text-[11px] font-bold text-gray-500">
                · {itemsCount} {ar ? "عنصر" : itemsCount > 1 ? "articles" : "article"}
              </span>
            </span>
            <span className="flex items-center gap-2 shrink-0">
              {order.total != null && (
                <span className="text-sm font-black text-orange-600">{formatPrice(order.total, t.currency)}</span>
              )}
              <ChevronDown
                className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${showDetails ? "rotate-180" : ""}`}
              />
            </span>
          </button>

          {showDetails && (
            <div className="px-4 pb-4 space-y-3 border-t border-gray-200/80 animate-in fade-in duration-200">
              {order.fulfillment && (
                <div className="pt-3">
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-white border border-gray-200 text-gray-700">
                    {order.fulfillment === "delivery" ? (
                      <>
                        <Truck className="w-3 h-3 text-orange-500" />
                        {ar ? "توصيل" : "Livraison"}
                      </>
                    ) : (
                      <>
                        <Store className="w-3 h-3 text-orange-500" />
                        {ar ? "استلام" : "À emporter"}
                      </>
                    )}
                  </span>
                </div>
              )}

              <ul className="space-y-2 pt-1">
                {order.items.map((it, idx) => (
                  <li key={idx} className="flex items-start justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900">
                        <span className="text-orange-600 font-extrabold me-1">{it.quantity}×</span>
                        {it.name}
                      </p>
                      {it.options && it.options.length > 0 && (
                        <p className="text-[11px] text-gray-500 mt-0.5">{it.options.join(", ")}</p>
                      )}
                    </div>
                    {it.total != null && (
                      <span className="font-semibold text-gray-900 shrink-0">{formatPrice(it.total, t.currency)}</span>
                    )}
                  </li>
                ))}
              </ul>

              {order.delivery && (order.delivery.municipality || order.delivery.address) && (
                <div className="pt-2 border-t border-gray-200/60 text-xs text-gray-600 flex items-start gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                  <span>{[order.delivery.municipality, order.delivery.address].filter(Boolean).join(" - ")}</span>
                </div>
              )}

              {order.total != null && (
                <div className="pt-2 border-t border-gray-200/80 space-y-1 text-xs">
                  {order.subtotal != null && order.deliveryFee != null && order.deliveryFee > 0 && (
                    <>
                      <div className="flex justify-between text-gray-500 text-[11px]">
                        <span>{ar ? "المجموع الفرعي" : "Sous-total"}</span>
                        <span>{formatPrice(order.subtotal, t.currency)}</span>
                      </div>
                      <div className="flex justify-between text-gray-500 text-[11px]">
                        <span>{ar ? "التوصيل" : "Livraison"}</span>
                        <span>{formatPrice(order.deliveryFee, t.currency)}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between font-extrabold text-sm text-gray-900 pt-1">
                    <span>{ar ? "المجموع" : "Total"}</span>
                    <span className="text-orange-600 font-black">{formatPrice(order.total, t.currency)}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function OrderSkeleton() {
  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-4 space-y-3 animate-pulse">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-full bg-gray-200" />
        <div className="w-9 h-9 rounded-full bg-gray-200" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-1/2 rounded bg-gray-200" />
          <div className="h-3 w-1/3 rounded bg-gray-100" />
        </div>
      </div>
      <div className="h-16 rounded-2xl bg-orange-50" />
      <div className="h-10 rounded-2xl bg-gray-100" />
    </div>
  );
}

export default function TrackModal({
  t,
  initialPhone = "",
  initialReference = "",
  autoSearch = false,
  onClose,
}) {
  const { locale } = useI18n();
  const k = t.track;
  const ar = locale === "ar";
  const [phone, setPhone] = useState(initialPhone);
  const [orders, setOrders] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);
  const busy = useRef(false);
  const resultsRef = useRef(null);

  const run = useCallback(
    async (value, ref = "") => {
      if (busy.current) return;
      const cleanPhone = value ? normalizePhone(value) : "";
      const cleanRef = ref ? ref.trim() : "";

      if (!cleanPhone && !cleanRef) return setError(k.errors.phone);
      if (cleanPhone && !isValidPhone(cleanPhone)) return setError(k.errors.phone);

      busy.current = true;
      setLoading(true);
      setError("");

      try {
        const res = await trackOrders({
          phone: cleanPhone || undefined,
          reference: cleanRef || undefined,
        });
        setOrders(res);
        setUpdatedAt(new Date());
      } catch (err) {
        setError(
          err?.code === "NETWORK"
            ? k.errors.network
            : err?.status === 429
            ? k.errors.tooMany
            : k.errors.generic
        );
      } finally {
        busy.current = false;
        setLoading(false);
      }
    },
    [k]
  );

  useEffect(() => {
    if (autoSearch && (initialPhone || initialReference)) {
      run(initialPhone, initialReference);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll down to the results once they load
  useEffect(() => {
    if (!orders) return;
    const id = requestAnimationFrame(() => {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(id);
  }, [orders]);

  // Auto-link FCM token to tracked orders if permission granted
  useEffect(() => {
    if (!orders || orders.length === 0) return;
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      const savedToken = localStorage.getItem("bh_fcm_token");
      if (savedToken) {
        orders.forEach((o) => {
          if (o.reference) {
            fetch("/api/notifications/subscribe", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                token: savedToken,
                role: "CLIENT",
                orderReference: o.reference,
                customerPhone: phone ? normalizePhone(phone) : o.customerPhone || null,
              }),
            }).catch(() => {});
          }
        });
      }
    }
  }, [orders, phone]);

  const displayOrders = (orders || []).filter(
    (o) => !isInactiveOrder(o.status) && !isInactiveOrder(o.statusLabel)
  );

  return (
    <Overlay title={k.title} closeLabel={k.close} onClose={onClose}>
      <div className="space-y-5">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
              try {
                await Notification.requestPermission();
              } catch (_) {}
            }
            run(phone);
          }}
          noValidate
          className="space-y-3"
        >
          <p className="text-sm text-gray-600">{k.intro}</p>
          <label htmlFor="tr-phone" className="text-sm font-semibold text-gray-900">
            {k.phone}
          </label>
          <div className="relative">
            <input
              id="tr-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                if (error) setError("");
              }}
              placeholder={t.checkout.phonePlaceholder}
              maxLength={20}
              aria-invalid={!!error}
              className={`${inputClass} pe-10 ${error ? "!border-red-400" : ""}`}
            />
            {phone && (
              <button
                type="button"
                onClick={() => setPhone("")}
                aria-label="Clear"
                className="absolute end-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={loading}
            className={`w-full flex items-center justify-center gap-2 ${primaryBtn}`}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {loading ? k.searching : k.search}
          </button>
        </form>

        {error && (
          <p role="alert" className="text-sm font-semibold text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">
            {error}
          </p>
        )}

        {/* Results anchor: modal scrolls here when data arrives */}
        <div ref={resultsRef} className="scroll-mt-3 space-y-3">
          {loading && !orders && <OrderSkeleton />}

          {orders && displayOrders.length === 0 && !loading && (
            <div className="rounded-3xl border border-dashed border-gray-300 bg-gray-50/60 p-8 text-center space-y-2">
              <PackageSearch className="w-8 h-8 mx-auto text-gray-400" />
              <p className="text-sm font-bold text-gray-800">
                {k.noActiveOrders || (ar ? "لا توجد طلبات حديثة" : "Aucune commande récente")}
              </p>
              <p className="text-xs text-gray-500">
                {ar
                  ? "يمكنك فقط تتبع الطلبات التي تم إنشاؤها خلال الـ 6 ساعات الماضية."
                  : "Seules les commandes créées au cours des 6 dernières heures sont affichées dans le suivi."}
              </p>
            </div>
          )}

          {orders && displayOrders.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                  {displayOrders.length === 1
                    ? ar
                      ? "طلب واحد (آخر 6 ساعات)"
                      : "1 commande récente (dernières 6h)"
                    : ar
                    ? `${displayOrders.length} طلبات (آخر 6 ساعات)`
                    : `${displayOrders.length} commandes récentes (dernières 6h)`}
                </p>
                {updatedAt && (
                  <button
                    type="button"
                    onClick={() => run(phone, initialReference)}
                    disabled={loading}
                    className="text-xs text-orange-600 hover:text-orange-700 font-semibold flex items-center gap-1 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
                    {k.refresh}
                  </button>
                )}
              </div>

              <ul className="space-y-4">
                {displayOrders.map((o, i) => (
                  <TrackedOrder key={o.reference || i} order={o} t={t} />
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </Overlay>
  );
}