"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { WifiOff, RefreshCw, ShoppingBag, ArrowLeft } from "lucide-react";

export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      window.location.reload();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const handleRetry = () => {
    setChecking(true);
    if (navigator.onLine) {
      window.location.reload();
    } else {
      setTimeout(() => {
        setChecking(false);
      }, 600);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-6 select-none">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Brand Header */}
        <div className="flex items-center justify-center gap-3">
          <Image
            src="/images/logo.png"
            width={48}
            height={48}
            alt="BlackHousse"
            className="object-contain"
            priority
          />
          <h1 className="text-2xl font-black uppercase tracking-wider">
            Black<span className="text-orange-500">Housse</span>
          </h1>
        </div>

        {/* Offline Card */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-8 shadow-2xl shadow-black/80 space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-500 flex items-center justify-center mx-auto">
            <WifiOff className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-extrabold text-white">
              Vous êtes hors connexion
            </h2>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Une connexion Internet est indispensable pour consulter nos plats du jour,
              commander et suivre la préparation de votre repas en temps réel.
            </p>
          </div>

          <div className="pt-2 space-y-3">
            <button
              type="button"
              onClick={handleRetry}
              disabled={checking}
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold text-sm shadow-lg shadow-orange-500/25 hover:from-orange-600 hover:to-orange-700 active:scale-[0.98] transition flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 ${checking ? "animate-spin" : ""}`} />
              <span>{checking ? "Vérification..." : "Réessayer la connexion"}</span>
            </button>

            <a
              href="/"
              className="w-full py-3 px-6 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-xs transition flex items-center justify-center gap-2 border border-zinc-700/80"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Retour à l'accueil</span>
            </a>
          </div>
        </div>

        <p className="text-xs text-zinc-600">
          BlackHousse PWA • Application de restauration rapide
        </p>
      </div>
    </div>
  );
}

