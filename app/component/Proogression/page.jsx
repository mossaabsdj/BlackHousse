"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import Image from "next/image";

const FLOAT = { repeat: Infinity, duration: 2.8, ease: "easeInOut" };

function Dots({ reduceMotion }) {
  return (
    <div className="flex items-center gap-2" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="block h-2.5 w-2.5 rounded-full bg-orange-500"
          animate={
            reduceMotion
              ? { opacity: [0.3, 1, 0.3] }
              : { y: [0, -8, 0], opacity: [0.35, 1, 0.35] }
          }
          transition={{
            repeat: Infinity,
            duration: 1,
            ease: "easeInOut",
            delay: i * 0.15,
          }}
        />
      ))}
    </div>
  );
}

/**
 * BlackHousse Splash / Transition
 * - "splash": clean light full-screen intro, logo + brand + 3 animated dots
 * - "transition": light blurred overlay with 3 dots
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
              ? "bg-white px-6 py-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]"
              : "backdrop-blur-md bg-white/70 pointer-events-auto cursor-pointer"
          }`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: splashMode ? 1.02 : 1 }}
          transition={{ duration: splashMode ? 0.45 : 0.2, ease: "easeInOut" }}
        >
          {/* Very subtle halo (splash only) */}
          {splashMode && (
            <div
              aria-hidden="true"
              className="absolute h-72 w-72 sm:h-96 sm:w-96 rounded-full bg-orange-100/70 blur-3xl pointer-events-none"
            />
          )}

          <div className="relative z-10 flex flex-col items-center pointer-events-none">
            {/* Floating logo */}
            <motion.div
              animate={reduceMotion ? undefined : { y: [0, -10, 0] }}
              transition={FLOAT}
              className={splashMode ? "relative h-28 w-28 sm:h-32 sm:w-32" : "relative h-20 w-20"}
            >
              <Image
                src="/images/logo.png"
                alt="Logo BlackHousse"
                width={splashMode ? 128 : 80}
                height={splashMode ? 128 : 80}
                priority
                className="h-full w-full object-contain"
              />
            </motion.div>

            {/* Soft shadow under the logo */}
            <motion.div
              aria-hidden="true"
              animate={
                reduceMotion ? undefined : { scaleX: [1, 0.7, 1], opacity: [0.18, 0.08, 0.18] }
              }
              transition={FLOAT}
              className="mt-4 h-2 w-16 rounded-full bg-neutral-900 blur-md"
            />

            {/* Brand + slogan */}
            {splashMode && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.5 }}
                className="mt-6 text-center"
              >
                <h1 className="font-sans text-2xl sm:text-3xl font-extrabold uppercase tracking-[0.25em] text-neutral-900">
                  Black<span className="text-orange-500">Housse</span>
                </h1>
                <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.35em] text-neutral-400">
                  Where Elegance Meets Taste
                </p>
              </motion.div>
            )}

            {/* 3-dot loader */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: splashMode ? 0.3 : 0.1, duration: 0.4 }}
              className={splashMode ? "mt-10" : "mt-6"}
            >
              <Dots reduceMotion={reduceMotion} />
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}