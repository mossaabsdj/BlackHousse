"use client";

import { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Download,
  Share,
  PlusSquare,
  Smartphone,
  Monitor,
  Apple,
  CheckCircle2,
  MoreVertical,
  Loader2,
  Sparkles,
} from "lucide-react";
import { usePwa } from "./PwaContext";
import { useI18n } from "@/lib/i18n/I18nContext";

export default function PwaInstallModal() {
  const {
    showModal,
    closeInstallModal,
    platform,
    isIos,
    triggerInstall,
    isStandalone,
    hasNativePrompt,
  } = usePwa();
  const { t, isRTL } = useI18n();

  const [activeTab, setActiveTab] = useState(platform === "other" ? "android" : platform);
  const [installing, setInstalling] = useState(false);
  const [promptFeedback, setPromptFeedback] = useState("");

  const platforms = useMemo(
    () => [
      { id: "ios", label: t("Pwa.tabIos", {}, "iPhone / iPad"), icon: Smartphone },
      { id: "android", label: t("Pwa.tabAndroid", {}, "Android"), icon: Smartphone },
      { id: "macos", label: t("Pwa.tabMacos", {}, "Mac"), icon: Apple },
      { id: "windows", label: t("Pwa.tabWindows", {}, "Windows"), icon: Monitor },
    ],
    [t]
  );

  useEffect(() => {
    if (platform && platform !== "other") {
      setActiveTab(platform);
    }
  }, [platform]);

  // Lock scroll when modal is open
  useEffect(() => {
    if (showModal) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [showModal]);

  // Reset local action state when opening or switching tabs
  useEffect(() => {
    if (showModal) {
      setPromptFeedback("");
      setInstalling(false);
    }
  }, [showModal, activeTab]);

  const handleInstallClick = async () => {
    if (installing) return;
    setInstalling(true);
    setPromptFeedback("");
    try {
      const res = await triggerInstall();
      if (res?.triggered) {
        if (res.outcome === "accepted") {
          closeInstallModal();
        }
      } else {
        // Native prompt unavailable or already shown; guide user to browser menu
        setPromptFeedback("manual");
      }
    } catch (err) {
      console.warn("[PWA] Installation trigger failed:", err);
      setPromptFeedback("manual");
    } finally {
      setInstalling(false);
    }
  };

  if (!showModal || isStandalone) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm"
        dir={isRTL ? "rtl" : "ltr"}
      >
        {/* Backdrop click to close */}
        <motion.div
          className="fixed inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeInstallModal}
        />

        {/* Modal Window: Light Theme & Responsive */}
        <motion.div
          role="dialog"
          aria-modal="true"
          className="relative w-full max-w-lg bg-white border border-gray-100 sm:border-gray-200 rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 sm:p-7 max-h-[90vh] sm:max-h-[85vh] overflow-y-auto text-gray-900 z-10 flex flex-col"
          initial={{ opacity: 0, y: 50, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 280, damping: 26 }}
        >
          {/* Close button */}
          <button
            type="button"
            onClick={closeInstallModal}
            className="absolute top-4 end-4 w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-800 transition flex items-center justify-center border border-gray-200"
            aria-label={t("Pwa.close", {}, "Fermer")}
          >
            <X className="w-4 h-4" />
          </button>

          {/* Header Branding */}
          <div className="flex items-center gap-3.5 pb-4 border-b border-gray-100 pe-10">
            <div className="w-14 h-14 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center p-2 shadow-sm flex-none">
              <Image
                src="/images/logo.png"
                width={44}
                height={44}
                alt="BlackHousse Logo"
                className="object-contain"
                priority
              />
            </div>
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-orange-50 border border-orange-100 text-[11px] text-orange-600 font-extrabold uppercase tracking-wide mb-1">
                <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                <span>{t("Pwa.badge", {}, "Application Officielle")}</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-gray-900 leading-tight truncate">
                {t("Pwa.modalTitle", {}, "Installer BlackHousse")}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-1 sm:line-clamp-none">
                {t("Pwa.modalSubtitle", {}, "Accès rapide en 1 clic • Mode plein écran • Sans téléchargement lourd")}
              </p>
            </div>
          </div>

          {/* Platform Selector Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-gray-100 rounded-2xl border border-gray-200/80 my-4 overflow-x-auto scrollbar-none">
            {platforms.map((p) => {
              const Icon = p.icon;
              const isActive = activeTab === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setActiveTab(p.id)}
                  className={`flex-1 min-w-[85px] py-2 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 whitespace-nowrap ${
                    isActive
                      ? "bg-orange-500 text-white shadow-md shadow-orange-500/25"
                      : "text-gray-600 hover:text-gray-900 hover:bg-white/80"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 flex-none" />
                  <span>{p.label}</span>
                </button>
              );
            })}
          </div>

          {/* Step-by-Step Instructions per Platform */}
          <div className="space-y-4 py-1 flex-1">
            {/* iOS Instructions */}
            {activeTab === "ios" && (
              <div className="space-y-3.5 text-xs text-gray-700">
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-900 flex items-start gap-2.5">
                  <span className="text-base flex-none">💡</span>
                  <span className="leading-relaxed font-medium">
                    {t("Pwa.iosTip", {}, "Sur iPhone et iPad, utilisez le navigateur Safari pour ajouter l'application.")}
                  </span>
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-gray-50 border border-gray-200/80">
                    <span className="w-6 h-6 rounded-full bg-orange-500 text-white font-black flex items-center justify-center text-xs flex-none shadow-sm shadow-orange-500/25">
                      1
                    </span>
                    <div className="space-y-1 min-w-0">
                      <p className="font-bold text-gray-900 flex items-center gap-1.5 flex-wrap">
                        <span>{t("Pwa.iosStep1Title", {}, "Appuyez sur le bouton de Partage")}</span>
                        <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-lg bg-orange-50 border border-orange-200 text-orange-600">
                          <Share className="w-3.5 h-3.5" />
                        </span>
                      </p>
                      <p className="text-gray-500 leading-relaxed">
                        {t("Pwa.iosStep1Desc", {}, "Situé dans la barre d'outils en bas de votre écran Safari (ou en haut sur iPad).")}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-gray-50 border border-gray-200/80">
                    <span className="w-6 h-6 rounded-full bg-orange-500 text-white font-black flex items-center justify-center text-xs flex-none shadow-sm shadow-orange-500/25">
                      2
                    </span>
                    <div className="space-y-1 min-w-0">
                      <p className="font-bold text-gray-900 flex items-center gap-1.5 flex-wrap">
                        <span>{t("Pwa.iosStep2Title", {}, "Sélectionnez « Sur l'écran d'accueil »")}</span>
                        <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-lg bg-orange-50 border border-orange-200 text-orange-600">
                          <PlusSquare className="w-3.5 h-3.5" />
                        </span>
                      </p>
                      <p className="text-gray-500 leading-relaxed">
                        {t("Pwa.iosStep2Desc", {}, "Faites défiler le menu de partage vers le bas jusqu'à cette option.")}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-gray-50 border border-gray-200/80">
                    <span className="w-6 h-6 rounded-full bg-orange-500 text-white font-black flex items-center justify-center text-xs flex-none shadow-sm shadow-orange-500/25">
                      3
                    </span>
                    <div className="space-y-1 min-w-0">
                      <p className="font-bold text-gray-900">
                        {t("Pwa.iosStep3Title", {}, "Appuyez sur « Ajouter » en haut à droite")}
                      </p>
                      <p className="text-gray-500 leading-relaxed">
                        {t("Pwa.iosStep3Desc", {}, "L'icône BlackHousse apparaîtra immédiatement sur votre écran d'accueil comme une application native.")}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Android Instructions & Direct Install */}
            {activeTab === "android" && (
              <div className="space-y-3.5 text-xs text-gray-700">
                <p className="text-gray-500 leading-relaxed">
                  {t("Pwa.androidDesc", {}, "L'installation sur Android vous offre une expérience fluide en plein écran avec notifications en temps réel.")}
                </p>

                <div className="space-y-2.5">
                  <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-gray-50 border border-gray-200/80">
                    <span className="w-6 h-6 rounded-full bg-orange-500 text-white font-black flex items-center justify-center text-xs flex-none shadow-sm shadow-orange-500/25">
                      1
                    </span>
                    <div className="space-y-1 min-w-0">
                      <p className="font-bold text-gray-900 flex items-center gap-1.5 flex-wrap">
                        <span>{t("Pwa.androidStep1Title", {}, "Ouvrez le menu du navigateur")}</span>
                        <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-lg bg-orange-50 border border-orange-200 text-orange-600">
                          <MoreVertical className="w-3.5 h-3.5" />
                        </span>
                      </p>
                      <p className="text-gray-500 leading-relaxed">
                        {t("Pwa.androidStep1Desc", {}, "Sur Chrome, Samsung Internet ou Edge, appuyez sur les 3 points (⋮) en haut à droite.")}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-gray-50 border border-gray-200/80">
                    <span className="w-6 h-6 rounded-full bg-orange-500 text-white font-black flex items-center justify-center text-xs flex-none shadow-sm shadow-orange-500/25">
                      2
                    </span>
                    <div className="space-y-1 min-w-0">
                      <p className="font-bold text-gray-900 flex items-center gap-1.5 flex-wrap">
                        <span>{t("Pwa.androidStep2Title", {}, "Choisissez « Installer l'application »")}</span>
                        <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-lg bg-orange-50 border border-orange-200 text-orange-600">
                          <Download className="w-3.5 h-3.5" />
                        </span>
                      </p>
                      <p className="text-gray-500 leading-relaxed">
                        {t("Pwa.androidStep2Desc", {}, "Ou « Ajouter à l'écran d'accueil » selon votre navigateur.")}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-gray-50 border border-gray-200/80">
                    <span className="w-6 h-6 rounded-full bg-orange-500 text-white font-black flex items-center justify-center text-xs flex-none shadow-sm shadow-orange-500/25">
                      3
                    </span>
                    <div className="space-y-1 min-w-0">
                      <p className="font-bold text-gray-900">
                        {t("Pwa.androidStep3Title", {}, "Confirmez l'installation")}
                      </p>
                      <p className="text-gray-500 leading-relaxed">
                        {t("Pwa.androidStep3Desc", {}, "L'application s'installe en quelques secondes sans passer par le Play Store.")}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Primary Action Button */}
                <div className="pt-1 space-y-2">
                  <button
                    type="button"
                    onClick={handleInstallClick}
                    disabled={installing}
                    className="w-full py-3.5 px-4 rounded-2xl bg-orange-500 hover:bg-orange-600 active:scale-[0.99] font-extrabold text-white shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 transition duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {installing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    <span>
                      {installing
                        ? t("Pwa.androidBtnInstalling", {}, "Installation en cours...")
                        : t("Pwa.androidBtn", {}, "Installer l'application")}
                    </span>
                  </button>

                  {/* Contextual guidance if direct prompt is not supported in the current view */}
                  {promptFeedback === "manual" && (
                    <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-900 text-xs flex items-start gap-2.5 animate-in fade-in duration-200">
                      <span className="text-base flex-none">💡</span>
                      <p className="leading-relaxed font-medium">
                        {t(
                          "Pwa.androidManualHint",
                          {},
                          "Astuce : Si l'installation directe ne réagit pas, suivez les 3 étapes simples ci-dessus (menu ⋮ puis « Installer l'application »)."
                        )}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* macOS Instructions */}
            {activeTab === "macos" && (
              <div className="space-y-3.5 text-xs text-gray-700">
                <p className="text-gray-500 leading-relaxed">
                  {t("Pwa.macosDesc", {}, "Sur Mac, vous pouvez installer BlackHousse directement dans votre Dock via Safari ou Google Chrome.")}
                </p>

                <div className="space-y-2.5">
                  <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-200/80 space-y-1.5">
                    <p className="font-bold text-gray-900 flex items-center gap-2">
                      <span className="text-orange-600">
                        {t("Pwa.macosSafariTitle", {}, "Option A : Avec Safari (macOS Sonoma et +)")}
                      </span>
                    </p>
                    <p className="text-gray-500 whitespace-pre-line leading-relaxed">
                      {t("Pwa.macosSafariDesc", {}, "1. Cliquez sur le menu Fichier dans la barre supérieure du Mac.\n2. Sélectionnez « Ajouter au Dock... ».\n3. Cliquez sur « Ajouter ».")}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-200/80 space-y-1.5">
                    <p className="font-bold text-gray-900 flex items-center gap-2">
                      <span className="text-orange-600">
                        {t("Pwa.macosChromeTitle", {}, "Option B : Avec Google Chrome ou Microsoft Edge")}
                      </span>
                    </p>
                    <p className="text-gray-500 whitespace-pre-line leading-relaxed">
                      {t("Pwa.macosChromeDesc", {}, "1. Cliquez sur l'icône d'installation dans la barre d'adresse à droite.\n2. Cliquez sur « Installer » dans la fenêtre de confirmation.")}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleInstallClick}
                  disabled={installing}
                  className="w-full py-3.5 px-4 rounded-2xl bg-orange-500 hover:bg-orange-600 active:scale-[0.99] font-extrabold text-white shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 transition duration-200 disabled:opacity-70"
                >
                  {installing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  <span>{t("Pwa.macosBtn", {}, "Essayer l'installation Chrome/Edge")}</span>
                </button>
              </div>
            )}

            {/* Windows Instructions */}
            {activeTab === "windows" && (
              <div className="space-y-3.5 text-xs text-gray-700">
                <p className="text-gray-500 leading-relaxed">
                  {t("Pwa.windowsDesc", {}, "Sur Windows 10/11, BlackHousse s'intègre comme une véritable application de bureau dans le menu Démarrer et la barre des tâches.")}
                </p>

                <div className="space-y-2.5">
                  <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-gray-50 border border-gray-200/80">
                    <span className="w-6 h-6 rounded-full bg-orange-500 text-white font-black flex items-center justify-center text-xs flex-none shadow-sm shadow-orange-500/25">
                      1
                    </span>
                    <div className="space-y-1 min-w-0">
                      <p className="font-bold text-gray-900 flex items-center gap-1.5 flex-wrap">
                        <span>{t("Pwa.windowsStep1Title", {}, "Repérez l'icône dans la barre d'adresse")}</span>
                        <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-lg bg-orange-50 border border-orange-200 text-orange-600">
                          <Download className="w-3.5 h-3.5" />
                        </span>
                      </p>
                      <p className="text-gray-500 leading-relaxed">
                        {t("Pwa.windowsStep1Desc", {}, "Dans Chrome ou Edge, une petite icône d'installation s'affiche à l'extrémité droite de la barre d'URL.")}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-gray-50 border border-gray-200/80">
                    <span className="w-6 h-6 rounded-full bg-orange-500 text-white font-black flex items-center justify-center text-xs flex-none shadow-sm shadow-orange-500/25">
                      2
                    </span>
                    <div className="space-y-1 min-w-0">
                      <p className="font-bold text-gray-900">
                        {t("Pwa.windowsStep2Title", {}, "Cliquez sur « Installer »")}
                      </p>
                      <p className="text-gray-500 leading-relaxed">
                        {t("Pwa.windowsStep2Desc", {}, "Une fenêtre s'ouvrira en mode autonome sans les barres de navigateur encombrantes.")}
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleInstallClick}
                  disabled={installing}
                  className="w-full py-3.5 px-4 rounded-2xl bg-orange-500 hover:bg-orange-600 active:scale-[0.99] font-extrabold text-white shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 transition duration-200 disabled:opacity-70"
                >
                  {installing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  <span>{t("Pwa.windowsBtn", {}, "Installer maintenant sur Windows")}</span>
                </button>
              </div>
            )}
          </div>

          {/* Advantages Footer */}
          <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between text-[11px] font-semibold text-gray-500 gap-2 flex-wrap">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-none" />
              <span>{t("Pwa.benefitFast", {}, "Chargement instantané")}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-none" />
              <span>{t("Pwa.benefitRealtime", {}, "Suivi en temps réel")}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-none" />
              <span>{t("Pwa.benefitLight", {}, "0 Mo stocké")}</span>
            </span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
