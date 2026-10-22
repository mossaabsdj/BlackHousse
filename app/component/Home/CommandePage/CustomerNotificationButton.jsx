"use client";

import { useState,useEffect } from "react";
import { Bell, BellOff, Check, Loader2, Sparkles } from "lucide-react";
import { usePushNotifications } from "@/lib/Firebase";

export default function CustomerNotificationButton({
  orderReference,
  customerPhone = null,
  className = "",
}) {
  const { isSupported, isSubscribed, loading, error, subscribe, unsubscribe } =
    usePushNotifications({
      role: "CLIENT",
      orderReference,
      customerPhone,
    });

  const [feedbackMsg, setFeedbackMsg] = useState("");

  // Automatically ensure token is linked to this order if notification permission is already granted
  useEffect(() => {
    if (!orderReference || !isSupported) return;
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
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
      }
    }
  }, [orderReference, customerPhone, isSupported]);

  if (!isSupported) {
    return null;
  }

  const handleToggle = async () => {
    setFeedbackMsg("");
    if (isSubscribed) {
      const res = await unsubscribe();
      if (res?.success) {
        setFeedbackMsg("Notifications désactivées.");
        setTimeout(() => setFeedbackMsg(""), 3500);
      }
    } else {
      const res = await subscribe({
        role: "CLIENT",
        orderReference,
        customerPhone,
      });
      if (res?.success) {
        setFeedbackMsg("Vous serez notifié à chaque changement de statut !");
        setTimeout(() => setFeedbackMsg(""), 4500);
      }
    }
  };

  return (
    <div className={`rounded-2xl border p-3.5 transition-all duration-200 ${
      isSubscribed
        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-900"
        : "bg-orange-50 border-orange-200 text-gray-800"
    } ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-none ${
            isSubscribed
              ? "bg-emerald-500 text-white shadow-sm"
              : "bg-orange-500 text-white shadow-sm shadow-orange-500/20"
          }`}>
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isSubscribed ? (
              <Check className="w-4 h-4" />
            ) : (
              <Bell className="w-4 h-4" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold truncate">
              {isSubscribed ? "Notifications de suivi activées" : "Suivre ma commande en direct"}
            </p>
            <p className="text-[11px] text-gray-500 truncate">
              {isSubscribed
                ? "Alerte reçue même si vous fermez le site"
                : "Recevez une alerte dès que votre commande est prête"}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleToggle}
          disabled={loading}
          className={`flex-none px-3 py-1.5 rounded-xl font-bold text-xs transition active:scale-95 disabled:opacity-50 flex items-center gap-1.5 ${
            isSubscribed
              ? "bg-white hover:bg-red-50 text-red-600 border border-gray-200 hover:border-red-200 shadow-sm"
              : "bg-orange-500 hover:bg-orange-600 text-white shadow-md shadow-orange-500/25"
          }`}
        >
          {loading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Chargement</span>
            </>
          ) : isSubscribed ? (
            <>
              <BellOff className="w-3.5 h-3.5" />
              <span>Désactiver</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              <span>M'alerter</span>
            </>
          )}
        </button>
      </div>

      {feedbackMsg && (
        <p className="mt-2 text-[11px] font-semibold text-emerald-700 animate-in fade-in">
          {feedbackMsg}
        </p>
      )}

      {error && (
        <p className="mt-2 text-[11px] font-semibold text-red-600 animate-in fade-in">
          {error}
        </p>
      )}
    </div>
  );
}

