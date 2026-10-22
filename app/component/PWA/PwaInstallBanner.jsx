"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Download, X, Sparkles } from "lucide-react";
import { usePwa } from "./PwaContext";

const DISMISS_KEY = "blackhousse_pwa_banner_dismissed";
const DISMISS_DURATION_DAYS = 5;

export default function PwaInstallBanner() {
  const { canInstall, isStandalone, triggerInstall } = usePwa();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check if previously dismissed
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt) {
      const diffMs = Date.now() - Number(dismissedAt);
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      if (diffDays < DISMISS_DURATION_DAYS) {
        setDismissed(true);
        return;
      }
    }

    // Delay showing the banner slightly (e.g. 2.5 seconds) so initial page render is calm
    const timer = setTimeout(() => {
      setDismissed(false);
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // ignore localStorage quota errors
    }
  };

  if (dismissed || !canInstall || isStandalone) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.aside
        aria-label="Installer l'application BlackHousse"
        className="fixed bottom-20 lg:bottom-6 right-4 left-4 sm:left-auto sm:right-6 sm:w-96 z-40"
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
      >
        <div className="bg-zinc-950/95 border border-zinc-800 text-white rounded-3xl p-4 shadow-2xl shadow-black/80 backdrop-blur-md relative overflow-hidden">
          {/* Subtle glow accent */}
          <div className="absolute top-0 right-0 -mt-6 -mr-6 w-24 h-24 bg-orange-500/15 rounded-full blur-2xl pointer-events-none" />

          {/* Close button */}
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Ignorer l'invitation"
            className="absolute top-3 right-3 p-1 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3 pr-6">
            <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center p-1.5 shadow-md flex-none">
              <Image
                src="/images/logo.png"
                width={36}
                height={36}
                alt="BlackHousse Logo"
                className="object-contain"
              />
            </div>
            <div className="min-w-0">
              <h3 className="font-extrabold text-sm text-white tracking-wide truncate">
                Installez BlackHousse
              </h3>
              <p className="text-xs text-zinc-400 truncate">
                Commandez vos burgers plus vite
              </p>
            </div>
          </div>

          <div className="mt-3.5 flex items-center gap-2">
            <button
              type="button"
              onClick={triggerInstall}
              className="flex-1 py-2 px-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs shadow-md shadow-orange-500/25 transition flex items-center justify-center gap-1.5 active:scale-[0.98]"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Installer l'application</span>
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="py-2 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs font-semibold transition"
            >
              Plus tard
            </button>
          </div>
        </div>
      </motion.aside>
    </AnimatePresence>
  );
}

