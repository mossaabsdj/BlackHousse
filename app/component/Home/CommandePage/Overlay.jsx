"use client";
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";

// Shared by every modal/drawer: portal, Esc (top-most only), scroll lock, focus.
const stack = [];
let locks = 0;

/**
 * variant "modal": centered dialog (bottom sheet on phones)
 * variant "drawer": right-side panel on desktop, bottom sheet on phones
 * level: raise it when opening an overlay on top of another one
 */
export default function Overlay({ title, closeLabel, onClose, footer, variant = "modal", level = 0, children }) {
  const id = useId();
  const panelRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const reduce = useReducedMotion();
  const desktop = typeof window !== "undefined" && window.matchMedia?.("(min-width: 640px)").matches;
  const drawer = variant === "drawer";

  useEffect(() => {
    stack.push(id);
    const onKey = (e) => {
      if (e.key === "Escape" && stack[stack.length - 1] === id) closeRef.current();
    };
    document.addEventListener("keydown", onKey);
    if (locks++ === 0) {
      document.body.dataset.prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      stack.splice(stack.indexOf(id), 1);
      if (--locks === 0) document.body.style.overflow = document.body.dataset.prevOverflow || "";
    };
  }, [id]);

  const from = reduce
    ? { opacity: 0 }
    : drawer && desktop
    ? { opacity: 0, x: 80 }
    : { opacity: 0, y: 60, scale: drawer ? 1 : 0.97 };
  const to = { opacity: 1, x: 0, y: 0, scale: 1 };

  return createPortal(
    <motion.div
      className={`fixed inset-0 flex bg-black/40 backdrop-blur-sm ${
        drawer ? "items-end sm:items-stretch sm:justify-end" : "items-end sm:items-center sm:justify-center sm:p-4"
      } justify-center`}
      style={{ zIndex: 100 + level * 10 }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(e) => e.target === e.currentTarget && closeRef.current()}
    >
      <motion.div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        className={`relative flex flex-col w-full bg-white outline-none shadow-2xl border border-gray-200 max-h-[92vh] rounded-t-3xl ${
          drawer ? "sm:max-w-md sm:max-h-none sm:h-full sm:rounded-none sm:rounded-l-3xl" : "sm:max-w-lg sm:rounded-3xl"
        }`}
        initial={from}
        animate={to}
        exit={from}
        transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 28 }}
      >
        <div className="flex items-center justify-between gap-4 px-6 pt-6 pb-4 border-b border-gray-100">
          <h2 id={`${id}-title`} className="text-xl sm:text-2xl font-extrabold text-gray-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={() => closeRef.current()}
            aria-label={closeLabel}
            className="flex-none w-9 h-9 flex items-center justify-center rounded-full bg-white border border-gray-300 text-gray-600 hover:border-orange-400 hover:text-orange-600 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-gray-100 bg-white rounded-b-3xl">{footer}</div>}
      </motion.div>
    </motion.div>,
    document.body
  );
}