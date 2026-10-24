"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import Image from "next/image";

const FLOAT = { repeat: Infinity, duration: 2.6, ease: "easeInOut" };

/**
 * BlackHousse Progression & Splash Screen Component
 *
 * Supports two distinct modes:
 * 1. "splash": Immersive, full-screen branded startup screen with pure black background,
 *    centered floating logo, ambient orange halo, brand slogan, and animated gradient progress bar.
 * 2. "transition": Lightweight backdrop-blur overlay for page-to-page navigation loading.
 */
export default function PageTransition({
  isVisible = true,
  onDismiss,
  mode = "transition", // "splash" | "transition"
  isSplash = false,
}) {
  const reduceMotion = useReducedMotion();
  const splashMode = mode === "splash" || isSplash;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          role="status"
          aria-live="polite"
          aria-label={splashMode ? "Chargement de BlackHousse" : "Chargement de la page"}
          onClick={onDismiss}
          className={`fixed inset-0 z-[99999] flex flex-col items-center justify-center select-none overflow-hidden ${
            splashMode
              ? "bg-[#070709] px-6 py-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]"
              : "backdrop-blur-md bg-black/60 pointer-events-auto cursor-pointer"
          }`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: splashMode ? 0.98 : 1 }}
          transition={{ duration: splashMode ? 0.45 : 0.2, ease: "easeInOut" }}
        >
          {/* Subtle Ambient Radial Glow (Splash Mode) */}
          {splashMode && (
            <>
              <div
                aria-hidden="true"
                className="absolute w-80 h-80 sm:w-96 sm:h-96 rounded-full bg-orange-500/12 blur-3xl pointer-events-none"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(249,115,22,0.12),rgba(0,0,0,0))] pointer-events-none"
              />
            </>
          )}

          <div className="relative z-10 flex flex-col items-center pointer-events-none">
            {/* Floating BlackHousse Logo */}
            <motion.div
              animate={reduceMotion ? undefined : { y: [0, -12, 0] }}
              transition={FLOAT}
              className={splashMode ? "w-28 h-28 sm:w-32 sm:h-32 relative" : "w-24 h-24 relative"}
            >
              <Image
                src="/images/logo.png"
                alt="Logo BlackHousse"
                width={splashMode ? 128 : 106}
                height={splashMode ? 128 : 106}
                priority
                className={
                  splashMode
                    ? "w-full h-full object-contain drop-shadow-[0_12px_28px_rgba(249,115,22,0.35)]"
                    : "w-full h-full object-contain"
                }
              />
            </motion.div>

            {/* Dynamic soft shadow responding to logo elevation */}
            <motion.div
              aria-hidden="true"
              animate={
                reduceMotion
                  ? undefined
                  : { scaleX: [1, 0.65, 1], opacity: [0.5, 0.2, 0.5] }
              }
              transition={FLOAT}
              className={`mt-4 rounded-full blur-md ${
                splashMode
                  ? "h-2 w-20 bg-orange-950/60"
                  : "h-2.5 w-16 bg-black/40"
              }`}
            />

            {/* Brand Title and Slogan (Splash Mode) */}
            {splashMode && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.5 }}
                className="mt-6 text-center"
              >
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-[0.25em] uppercase font-sans">
                  Black<span className="text-orange-500">Housse</span>
                </h1>
                <p className="mt-1 text-[9px] sm:text-[10px] font-extrabold uppercase tracking-[0.35em] text-orange-400/90">
                  Where Elegance Meets Taste
                </p>
              </motion.div>
            )}

            {/* Modern Animated Progress Indicator (Splash Mode) */}
            {splashMode && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.28, duration: 0.4 }}
                className="mt-8 flex flex-col items-center gap-2.5"
              >
                <div className="w-48 h-1.5 rounded-full bg-zinc-900 border border-zinc-800/80 overflow-hidden relative shadow-inner">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-orange-600 via-amber-400 to-orange-500 shadow-[0_0_12px_rgba(249,115,22,0.6)]"
                    animate={
                      reduceMotion
                        ? { width: "100%" }
                        : {
                            x: ["-100%", "100%"],
                          }
                    }
                    transition={{
                      repeat: Infinity,
                      duration: 1.5,
                      ease: "easeInOut",
                    }}
                    style={{ width: "65%" }}
                  />
                </div>
                <span className="text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">
                  Chargement...
                </span>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
}