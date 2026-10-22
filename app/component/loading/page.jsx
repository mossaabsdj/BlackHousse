"use client";

import { motion, AnimatePresence } from "framer-motion";

export default function LoadingPage({ isVisible }) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.4, ease: "easeInOut" }}
          className="absolute top-0 left-0 right-0 bottom-0 z-[100000] flex items-center justify-center"
        >
          <motion.div
            className="p-6 rounded-2xl bg-white shadow-lg flex flex-col items-center"
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <div className="animate-spin rounded-full border-4 border-t-4 border-gray-300 border-t-blue-500 h-16 w-16 mb-4"></div>
            <p className="text-lg font-semibold text-gray-700">Loading...</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
