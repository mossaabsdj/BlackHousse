"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import Image from "next/image";

const FLOAT = { repeat: Infinity, duration: 2.4, ease: "easeInOut" };

export default function PageTransition({ isVisible, onDismiss }) {
  const reduceMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          role="status"
          aria-live="polite"
          aria-label="Chargement de la page"
          onClick={onDismiss}
          className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-lg bg-black/40 pointer-events-auto cursor-pointer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div className="flex flex-col items-center pointer-events-none">
            {/* Floating logo */}
            <motion.div
              animate={reduceMotion ? undefined : { y: [0, -14, 0] }}
              transition={FLOAT}
              className="w-24 h-24"
            >
              <Image
                src="/images/logo.png"
                alt="Logo BlackHousse"
                width={106}
                height={106}
                priority
              />
            </motion.div>

            {/* Soft shadow that shrinks as the logo rises */}
            <motion.div
              aria-hidden="true"
              animate={
                reduceMotion
                  ? undefined
                  : { scaleX: [1, 0.65, 1], opacity: [0.5, 0.25, 0.5] }
              }
              transition={FLOAT}
              className="mt-4 h-2.5 w-16 rounded-full bg-black/40 blur-md"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}