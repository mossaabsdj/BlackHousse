"use client";
import { useEffect } from "react";
import { X } from "lucide-react";

export const inputClass =
  "w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20";
const btn = "px-4 py-2 rounded-full text-sm font-bold transition disabled:opacity-60 disabled:cursor-not-allowed";
export const btnPrimary = `${btn} bg-orange-500 text-white hover:bg-orange-600 shadow-md shadow-orange-500/30`;
export const btnGhost = `${btn} bg-white border border-gray-300 text-gray-700 hover:border-orange-400 hover:text-orange-600`;
export const btnDanger = `${btn} bg-white border border-gray-300 text-red-600 hover:border-red-400`;
export const card = "rounded-3xl bg-white border border-gray-200 shadow-xl shadow-gray-300/60";

export function Modal({ title, onClose, footer, wide = false, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`flex flex-col w-full ${typeof wide === "string" ? wide : wide ? "sm:max-w-2xl" : "sm:max-w-lg"} max-h-[92vh] bg-white rounded-t-3xl sm:rounded-3xl border border-gray-200 shadow-2xl`}
      >
        <div className="flex items-center justify-between gap-4 px-6 pt-5 pb-4 border-b border-gray-100">
          <h2 className="text-xl font-extrabold text-gray-900">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Fermer" className="w-9 h-9 flex items-center justify-center rounded-full border border-gray-300 text-gray-600 hover:border-orange-400 hover:text-orange-600">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, error, hint, children }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-semibold text-gray-900">{label}</span>
      {children}
      {hint && !error && <span className="block text-xs text-gray-500">{hint}</span>}
      {error && <span role="alert" className="block text-xs font-semibold text-red-600">{typeof error === "string" ? "Valeur invalide ou manquante." : "Valeur invalide."}</span>}
    </label>
  );
}

export function Toggle({ checked, onChange, label, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-none items-center rounded-full transition-colors duration-200 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed ${
        checked ? "bg-orange-500" : "bg-gray-300"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all duration-200 ${
          checked ? "start-[22px]" : "start-0.5"
        }`}
      />
    </button>
  );
}

export const Badge = ({ children, tone = "gray" }) => (
  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${tone === "orange" ? "bg-orange-50 border-orange-200 text-orange-700" : "bg-white border-gray-300 text-gray-600"}`}>{children}</span>
);

export const ErrorBox = ({ message, onRetry }) => (
  <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 flex items-center justify-between gap-3">
    <span>{message}</span>
    {onRetry && <button type="button" onClick={onRetry} className="underline">Réessayer</button>}
  </div>
);