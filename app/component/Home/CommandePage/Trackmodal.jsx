"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Clock, Loader2, RefreshCw, Radio, PackageSearch } from "lucide-react";
import Overlay from "./Overlay";
import { inputClass, primaryBtn } from "./UI";
import { trackOrders } from "./api";
import { formatDate, fmt, isValidPhone, normalizePhone } from "./Logic";
import { useRealtimeOrder } from "@/lib/Firebase";
import CustomerNotificationButton from "./CustomerNotificationButton";

/** Helper to identify non-active orders (Terminée and Annulée) */
export const isInactiveOrder = (status) => {
  if (!status) return false;
  const s = String(status).trim().toUpperCase();
  return (
    s === "COMPLETED" ||
    s === "CANCELLED" ||
    s.includes("TERMIN") ||
    s.includes("ANNUL")
  );
};

/** Horizontal steps (oldest first), auto-scrolled to the current step */
function HorizontalSteps({ steps, title }) {
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
          return (
            <li key={i} className="relative flex-1 min-w-[110px] snap-center text-center px-1">
              {i > 0 && (
                <span
                  aria-hidden="true"
                  className={`absolute top-3 right-1/2 w-full h-0.5 ${isCurrent ? "bg-orange-300" : "bg-emerald-400"}`}
                />
              )}
              <span
                className={`relative z-10 mx-auto flex w-6 h-6 items-center justify-center rounded-full text-white ${
                  isCurrent ? "bg-orange-500 ring-4 ring-orange-100" : "bg-emerald-500"
                }`}
              >
                {isCurrent ? <span className="w-2 h-2 rounded-full bg-white" /> : <Check className="w-3.5 h-3.5" strokeWidth={3} />}
              </span>
              <p className={`mt-2 text-xs leading-tight ${isCurrent ? "font-extrabold text-gray-900" : "font-semibold text-gray-700"}`}>
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

/** Tracking by phone number: shows customer name, reference, order status with time and history. */
function TrackedOrder({ order, t }) {
  const k = t.track;
  const { liveOrder, connected } = useRealtimeOrder(order.reference);
  const status = liveOrder?.statusLabel ?? liveOrder?.status ?? order.statusLabel ?? order.status;
  const rawStatus = liveOrder?.status ?? order.status;

  // Immediately hide if status transitions to completed or cancelled
  if (isInactiveOrder(rawStatus) || isInactiveOrder(status)) {
    return null;
  }

  const when = formatDate(liveOrder?.updatedAt ?? order.updatedAt);

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
      {/* Top: customer + reference */}
      <div className="flex items-start justify-between gap-3 px-4 pt-4">
        <div className="min-w-0">
          <p className="font-extrabold text-gray-900 truncate">{order.customerName}</p>
          {order.reference && (
            <span className="inline-block mt-1 font-mono text-xs px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 font-semibold">
              {order.reference}
            </span>
          )}
        </div>
        {connected && (
          <span className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] text-emerald-700 font-bold">
            <Radio className="w-3 h-3 animate-pulse" />
            En direct
          </span>
        )}
      </div>

      {/* Current status hero */}
      {status && (
        <div className="mx-4 mt-4 rounded-2xl border border-orange-200 bg-orange-50 p-4 flex items-center gap-3">
          <span className="relative flex w-11 h-11 shrink-0 items-center justify-center rounded-full bg-orange-500 text-white shadow-lg shadow-orange-500/30">
            <span className="absolute inset-0 rounded-full bg-orange-400/40 animate-ping" />
            <Clock className="relative w-5 h-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-orange-600">Statut actuel</p>
            <p className="text-lg font-extrabold text-gray-900 leading-tight break-words">{status}</p>
            {when && <p className="text-xs text-gray-600 mt-0.5">{when}</p>}
          </div>
        </div>
      )}

      {/* History: horizontal steps */}
      {history.length > 0 && <HorizontalSteps steps={history} title={k.history} />}

      {/* Notifications */}
      <div className="px-4 py-4">
        <CustomerNotificationButton
          orderReference={order.reference}
          customerPhone={order.customerPhone}
        />
      </div>
    </li>
  );
}

export default function TrackModal({ t, initialPhone = "", autoSearch = false, onClose }) {
  const k = t.track;
  const [phone, setPhone] = useState(initialPhone);
  const [orders, setOrders] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);
  const busy = useRef(false);

  const run = useCallback(
    async (value) => {
      if (busy.current) return;
      if (!isValidPhone(value)) return setError(k.errors.phone);
      busy.current = true;
      setLoading(true);
      setError("");
      try {
        setOrders(await trackOrders({ phone: normalizePhone(value) }));
        setUpdatedAt(new Date());
      } catch (err) {
        setError(err?.code === "NETWORK" ? k.errors.network : err?.status === 429 ? k.errors.tooMany : k.errors.generic);
      } finally {
        busy.current = false;
        setLoading(false);
      }
    },
    [k]
  );

  useEffect(() => {
    if (autoSearch && initialPhone) run(initialPhone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Real-time background sync fallback: re-checks order statuses every 3.5s while open
  useEffect(() => {
    if (!orders || orders.length === 0 || !phone || !isValidPhone(phone)) return;
    const interval = setInterval(async () => {
      try {
        const fresh = await trackOrders({ phone: normalizePhone(phone) });
        if (fresh && Array.isArray(fresh)) {
          setOrders(fresh);
          setUpdatedAt(new Date());
        }
      } catch {}
    }, 3500);
    return () => clearInterval(interval);
  }, [orders, phone]);

  // Auto-link FCM token to tracked active orders if notification permission is granted
  useEffect(() => {
    if (!orders || orders.length === 0 || !phone) return;
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
                customerPhone: normalizePhone(phone),
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
          onSubmit={(e) => {
            e.preventDefault();
            run(phone);
          }}
          noValidate
          className="space-y-3"
        >
          <p className="text-sm text-gray-600">{k.intro}</p>
          <label htmlFor="tr-phone" className="text-sm font-semibold text-gray-900">
            {k.phone}
          </label>
          <input id="tr-phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t.checkout.phonePlaceholder} maxLength={20} className={inputClass} />
          <button type="submit" disabled={loading} className={`w-full flex items-center justify-center gap-2 ${primaryBtn}`}>
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
          const activeOrders = (orders || []).filter(
            (o) => !isInactiveOrder(o.status) && !isInactiveOrder(o.statusLabel)
          );

          if (orders && activeOrders.length === 0 && !loading) {
            return (
              <div className="rounded-3xl border border-dashed border-gray-300 bg-gray-50/60 p-8 text-center space-y-2">
                <PackageSearch className="w-8 h-8 mx-auto text-gray-400" />
                <p className="text-sm font-bold text-gray-800">Aucune commande en cours</p>
                <p className="text-xs text-gray-500">
                  Les commandes terminées ou annulées ne figurent plus dans le suivi actif.
                </p>
              </div>
            );
          }

          if (orders && activeOrders.length > 0) {
            return (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                    {activeOrders.length === 1
                      ? "1 commande en cours"
                      : `${activeOrders.length} commandes en cours`}
                  </p>
                  {updatedAt && (
                    <button
                      type="button"
                      onClick={() => run(phone)}
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
                  {activeOrders.map((o, i) => (
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