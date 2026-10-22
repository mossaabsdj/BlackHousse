"use client";

import { useEffect, useState } from "react";
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
  ExternalLink,
  ChevronRight,
  MoreVertical,
} from "lucide-react";
import { usePwa } from "./PwaContext";

const PLATFORMS = [
  { id: "ios", label: "iPhone / iPad", icon: Smartphone },
  { id: "android", label: "Android", icon: Smartphone },
  { id: "macos", label: "Mac (Safari / Chrome)", icon: Apple },
  { id: "windows", label: "Windows / PC", icon: Monitor },
];

export default function PwaInstallModal() {
  const { showModal, closeInstallModal, platform, isIos, triggerInstall, isStandalone } = usePwa();
  const [activeTab, setActiveTab] = useState(platform === "other" ? "android" : platform);

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

  if (!showModal || isStandalone) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-md">
        {/* Backdrop click to close */}
        <motion.div
          className="fixed inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeInstallModal}
        />

        {/* Modal Window */}
        <motion.div
          role="dialog"
          aria-modal="true"
          className="relative w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 sm:p-7 max-h-[92vh] overflow-y-auto text-white z-10"
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 260, damping: 25 }}
        >
          {/* Close button */}
          <button
            type="button"
            onClick={closeInstallModal}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 flex items-center justify-center transition"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Header Branding */}
          <div className="flex items-center gap-3.5 pb-4 border-b border-zinc-800/80">
            <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center p-2 shadow-lg flex-none">
              <Image
                src="/images/logo.png"
                width={44}
                height={44}
                alt="BlackHousse Logo"
                className="object-contain"
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-xs text-orange-400 font-bold uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                <span>Application Officielle</span>
              </div>
              <h2 className="text-xl font-black text-white">Installer BlackHousse</h2>
              <p className="text-xs text-zinc-400">
                Accès rapide en 1 clic • Mode plein écran • Sans téléchargement lourd
              </p>
            </div>
          </div>

          {/* Platform Selector Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-zinc-900/90 rounded-2xl border border-zinc-800 my-4 overflow-x-auto scrollbar-none">
            {PLATFORMS.map((p) => {
              const Icon = p.icon;
              const isActive = activeTab === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setActiveTab(p.id)}
                  className={`flex-1 min-w-[90px] py-2 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 whitespace-nowrap ${
                    isActive
                      ? "bg-orange-500 text-white shadow-md shadow-orange-500/30"
                      : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{p.label}</span>
                </button>
              );
            })}
          </div>

          {/* Step-by-Step Instructions per Platform */}
          <div className="space-y-4 py-2">
            {/* iOS Instructions */}
            {activeTab === "ios" && (
              <div className="space-y-3.5 text-xs text-zinc-300">
                <div className="p-3 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-300 flex items-center gap-2.5">
                  <span className="text-base">💡</span>
                  <span>Sur iPhone et iPad, utilisez le navigateur <strong>Safari</strong> pour ajouter l'application.</span>
                </div>

                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800/90">
                    <span className="w-6 h-6 rounded-full bg-orange-500 text-white font-extrabold flex items-center justify-center text-xs flex-none">
                      1
                    </span>
                    <div className="space-y-1">
                      <p className="font-bold text-white flex items-center gap-1.5">
                        <span>Appuyez sur le bouton de Partage</span>
                        <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-orange-400">
                          <Share className="w-3.5 h-3.5" />
                        </span>
                      </p>
                      <p className="text-zinc-400">
                        Situé dans la barre d'outils en bas de votre écran Safari (ou en haut sur iPad).
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800/90">
                    <span className="w-6 h-6 rounded-full bg-orange-500 text-white font-extrabold flex items-center justify-center text-xs flex-none">
                      2
                    </span>
                    <div className="space-y-1">
                      <p className="font-bold text-white flex items-center gap-1.5">
                        <span>Sélectionnez « Sur l'écran d'accueil »</span>
                        <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-orange-400">
                          <PlusSquare className="w-3.5 h-3.5" />
                        </span>
                      </p>
                      <p className="text-zinc-400">
                        Faites défiler le menu de partage vers le bas jusqu'à cette option.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800/90">
                    <span className="w-6 h-6 rounded-full bg-orange-500 text-white font-extrabold flex items-center justify-center text-xs flex-none">
                      3
                    </span>
                    <div className="space-y-1">
                      <p className="font-bold text-white">
                        Appuyez sur « Ajouter » en haut à droite
                      </p>
                      <p className="text-zinc-400">
                        L'icône BlackHousse apparaîtra immédiatement sur votre écran d'accueil comme une application native.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Android Instructions */}
            {activeTab === "android" && (
              <div className="space-y-3.5 text-xs text-zinc-300">
                <p className="text-zinc-400">
                  L'installation sur Android vous offre une expérience fluide en plein écran avec notifications en temps réel.
                </p>

                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800/90">
                    <span className="w-6 h-6 rounded-full bg-orange-500 text-white font-extrabold flex items-center justify-center text-xs flex-none">
                      1
                    </span>
                    <div className="space-y-1">
                      <p className="font-bold text-white flex items-center gap-1.5">
                        <span>Ouvrez le menu du navigateur</span>
                        <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-orange-400">
                          <MoreVertical className="w-3.5 h-3.5" />
                        </span>
                      </p>
                      <p className="text-zinc-400">
                        Sur Chrome, Samsung Internet ou Edge, appuyez sur les 3 points en haut à droite.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800/90">
                    <span className="w-6 h-6 rounded-full bg-orange-500 text-white font-extrabold flex items-center justify-center text-xs flex-none">
                      2
                    </span>
                    <div className="space-y-1">
                      <p className="font-bold text-white flex items-center gap-1.5">
                        <span>Choisissez « Installer l'application »</span>
                        <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-orange-400">
                          <Download className="w-3.5 h-3.5" />
                        </span>
                      </p>
                      <p className="text-zinc-400">
                        Ou « Ajouter à l'écran d'accueil » selon votre navigateur.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800/90">
                    <span className="w-6 h-6 rounded-full bg-orange-500 text-white font-extrabold flex items-center justify-center text-xs flex-none">
                      3
                    </span>
                    <div className="space-y-1">
                      <p className="font-bold text-white">Confirmez l'installation</p>
                      <p className="text-zinc-400">
                        L'application s'installe en quelques secondes sans passer par le Play Store.
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={triggerInstall}
                  className="w-full py-3 px-4 rounded-2xl bg-orange-500 hover:bg-orange-600 font-bold text-white shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 transition"
                >
                  <Download className="w-4 h-4" />
                  <span>Lancer l'installation directe</span>
                </button>
              </div>
            )}

            {/* macOS Instructions */}
            {activeTab === "macos" && (
              <div className="space-y-3.5 text-xs text-zinc-300">
                <p className="text-zinc-400">
                  Sur Mac, vous pouvez installer BlackHousse directement dans votre Dock via Safari ou Google Chrome.
                </p>

                <div className="space-y-3">
                  <div className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800/90 space-y-1.5">
                    <p className="font-bold text-white flex items-center gap-2">
                      <span className="text-orange-400">Option A :</span> Avec Safari (macOS Sonoma et +)
                    </p>
                    <p className="text-zinc-400">
                      1. Cliquez sur le menu <strong>Fichier</strong> dans la barre supérieure du Mac.<br />
                      2. Sélectionnez <strong>« Ajouter au Dock... »</strong>.<br />
                      3. Cliquez sur « Ajouter ».
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800/90 space-y-1.5">
                    <p className="font-bold text-white flex items-center gap-2">
                      <span className="text-orange-400">Option B :</span> Avec Google Chrome ou Microsoft Edge
                    </p>
                    <p className="text-zinc-400">
                      1. Cliquez sur l'icône d'installation dans la barre d'adresse à droite.<br />
                      2. Cliquez sur <strong>« Installer »</strong> dans la fenêtre de confirmation.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={triggerInstall}
                  className="w-full py-3 px-4 rounded-2xl bg-orange-500 hover:bg-orange-600 font-bold text-white shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 transition"
                >
                  <Download className="w-4 h-4" />
                  <span>Essayer l'installation Chrome/Edge</span>
                </button>
              </div>
            )}

            {/* Windows Instructions */}
            {activeTab === "windows" && (
              <div className="space-y-3.5 text-xs text-zinc-300">
                <p className="text-zinc-400">
                  Sur Windows 10/11, BlackHousse s'intègre comme une véritable application de bureau dans le menu Démarrer et la barre des tâches.
                </p>

                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800/90">
                    <span className="w-6 h-6 rounded-full bg-orange-500 text-white font-extrabold flex items-center justify-center text-xs flex-none">
                      1
                    </span>
                    <div className="space-y-1">
                      <p className="font-bold text-white flex items-center gap-1.5">
                        <span>Repérez l'icône dans la barre d'adresse</span>
                        <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-orange-400">
                          <Download className="w-3.5 h-3.5" />
                        </span>
                      </p>
                      <p className="text-zinc-400">
                        Dans Chrome ou Edge, une petite icône d'installation s'affiche à l'extrémité droite de la barre d'URL.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800/90">
                    <span className="w-6 h-6 rounded-full bg-orange-500 text-white font-extrabold flex items-center justify-center text-xs flex-none">
                      2
                    </span>
                    <div className="space-y-1">
                      <p className="font-bold text-white">Cliquez sur « Installer »</p>
                      <p className="text-zinc-400">
                        Une fenêtre s'ouvrira en mode autonome sans les barres de navigateur encombrantes.
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={triggerInstall}
                  className="w-full py-3 px-4 rounded-2xl bg-orange-500 hover:bg-orange-600 font-bold text-white shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 transition"
                >
                  <Download className="w-4 h-4" />
                  <span>Installer maintenant sur Windows</span>
                </button>
              </div>
            )}
          </div>

          {/* Advantages Footer */}
          <div className="mt-4 pt-4 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>Chargement instantané</span>
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>Suivi en temps réel</span>
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>0 Mo stocké</span>
            </span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

