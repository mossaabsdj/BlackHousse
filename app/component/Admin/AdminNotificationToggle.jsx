"use client";

import { useState } from "react";
import {
  Bell,
  BellOff,
  BellRing,
  Check,
  Loader2,
  Send,
  ShieldCheck,
  AlertCircle,
  X,
} from "lucide-react";
import { usePushNotifications } from "@/lib/Firebase";
import { useI18n } from "@/lib/i18n/I18nContext";

export default function AdminNotificationToggle({ compact = false }) {
  const { t, isRTL } = useI18n();
  const {
    isSupported,
    permission,
    isSubscribed,
    token,
    loading,
    error,
    subscribe,
    unsubscribe,
  } = usePushNotifications({ role: "ADMIN" });

  const [open, setOpen] = useState(false);
  const [testing, setTesting] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [statusError, setStatusError] = useState("");

  if (!isSupported) {
    return null;
  }

  const handleSubscribe = async () => {
    setStatusMsg("");
    setStatusError("");
    const res = await subscribe({ role: "ADMIN" });
    if (res?.success) {
      setStatusMsg(t("Admin.notifications.enabledSuccess", {}, "Notifications activées ! Vous recevrez un push à chaque nouvelle commande."));
    } else {
      setStatusError(res?.error || t("Admin.notifications.enableError", {}, "Impossible d'activer les notifications."));
    }
  };

  const handleUnsubscribe = async () => {
    setStatusMsg("");
    setStatusError("");
    const res = await unsubscribe();
    if (res?.success) {
      setStatusMsg(t("Admin.notifications.disabledSuccess", {}, "Notifications push désactivées."));
    } else {
      setStatusError(res?.error || t("Admin.notifications.disableError", {}, "Erreur lors de la désactivation."));
    }
  };

  const handleSendTest = async () => {
    if (!token) return;
    setTesting(true);
    setStatusMsg("");
    setStatusError("");
    try {
      const res = await fetch("/api/notifications/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || t("Admin.notifications.testSentError", {}, "Échec de l'envoi de la notification de test."));
      }
      setStatusMsg(t("Admin.notifications.testSentSuccess", {}, "Notification de test envoyée avec succès !"));
    } catch (err) {
      setStatusError(err.message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={t("Admin.notifications.panelAria", {}, "Gérer les notifications de commandes")}
        title={isSubscribed ? t("Admin.notifications.activeTitle", {}, "Notifications de commandes actives") : t("Admin.notifications.inactiveTitle", {}, "Activer les notifications push")}
        className={`relative flex items-center gap-2 rounded-xl transition active:scale-95 border ${
          compact
            ? "p-2 " +
              (isSubscribed
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white")
            : "px-3 py-1.5 text-xs font-semibold " +
              (isSubscribed
                ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                : "bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200")
        }`}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
        ) : isSubscribed ? (
          <BellRing className="w-4 h-4 text-emerald-500 animate-pulse" />
        ) : (
          <BellOff className="w-4 h-4 opacity-70" />
        )}

        {!compact && (
          <span className="truncate">
            {isSubscribed
              ? t("Admin.notifications.statusActive", {}, "Notifications ON")
              : t("Admin.notifications.statusInactive", {}, "Notifications OFF")}
          </span>
        )}

        {isSubscribed && (
          <span className="absolute -top-1 -end-1 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-white" />
        )}
      </button>

      {/* Flyout Panel */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => {
              setOpen(false);
              setStatusMsg("");
              setStatusError("");
            }}
          />
          <div className="absolute end-0 mt-2 w-80 sm:w-96 p-4 rounded-2xl bg-white border border-gray-200 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    isSubscribed
                      ? "bg-emerald-100 text-emerald-600"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900">
                    {t("Admin.notifications.manageTitle", {}, "Notifications de Commandes")}
                  </h4>
                  <p className="text-[11px] text-gray-400">
                    {t("Admin.notifications.manageSubtitle", {}, "Alertes instantanées en cas de nouvelle commande")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                aria-label={t("common.close", {}, "Fermer")}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Status messages */}
            {statusMsg && (
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 flex-none" />
                <span>{statusMsg}</span>
              </div>
            )}
            {(statusError || error) && (
              <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 flex-none" />
                <span>{statusError || error}</span>
              </div>
            )}

            {/* State explanation */}
            <div className="space-y-2 text-xs text-gray-600">
              <div className="flex items-center justify-between py-1 px-2.5 rounded-lg bg-gray-50 border border-gray-100">
                <span className="font-medium text-gray-500">{t("Admin.history.status", {}, "Statut :")}</span>
                <span
                  className={`font-bold ${
                    isSubscribed ? "text-emerald-600" : "text-gray-500"
                  }`}
                >
                  {isSubscribed
                    ? t("Admin.notifications.statusActive", {}, "Activées")
                    : t("Admin.notifications.statusInactive", {}, "Désactivées")}
                </span>
              </div>

              {permission === "denied" && (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 space-y-1">
                  <p className="font-bold flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Permission bloquée
                  </p>
                  <p>
                    Veuillez autoriser les notifications dans les paramètres de votre navigateur pour ce site.
                  </p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="pt-2 flex flex-col gap-2">
              {isSubscribed ? (
                <>
                  <button
                    type="button"
                    onClick={handleSendTest}
                    disabled={testing}
                    className="w-full py-2 px-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs transition flex items-center justify-center gap-2 shadow-sm shadow-orange-500/20 disabled:opacity-60"
                  >
                    {testing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5 rtl-flip" />
                    )}
                    <span>{t("Admin.notifications.sendTestBtn", {}, "Envoyer un test")}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleUnsubscribe}
                    disabled={loading}
                    className="w-full py-1.5 px-3 rounded-xl border border-gray-200 hover:border-red-300 hover:bg-red-50 text-gray-600 hover:text-red-600 font-semibold text-xs transition"
                  >
                    {t("Admin.notifications.disableBtn", {}, "Désactiver sur cet appareil")}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleSubscribe}
                  disabled={loading}
                  className="w-full py-2.5 px-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-extrabold text-xs transition flex items-center justify-center gap-2 shadow-md shadow-orange-500/25 disabled:opacity-60"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Bell className="w-4 h-4" />
                  )}
                  <span>{t("Admin.notifications.enableBtn", {}, "Activer les notifications")}</span>
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
