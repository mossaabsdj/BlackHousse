"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { WifiOff, RefreshCw, ArrowLeft } from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nContext";
import LanguageSwitcher from "@/app/component/LanguageSwitcher";

export default function OfflinePage() {
  const { content } = useI18n();
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

  const offlineTitle = content?.Offline?.title || "Vous êtes hors connexion";
  const offlineMessage =
    content?.Offline?.message ||
    "Une connexion Internet est indispensable pour consulter nos plats du jour, commander et suivre la préparation de votre repas en temps réel.";
  const retryLabel = checking
    ? (content?.Offline?.checking || "Vérification...")
    : (content?.Offline?.retry || "Réessayer la connexion");
  const backHomeLabel = content?.AboutUs?.backHome || "Retour à l'accueil";

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-6 select-none relative">
      <div className="absolute top-4 end-4 z-10">
        <LanguageSwitcher variant="admin" />
      </div>

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
              {offlineTitle}
            </h2>
            <p className="text-sm text-zinc-400 leading-relaxed">
              {offlineMessage}
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
              <span>{retryLabel}</span>
            </button>

            <Link
              href="/"
              className="w-full py-3 px-6 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-xs transition flex items-center justify-center gap-2 border border-zinc-700/80"
            >
              <ArrowLeft className="w-4 h-4 rtl-flip" />
              <span>{backHomeLabel}</span>
            </Link>
          </div>
        </div>

        <p className="text-xs text-zinc-600">
          BlackHousse PWA • Fast-food
        </p>
      </div>
    </div>
  );
}

