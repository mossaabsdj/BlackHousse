"use client";
import { useRef, useState } from "react";
import { AlertTriangle, Check, Loader2, Store, Truck, Ban, XCircle } from "lucide-react";
import Overlay from "./Overlay";
import { inputClass, primaryBtn } from "./UI";
import { buildOrderPayload, formatPrice, fmt, isValidPhone, makeKey, normalizePhone } from "./Logic";
import { cancelCustomerOrder } from "./api";
import { useRealtimeOrder } from "@/lib/Firebase";
import CustomerNotificationButton from "./CustomerNotificationButton";
import { useI18n } from "@/lib/i18n/I18nContext";
import { getLocalizedOrderStatus } from "./Trackmodal";

const FIELD_IDS = { name: "co-name", phone: "co-phone", fulfillment: "co-fulfillment", municipality: "co-municipality", address: "co-address" };

function ItemList({ items, currency }) {
  return (
    <ul className="space-y-2">
      {items.map((it, i) => (
        <li key={i} className="flex justify-between gap-3 text-sm">
          <span className="text-gray-900">
            <span className="font-bold">{it.quantity}×</span> {it.name}
            {it.options.length > 0 && <span className="block text-xs text-gray-600">{it.options.join(", ")}</span>}
          </span>
          <span className="font-semibold text-gray-900 whitespace-nowrap">{formatPrice(it.total, currency)}</span>
        </li>
      ))}
    </ul>
  );
}

function Field({ id, label, error, children }) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-semibold text-gray-900">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs font-semibold text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

export default function CheckoutModal({
  t,
  resolved,
  totals,
  municipalities,
  municipalitiesLoading,
  initialCustomer,
  canTrackAfter,
  onClose,
  onBackToCart,
  onSubmitOrder,
  onCatalogStale,
  onPlaced,
  onTrack,
}) {
  const { content, locale } = useI18n();
  const c = t.checkout;
  const [name, setName] = useState(initialCustomer?.name || "");
  const [phone, setPhone] = useState(initialCustomer?.phone || "");
  const [fulfillment, setFulfillment] = useState("");
  const [municipalityId, setMunicipalityId] = useState("");
  const [municipalityText, setMunicipalityText] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [placed, setPlaced] = useState(null); // { order, snapshot, name }
  const [cancelling, setCancelling] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const cancelInFlight = useRef(false);
  const submittingRef = useRef(false); // hard guard against double submit
  const idem = useRef({ hash: null, key: null }); // same payload => same Idempotency-Key (safe retries)
  const { liveOrder } = useRealtimeOrder(placed?.order?.reference);

  const isDelivery = fulfillment === "delivery";
  const hasList = municipalities.length > 0;
  const selectedMunicipality = municipalities.find((m) => m.id === municipalityId);
  const deliveryFee = isDelivery && selectedMunicipality?.deliveryFee != null ? selectedMunicipality.deliveryFee : 0;
  const total = totals.subtotal + deliveryFee;
  const blocked = totals.blocked || resolved.length === 0;

  const summaryItems = resolved.map((r) => ({
    name: r.product?.name ?? "",
    quantity: r.line.quantity,
    options: r.optionNames,
    total: r.total,
  }));

  const validate = () => {
    const e = {};
    if (name.trim().length < 2) e.name = c.errors.name;
    if (!isValidPhone(phone)) e.phone = c.errors.phone;
    if (!fulfillment) e.fulfillment = c.errors.fulfillment;
    if (isDelivery) {
      const hasMunicipality = hasList ? !!municipalityId : municipalityText.trim().length >= 2;
      if (!hasMunicipality) e.municipality = c.errors.municipality;
      if (address.trim().length < 5) e.address = c.errors.address;
    }
    return e;
  };

  const describeError = (err) => {
    if (err?.code === "NETWORK") return c.errors.network;
    if (err?.code === "PRODUCT_UNAVAILABLE") return c.errors.unavailable;
    if (err?.code === "PRICE_CHANGED") return c.errors.priceChanged;
    if (err?.status === 429) return c.errors.tooMany;
    return c.errors.generic;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (submittingRef.current || blocked) return;

    const found = validate();
    setErrors(found);
    const first = Object.keys(FIELD_IDS).find((k) => found[k]);
    if (first) {
      requestAnimationFrame(() => document.getElementById(FIELD_IDS[first])?.focus());
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setServerError("");
    try {
      // Proactively prompt user for notification permission if default, or retrieve token if granted
      let fcmToken = null;
      if (typeof window !== "undefined" && "Notification" in window) {
        try {
          let perm = Notification.permission;
          if (perm === "default") {
            perm = await Notification.requestPermission();
          }
          if (perm === "granted") {
            const { requestPushToken } = await import("@/lib/Firebase");
            fcmToken = await requestPushToken().catch(() => null);
          }
        } catch (permErr) {
          console.warn("[Checkout] Notification prompt error:", permErr);
        }
      }

      const payload = buildOrderPayload({
        resolved,
        customer: { name: name.trim(), phone: normalizePhone(phone) },
        fulfillment,
        delivery: {
          municipalityId: hasList ? municipalityId : null,
          municipality: hasList ? selectedMunicipality?.name : municipalityText.trim(),
          address: address.trim(),
        },
        notes: notes.trim(),
        expectedSubtotal: totals.subtotal,
      });
      if (fcmToken) {
        payload.fcmToken = fcmToken;
      }
      const hash = JSON.stringify(payload);
      if (idem.current.hash !== hash) idem.current = { hash, key: makeKey() };
      const order = await onSubmitOrder({ ...payload, clientRequestId: idem.current.key }, idem.current.key);

      // Ensure token is linked to this reference in background
      if (typeof window !== "undefined") {
        const savedToken = fcmToken || localStorage.getItem("bh_fcm_token");
        if (savedToken && order?.reference) {
          fetch("/api/notifications/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              token: savedToken,
              role: "CLIENT",
              orderReference: order.reference,
              customerPhone: normalizePhone(phone),
            }),
          }).catch(() => {});
        }
      }

      idem.current = { hash: null, key: null };
      setPlaced({
        order,
        name: name.trim(),
        snapshot: { items: summaryItems, subtotal: totals.subtotal, deliveryFee, total },
      });
      onPlaced(order, { name: name.trim(), phone: normalizePhone(phone) });
    } catch (err) {
      // The cart is intentionally kept: it is only cleared after a successful order.
      if (err?.fields) {
        const fe = {};
        for (const k of Object.keys(FIELD_IDS)) if (err.fields[k]) fe[k] = c.errors[k] || c.errors.generic;
        setErrors(fe);
      }
      if (err?.code === "PRODUCT_UNAVAILABLE" || err?.code === "PRICE_CHANGED") onCatalogStale();
      setServerError(describeError(err));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  /* ------------------------------ success ------------------------------ */
  if (placed) {
    const { order, snapshot } = placed;
    const items = order.items.length ? order.items : snapshot.items;
    const rawStatus = liveOrder?.status ?? order.status;
    const orderFulfillment = order.fulfillment ?? fulfillment;
    const statusText =
      getLocalizedOrderStatus(rawStatus, orderFulfillment, content) ||
      (liveOrder?.statusLabel ?? order.statusLabel ?? rawStatus);
    const isCancelled =
      String(rawStatus ?? "").toUpperCase() === "CANCELLED" ||
      String(statusText ?? "").toUpperCase().includes("ANNUL");
    // Order can be cancelled when PENDING (en attente de confirmation) or CONFIRMED (en attente de préparation)
    const isCancellable = ["PENDING", "CONFIRMED"].includes(String(rawStatus ?? "").toUpperCase());
    const s = c.success;
    const trackText = content?.OrderingPage?.track || t?.track || {};

    const handleCancel = async () => {
      if (cancelInFlight.current || cancelling || !isCancellable) return;
      cancelInFlight.current = true;
      setCancelling(true);
      setCancelError("");
      try {
        await cancelCustomerOrder({
          reference: order.reference,
          phone: normalizePhone(phone),
        });
        setConfirmingCancel(false);
      } catch (err) {
        setCancelError(
          err?.code === "ORDER_NOT_CANCELLABLE" || err?.status === 422
            ? (trackText.cancelDisabled || "La commande ne peut plus être annulée car sa préparation a déjà commencé.")
            : (err?.message || trackText.errors?.generic || "Erreur lors de l'annulation.")
        );
      } finally {
        cancelInFlight.current = false;
        setCancelling(false);
      }
    };

    return (
      <Overlay
        title={isCancelled ? (locale === "ar" ? "طلب ملغى" : "Commande annulée") : s.title}
        closeLabel={s.close}
        onClose={onClose}
        footer={
          <div className="flex flex-col sm:flex-row gap-3">
            {canTrackAfter && (
              <button type="button" onClick={() => onTrack(order, normalizePhone(phone))} className={`flex-1 ${primaryBtn}`}>
                {s.track}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-8 py-3 bg-white border border-gray-300 rounded-full font-bold text-gray-600 hover:border-orange-400 hover:text-orange-600 transition"
            >
              {s.close}
            </button>
          </div>
        }
      >
        <div className="space-y-5" role="status">
          <div className="text-center space-y-2">
            <div className={`mx-auto w-14 h-14 rounded-full text-white flex items-center justify-center ${isCancelled ? "bg-red-500 shadow-lg shadow-red-500/20" : "bg-orange-500 shadow-lg shadow-orange-500/20"}`}>
              {isCancelled ? <XCircle className="w-7 h-7" /> : <Check className="w-7 h-7" />}
            </div>
            <p className="text-gray-600 text-sm">
              {isCancelled
                ? (trackText.cancelSuccess || (locale === "ar" ? "تم إلغاء طلبك بنجاح." : "Votre commande a été annulée avec succès."))
                : fmt(s.message, { name: placed.name })}
            </p>
          </div>

          <dl className="rounded-2xl border border-gray-200 bg-gray-50 p-4 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-gray-600">{s.reference}</dt>
              <dd className="font-mono font-bold text-gray-900">{order.reference}</dd>
            </div>
            {statusText && (
              <div className="flex justify-between gap-3">
                <dt className="text-gray-600">{s.status}</dt>
                <dd className={`font-bold ${isCancelled ? "text-red-600 font-black" : "text-orange-600"}`}>{statusText}</dd>
              </div>
            )}
            <div className="flex justify-between gap-3">
              <dt className="text-gray-600">{s.fulfillment}</dt>
              <dd className="font-semibold text-gray-900">{(order.fulfillment ?? fulfillment) === "delivery" ? c.delivery : c.pickup}</dd>
            </div>
          </dl>
<div className="flex flex-row justify-between"> <CustomerNotificationButton
            orderReference={order.reference}
            customerPhone={normalizePhone(phone)}
          />

          {/* Cancellation button: enabled only when order is PENDING (en attente de préparation) */}
          {!isCancelled && (
            <div className="space-y-2 pt-1">
              {cancelError && (
                <p role="alert" className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-xl p-2.5">
                  {cancelError}
                </p>
              )}

              {confirmingCancel ? (
                <div className="rounded-2xl border border-red-200 bg-red-50/70 p-3.5 space-y-2.5 animate-in fade-in duration-200">
                  <p className="text-xs font-bold text-red-900">
                    {trackText.cancelConfirm || (locale === "ar" ? "هل أنت متأكد من رغبتك في إلغاء طلبك؟" : "Êtes-vous sûr de vouloir annuler votre commande ?")}
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
                        ? (trackText.cancelling || (locale === "ar" ? "جاري الإلغاء..." : "Annulation en cours..."))
                        : (locale === "ar" ? "نعم، إلغاء الطلب" : "Oui, annuler la commande")}
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
                      {locale === "ar" ? "تراجع" : "Retour"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <button
                    type="button"
                    disabled={!isCancellable || cancelling}
                    onClick={() => setConfirmingCancel(true)}
                    title={
                      !isCancellable
                        ? (trackText.cancelDisabled || (locale === "ar" ? "بدأ تحضير طلبك بالفعل ولا يمكن إلغاؤه الآن." : "La préparation de la commande a déjà commencé. Annulation impossible."))
                        : undefined
                    }
                    className={`w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl text-xs font-extrabold transition ${
                      isCancellable
                        ? "border border-red-200 bg-white text-red-600 hover:bg-red-50 hover:border-red-400 active:scale-[0.99] shadow-2xs"
                        : "border border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed opacity-60"
                    }`}
                  >
                    <Ban className="w-3.5 h-3.5" />
                    {trackText.cancelOrder || (locale === "ar" ? "إلغاء طلبي" : "Annuler ma commande")}
                  </button>
                  {!isCancellable && (
                    <p className="text-[11px] text-gray-500 text-center px-1">
                      {trackText.cancelDisabled || (locale === "ar" ? "بدأ تحضير طلبك بالفعل ولا يمكن إلغاؤه الآن." : "La préparation de la commande a déjà commencé. Annulation impossible.")}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}</div>
         

          <ItemList items={items} currency={t.currency} />

          <div className="flex justify-between text-lg font-extrabold text-gray-900 border-t border-gray-100 pt-3">
            <span>{s.total}</span>
            <span>{formatPrice(order.total ?? snapshot.total, t.currency)}</span>
          </div>
        </div>
      </Overlay>
    );
  }

  /* ------------------------------- form -------------------------------- */
  const aria = (key) => ({
    "aria-invalid": errors[key] ? true : undefined,
    "aria-describedby": errors[key] ? `${FIELD_IDS[key]}-error` : undefined,
  });

  return (
    <Overlay
      title={c.title}
      closeLabel={c.close}
      onClose={onClose}
      footer={
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={onBackToCart}
            disabled={submitting}
            className="px-6 py-3 bg-white border border-gray-300 rounded-full font-bold text-gray-600 hover:border-orange-400 hover:text-orange-600 disabled:opacity-60 transition"
          >
            {c.back}
          </button>
          <button type="submit" form="checkout-form" disabled={submitting || blocked} className={`flex-1 flex items-center justify-center gap-2 ${primaryBtn}`}>
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting ? c.submitting : `${c.submit} · ${formatPrice(total, t.currency)}`}
          </button>
        </div>
      }
    >
      <form id="checkout-form" onSubmit={submit} noValidate className="space-y-5">
        {blocked && (
          <p role="alert" className="flex items-start gap-2 text-sm font-semibold text-red-600">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-none" /> {c.blocked}
          </p>
        )}

        <Field id="co-name" label={c.name} error={errors.name}>
          <input id="co-name" type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder={c.namePlaceholder} maxLength={80} className={inputClass} {...aria("name")} />
        </Field>

        <Field id="co-phone" label={c.phone} error={errors.phone}>
          <input id="co-phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={c.phonePlaceholder} maxLength={20} className={inputClass} {...aria("phone")} />
        </Field>

        <div className="space-y-2">
          <span id="co-fulfillment-label" className="text-sm font-semibold text-gray-900">
            {c.fulfillment}
          </span>
          <div role="radiogroup" aria-labelledby="co-fulfillment-label" className="grid grid-cols-2 gap-3">
            {[
              ["delivery", Truck, c.delivery],
              ["pickup", Store, c.pickup],
            ].map(([value, Icon, label], i) => (
              <button
                key={value}
                id={i === 0 ? "co-fulfillment" : undefined}
                type="button"
                role="radio"
                aria-checked={fulfillment === value}
                onClick={() => setFulfillment(value)}
                className={`flex flex-col items-center gap-2 rounded-2xl border px-3 py-4 text-sm font-semibold transition ${
                  fulfillment === value ? "border-orange-500 bg-orange-50 text-orange-600" : "border-gray-200 bg-white text-gray-600 hover:border-orange-300"
                }`}
              >
                <Icon className="w-5 h-5" /> {label}
              </button>
            ))}
          </div>
          {errors.fulfillment && (
            <p role="alert" className="text-xs font-semibold text-red-600">
              {errors.fulfillment}
            </p>
          )}
        </div>

        {isDelivery && (
          <>
            <Field id="co-municipality" label={c.municipality} error={errors.municipality}>
              {hasList || municipalitiesLoading ? (
                <select id="co-municipality" value={municipalityId} disabled={municipalitiesLoading} onChange={(e) => setMunicipalityId(e.target.value)} className={inputClass} {...aria("municipality")}>
                  <option value="">{municipalitiesLoading ? "…" : c.municipalityPlaceholder}</option>
                  {municipalities.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input id="co-municipality" type="text" value={municipalityText} onChange={(e) => setMunicipalityText(e.target.value)} placeholder={c.municipalityPlaceholder} maxLength={80} className={inputClass} {...aria("municipality")} />
              )}
            </Field>
            <Field id="co-address" label={c.address} error={errors.address}>
              <textarea id="co-address" rows={3} value={address} onChange={(e) => setAddress(e.target.value)} placeholder={c.addressPlaceholder} maxLength={300} className={`${inputClass} resize-none`} {...aria("address")} />
            </Field>
          </>
        )}

        <Field id="co-notes" label={c.notes}>
          <textarea id="co-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={c.notesPlaceholder} maxLength={300} className={`${inputClass} resize-none`} />
        </Field>

        {/* Complete summary + final price, shown before sending */}
        <section aria-label={c.summary} className="rounded-2xl border border-gray-200 bg-gray-50 p-4 space-y-3">
          <h3 className="font-bold text-gray-900">{c.summary}</h3>
          <ItemList items={summaryItems} currency={t.currency} />
          <div className="border-t border-gray-200 pt-3 space-y-1 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>{c.subtotal}</span>
              <span>{formatPrice(totals.subtotal, t.currency)}</span>
            </div>
            {isDelivery && selectedMunicipality?.deliveryFee != null && (
              <div className="flex justify-between text-gray-600">
                <span>{c.deliveryFee}</span>
                <span>{formatPrice(deliveryFee, t.currency)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-extrabold text-gray-900">
              <span>{c.total}</span>
              <span>{formatPrice(total, t.currency)}</span>
            </div>
          </div>
        </section>

        {serverError && (
          <p role="alert" className="flex items-start gap-2 text-sm font-semibold text-red-600">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-none" /> {serverError}
          </p>
        )}
      </form>
    </Overlay>
  );
}