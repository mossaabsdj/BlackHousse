"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, BellRing, Loader2 } from "lucide-react";
import { usePushNotifications } from "@/lib/Firebase";
import { useI18n } from "@/lib/i18n/I18nContext";

export default function CustomerNotificationButton({
  orderReference,
  customerPhone = null,
  alwaysActive = false,
  className = "",
}) {
  const { t } = useI18n();
  const { isSupported, isSubscribed, loading, error, subscribe, unsubscribe } =
    usePushNotifications({
      role: "CLIENT",
      orderReference,
      customerPhone,
    });

  const [feedbackMsg, setFeedbackMsg] = useState("");
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  // Link the saved token to this order if permission is already granted
  useEffect(() => {
    if (!orderReference || !isSupported) return;
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") {
        const savedToken = localStorage.getItem("bh_fcm_token");
        if (savedToken) {
          fetch("/api/notifications/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              token: savedToken,
              role: "CLIENT",
              orderReference,
              customerPhone,
            }),
          }).catch(() => {});
        } else if (alwaysActive && !isSubscribed && !loading) {
          subscribe({ role: "CLIENT", orderReference, customerPhone }).catch(() => {});
        }
      }
    }
  }, [orderReference, customerPhone, isSupported, alwaysActive, isSubscribed, loading, subscribe]);

  if (!isSupported) return null;

  const flash = (msg, ms) => {
    setFeedbackMsg(msg);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setFeedbackMsg(""), ms);
  };

  const handleToggle = async () => {
    if (loading) return;
    setFeedbackMsg("");
    if (isSubscribed) {
      if (alwaysActive) return;
      const res = await unsubscribe();
      if (res?.success) {
        flash(t("OrderingPage.notifications.disabledMsg", null, "Notifications désactivées."), 3000);
      }
    } else {
      const res = await subscribe({ role: "CLIENT", orderReference, customerPhone });
      if (res?.success) {
        flash(t("OrderingPage.notifications.enabledMsg", null, "Vous serez notifié à chaque changement !"), 3500);
      }
    }
  };

  const label = t("OrderingPage.notifications.label", null, "Notifications");
  const message = error || feedbackMsg;
  const on = isSubscribed;

  return (
    <div className={`relative inline-flex ${className}`}>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={handleToggle}
        disabled={loading || (alwaysActive && on)}
        className={`inline-flex h-9 items-center gap-2 rounded-full border ps-3 pe-2 text-xs font-bold whitespace-nowrap transition active:scale-95 disabled:cursor-default ${
          on
            ? "border-emerald-300 bg-emerald-50 text-emerald-700"
            : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
        }`}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : on ? (
          <BellRing className="h-4 w-4" />
        ) : (
          <Bell className="h-4 w-4 text-orange-500" />
        )}


        {/* Toggle switch */}
        <span
          aria-hidden="true"
          className={`relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200 ${
            on ? "bg-emerald-500" : "bg-gray-300"
          }`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all duration-200 ${
              on ? "start-[18px]" : "start-0.5"
            }`}
          />
        </span>
      </button>

      {/* Floating feedback / error */}
      {message && (
        <p
          role={error ? "alert" : "status"}
          className={`absolute top-full start-0 z-20 mt-1.5 w-max max-w-[220px] rounded-lg px-2.5 py-1.5 text-[11px] font-semibold shadow-md animate-in fade-in ${
            error
              ? "border border-red-200 bg-red-50 text-red-600"
              : "border border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}