"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  Clock,
  Loader2,
  RefreshCw,
  Radio,
  PackageSearch,
  XCircle,
  X,
  Receipt,
  MapPin,
  Truck,
  Store,
} from "lucide-react";
import Overlay from "./Overlay";
import { inputClass, primaryBtn } from "./UI";
import { trackOrders } from "./api";
import { formatDate, fmt, isValidPhone, normalizePhone, formatPrice } from "./Logic";
import { useRealtimeOrder } from "@/lib/Firebase";
import CustomerNotificationButton from "./CustomerNotificationButton";

/** Helper to identify completed orders that should not clutter active tracking */
export const isInactiveOrder = (status) => {
  if (!status) return false;
  const s = String(status).trim().toUpperCase();
  return s === "COMPLETED" || s.includes("TERMIN");
};

/** Helper to identify cancelled orders (which are now visible in tracking) */
export const isCancelledOrder = (status) => {
  if (!status) return false;
  const s = String(status).trim().toUpperCase();
  return s === "CANCELLED" || s.includes("ANNUL");
};

/** Horizontal steps (oldest first), auto-scrolled to the current step */
function HorizontalSteps({ steps, isCancelled = false, title }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTo({ left: el.scrollWidth, behavior: "smooth" });
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
                  className={`absolute top-3 right-1/2 w-full h-0.5 ${
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
                {h.label}
              </p>
              {formatDate(h.at) && <p className="mt-0.5 text-[10px] text-gray-500">{formatDate(h.at)}</p>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Tracking by phone number / reference: shows status, cancellation, details, and active push notification */
function TrackedOrder({ order, t }) {
  const k = t.track;
  const { liveOrder, connected } = useRealtimeOrder(order.reference);
  const status = liveOrder?.statusLabel ?? liveOrder?.status ?? order.statusLabel ?? order.status;
  const rawStatus = liveOrder?.status ?? order.status;

  const isCancelled = isCancelledOrder(rawStatus) || isCancelledOrder(status);

  // Completed orders are hidden from active tracking
  if (isInactiveOrder(rawStatus) || isInactiveOrder(status)) {
    return null;
  }

  const when = formatDate(liveOrder?.updatedAt ?? order.updatedAt ?? order.createdAt);

  // If live status has updated and isn't already the last history entry, include it
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

  return (
    <li className="rounded-3xl border border-gray-200 bg-white overflow-hidden shadow-sm transition hover:shadow-md">
      {/* Top: customer + reference + status badge */}
      <div className="flex items-start justify-between gap-3 px-4 pt-4">
        <div className="min-w-0">
          <p className="font-extrabold text-gray-900 truncate">{order.customerName}</p>
          <div className="flex items-center gap-2 mt-1">
            {order.reference && (
              <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 font-semibold">
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

        {isCancelled ? (
          <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-100 border border-red-200 text-[10px] text-red-700 font-bold">
            <XCircle className="w-3 h-3 text-red-600" />
            {t.locale === "ar" ? "ملغاة" : "Annulée"}
          </span>
        ) : connected ? (
          <span className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] text-emerald-700 font-bold">
            <Radio className="w-3 h-3 animate-pulse" />
            {k.live || (t.locale === "ar" ? "مباشر" : "En direct")}
          </span>
        ) : null}
      </div>

      {/* Current status hero */}
      {isCancelled ? (
        <div className="mx-4 mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 flex items-center gap-3">
          <span className="relative flex w-11 h-11 shrink-0 items-center justify-center rounded-full bg-red-500 text-white shadow-lg shadow-red-500/20">
            <XCircle className="w-6 h-6" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-red-600">
              {t.locale === "ar" ? "حالة الطلب" : "Statut de la commande"}
            </p>
            <p className="text-lg font-black text-red-900 leading-tight break-words">
              {status || (t.locale === "ar" ? "تم إلغاء الطلب" : "Commande annulée")}
            </p>
            {when && <p className="text-xs text-red-600/80 mt-0.5">{when}</p>}
          </div>
        </div>
      ) : status ? (
        <div className="mx-4 mt-4 rounded-2xl border border-orange-200 bg-orange-50 p-4 flex items-center gap-3">
          <span className="relative flex w-11 h-11 shrink-0 items-center justify-center rounded-full bg-orange-500 text-white shadow-lg shadow-orange-500/30">
            <span className="absolute inset-0 rounded-full bg-orange-400/40 animate-ping" />
            <Clock className="relative w-5 h-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-orange-600">
              {k.currentStatus || (t.locale === "ar" ? "الحالة الحالية" : "Statut actuel")}
            </p>
            <p className="text-lg font-extrabold text-gray-900 leading-tight break-words">{status}</p>
            {when && <p className="text-xs text-gray-600 mt-0.5">{when}</p>}
          </div>
        </div>
      ) : null}

      {/* History: horizontal steps */}
      {history.length > 0 && (
        <HorizontalSteps steps={history} isCancelled={isCancelled} title={k.history} />
      )}

      {/* Complete Order Details */}
      {order.items && order.items.length > 0 && (
        <div className="mx-4 mt-4 rounded-2xl border border-gray-200 bg-gray-50/80 p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-gray-200/80 pb-2">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-orange-600" />
              <p className="text-xs font-extrabold uppercase tracking-wider text-gray-700">
                {t.locale === "ar" ? "تفاصيل الطلب" : "Détails de la commande"}
              </p>
            </div>
            {order.fulfillment && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-white border border-gray-200 text-gray-700 shadow-2xs">
                {order.fulfillment === "delivery" ? (
                  <>
                    <Truck className="w-3 h-3 text-orange-500" />
                    <span>{t.locale === "ar" ? "توصيل" : "Livraison"}</span>
                  </>
                ) : (
                  <>
                    <Store className="w-3 h-3 text-orange-500" />
                    <span>{t.locale === "ar" ? "استلام" : "À emporter"}</span>
                  </>
                )}
              </span>
            )}
          </div>

          {/* Items list */}
          <ul className="space-y-2">
            {order.items.map((it, idx) => (
              <li key={idx} className="flex items-start justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <p className="font-bold text-gray-900">
                    <span className="text-orange-600 font-extrabold mr-1">{it.quantity}×</span>
                    {it.name}
                  </p>
                  {it.options && it.options.length > 0 && (
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {it.options.join(", ")}
                    </p>
                  )}
                </div>
                {it.total != null && (
                  <span className="font-semibold text-gray-900 shrink-0">
                    {formatPrice(it.total, t.currency)}
                  </span>
                )}
              </li>
            ))}
          </ul>

          {/* Delivery destination if delivery */}
          {order.delivery && (order.delivery.municipality || order.delivery.address) && (
            <div className="pt-2 border-t border-gray-200/60 text-xs text-gray-600 flex items-start gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
              <span className="truncate">
                {[order.delivery.municipality, order.delivery.address].filter(Boolean).join(" - ")}
              </span>
            </div>
          )}

          {/* Price totals */}
          {order.total != null && (
            <div className="pt-2 border-t border-gray-200/80 space-y-1 text-xs">
              {order.subtotal != null && order.deliveryFee != null && order.deliveryFee > 0 && (
                <>
                  <div className="flex justify-between text-gray-500 text-[11px]">
                    <span>{t.locale === "ar" ? "المجموع الفرعي" : "Sous-total"}</span>
                    <span>{formatPrice(order.subtotal, t.currency)}</span>
                  </div>
                  <div className="flex justify-between text-gray-500 text-[11px]">
                    <span>{t.locale === "ar" ? "التوصيل" : "Livraison"}</span>
                    <span>{formatPrice(order.deliveryFee, t.currency)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between font-extrabold text-sm text-gray-900 pt-1">
                <span>{t.locale === "ar" ? "المجموع" : "Total"}</span>
                <span className="text-orange-600 font-black">{formatPrice(order.total, t.currency)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Notifications: always active */}
      <div className="px-4 py-4">
        <CustomerNotificationButton
          orderReference={order.reference}
          customerPhone={order.customerPhone}
          alwaysActive={true}
        />
      </div>
    </li>
  );
}

export default function TrackModal({
  t,
  initialPhone = "",
  initialReference = "",
  autoSearch = false,
  onClose,
}) {
  const k = t.track;
  const [phone, setPhone] = useState(initialPhone);
  const [orders, setOrders] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);
  const busy = useRef(false);

  const run = useCallback(
    async (value, ref = "") => {
      if (busy.current) return;
      const cleanPhone = value ? normalizePhone(value) : "";
      const cleanRef = ref ? ref.trim() : "";

      if (!cleanPhone && !cleanRef) {
        return setError(k.errors.phone);
      }
      if (cleanPhone && !isValidPhone(cleanPhone)) {
        return setError(k.errors.phone);
      }

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

  // Real-time background sync fallback: re-checks order statuses every 3.5s while open
  useEffect(() => {
    if (!orders || orders.length === 0 || (!phone && !initialReference)) return;
    const interval = setInterval(async () => {
      try {
        const fresh = await trackOrders({
          phone: phone ? normalizePhone(phone) : undefined,
          reference: initialReference || undefined,
        });
        if (fresh && Array.isArray(fresh)) {
          setOrders(fresh);
          setUpdatedAt(new Date());
        }
      } catch {}
    }, 3500);
    return () => clearInterval(interval);
  }, [orders, phone, initialReference]);

  // Auto-link FCM token to tracked active & cancelled orders if notification permission is granted
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

  return (
    <Overlay title={k.title} closeLabel={k.close} onClose={onClose}>
      <div className="space-y-5">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            // Automatically prompt for notification permission if default during user gesture
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
          <input
            id="tr-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t.checkout.phonePlaceholder}
            maxLength={20}
            className={inputClass}
          />
          <button
            type="submit"
            disabled={loading}
            className={`w-full flex items-center justify-center gap-2 ${primaryBtn}`}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? k.searching : k.search}
          </button>
        </form>

        {error && (
          <p role="alert" className="text-sm font-semibold text-red-600">
            {error}
          </p>
        )}

        {(() => {
          // Both active and cancelled orders within the last 6 hours are displayed
          const displayOrders = (orders || []).filter(
            (o) => !isInactiveOrder(o.status) && !isInactiveOrder(o.statusLabel)
          );

          if (orders && displayOrders.length === 0 && !loading) {
            return (
              <div className="rounded-3xl border border-dashed border-gray-300 bg-gray-50/60 p-8 text-center space-y-2">
                <PackageSearch className="w-8 h-8 mx-auto text-gray-400" />
                <p className="text-sm font-bold text-gray-800">
                  {k.noActiveOrders || (t.locale === "ar" ? "لا توجد طلبات حديثة" : "Aucune commande récente")}
                </p>
                <p className="text-xs text-gray-500">
                  {t.locale === "ar"
                    ? "يمكنك فقط تتبع الطلبات التي تم إنشاؤها خلال الـ 6 ساعات الماضية."
                    : "Seules les commandes créées au cours des 6 dernières heures sont affichées dans le suivi."}
                </p>
              </div>
            );
          }

          if (orders && displayOrders.length > 0) {
            return (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                    {displayOrders.length === 1
                      ? (t.locale === "ar" ? "طلب واحد (آخر 6 ساعات)" : "1 commande récente (dernières 6h)")
                      : (t.locale === "ar" ? `${displayOrders.length} طلبات (آخر 6 ساعات)` : `${displayOrders.length} commandes récentes (dernières 6h)`)}
                  </p>
                  {updatedAt && (
                    <button
                      type="button"
                      onClick={() => run(phone, initialReference)}
                      disabled={loading}
                      className="text-xs text-orange-600 hover:text-orange-700 font-semibold flex items-center gap-1"
                    >
                      <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
                      {k.refresh}
                    </button>
                  )}
                </div>

                {/* No inner vertical scroll: the modal itself scrolls */}
                <ul className="space-y-4">
                  {displayOrders.map((o, i) => (
                    <TrackedOrder key={o.reference || i} order={o} t={t} />
                  ))}
                </ul>
              </div>
            );
          }

          return null;
        })()}
      </div>
    </Overlay>
  );
}
