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

export default function AdminNotificationToggle({ compact = false }) {
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
      setStatusMsg("Notifications activées ! Vous recevrez un push à chaque nouvelle commande.");
    } else {
      setStatusError(res?.error || "Impossible d'activer les notifications.");
    }
  };

  const handleUnsubscribe = async () => {
    setStatusMsg("");
    setStatusError("");
    const res = await unsubscribe();
    if (res?.success) {
      setStatusMsg("Notifications push désactivées.");
    } else {
      setStatusError(res?.error || "Erreur lors de la désactivation.");
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
        throw new Error(data.message || "Échec de l'envoi de la notification de test.");
      }
      setStatusMsg("Notification de test envoyée avec succès !");
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
        aria-label="Gérer les notifications de commandes"
        title={isSubscribed ? "Notifications de commandes actives" : "Activer les notifications push"}
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
          <BellRing className="w-4 h-4 text-emerald-500" />
        ) : (
          <Bell className="w-4 h-4" />
        )}

        {!compact && (
          <span>
            {isSubscribed ? "Alertes commandes ON" : "Alertes commandes"}
          </span>
        )}

        {isSubscribed && (
          <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Overlay to close popover */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => {
              setOpen(false);
              setStatusMsg("");
              setStatusError("");
            }}
          />

          {/* Popover panel */}
          <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white text-gray-900 shadow-2xl border border-gray-200 p-5 z-50 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  isSubscribed ? "bg-emerald-500 text-white" : "bg-orange-500 text-white"
                }`}>
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-gray-900">
                    Notifications Commandes
                  </h3>
                  <p className="text-[11px] text-gray-500">Firebase Cloud Messaging</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 space-y-3">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-500">État du service :</span>
                {isSubscribed ? (
                  <span className="inline-flex items-center gap-1 font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    <Check className="w-3 h-3" /> Activé
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                    Désactivé
                  </span>
                )}
              </div>

              <p className="text-xs text-gray-600 leading-relaxed">
                {isSubscribed
                  ? "Vous recevrez une alerte sonore et visuelle à chaque nouvelle commande reçue, même lorsque l'application ou le site est en arrière-plan ou fermé."
                  : "Soyez alerté instantanément de toute nouvelle commande passée par vos clients sur le site ou l'application."}
              </p>

              {permission === "denied" && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-none mt-0.5" />
                  <div>
                    <p className="font-bold">Notifications bloquées</p>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      Les notifications sont désactivées dans les paramètres de votre navigateur. Veuillez cliquer sur le cadenas à gauche de l'URL pour les autoriser.
                    </p>
                  </div>
                </div>
              )}

              {statusMsg && (
                <p className="text-xs font-bold text-emerald-700 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                  {statusMsg}
                </p>
              )}

              {(statusError || error) && (
                <p className="text-xs font-bold text-red-600 bg-red-50 p-2.5 rounded-xl border border-red-200">
                  {statusError || error}
                </p>
              )}
            </div>

            <div className="pt-3 border-t border-gray-100 flex flex-col gap-2">
              {!isSubscribed ? (
                <button
                  type="button"
                  onClick={handleSubscribe}
                  disabled={loading}
                  className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-orange-500 hover:bg-orange-600 text-white shadow-md shadow-orange-500/25 transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Activation en cours...</span>
                    </>
                  ) : (
                    <>
                      <BellRing className="w-4 h-4" />
                      <span>Activer sur cet appareil</span>
                    </>
                  )}
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSendTest}
                    disabled={testing}
                    className="flex-1 py-2 px-3 rounded-xl font-bold text-xs bg-gray-900 hover:bg-black text-white transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {testing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span>Envoyer un test</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleUnsubscribe}
                    disabled={loading}
                    className="py-2 px-3 rounded-xl font-semibold text-xs text-red-600 hover:bg-red-50 border border-gray-200 hover:border-red-200 transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    <BellOff className="w-3.5 h-3.5" />
                    <span>Désactiver</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

