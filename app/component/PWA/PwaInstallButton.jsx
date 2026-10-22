"use client";

import { Download, Smartphone } from "lucide-react";
import { usePwa } from "./PwaContext";

export default function PwaInstallButton({
  variant = "navbar",
  className = "",
  label = "Installer l'app",
}) {
  const { canInstall, isStandalone, triggerInstall, isIos } = usePwa();

  // Hide button if already installed or running in standalone PWA mode
  if (!canInstall || isStandalone) {
    return null;
  }

  if (variant === "drawer") {
    return (
      <button
        type="button"
        onClick={triggerInstall}
        className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-gradient-to-r from-orange-500/15 to-amber-500/10 border border-orange-500/30 text-orange-400 hover:text-white hover:bg-orange-500 transition font-bold text-xs group ${className}`}
      >
        <div className="flex items-center gap-2.5">
          <Download className="w-4 h-4 text-orange-500 group-hover:text-white transition" />
          <span>{label}</span>
        </div>
        <span className="px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 text-[10px] group-hover:bg-white/20 group-hover:text-white">
          PWA
        </span>
      </button>
    );
  }

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={triggerInstall}
        title={label}
        aria-label={label}
        className={`p-2 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 border border-orange-500/20 transition ${className}`}
      >
        <Download className="w-4 h-4" />
      </button>
    );
  }

  // Default "navbar" pill
  return (
    <button
      type="button"
      onClick={triggerInstall}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-orange-500/10 hover:bg-orange-500 text-orange-500 hover:text-white border border-orange-500/30 transition shadow-sm ${className}`}
    >
      <Download className="w-3.5 h-3.5" />
      <span>{label}</span>
    </button>
  );
}

