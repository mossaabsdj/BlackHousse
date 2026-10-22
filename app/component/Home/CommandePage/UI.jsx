"use client";
import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { MAX_QTY } from "./Logic";

export function Stepper({ value, onChange, min = 1, max = MAX_QTY, t, disabled = false }) {
  return (
    <div className="inline-flex items-center rounded-full border border-gray-300 bg-white">
      <button
        type="button"
        aria-label={t.decrease}
        disabled={disabled || value <= min}
        onClick={() => onChange(value - 1)}
        className="w-9 h-9 flex items-center justify-center text-gray-600 hover:text-orange-600 disabled:opacity-40 disabled:hover:text-gray-600"
      >
        <Minus className="w-4 h-4" />
      </button>
      <span className="w-8 text-center font-bold text-gray-900" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        aria-label={t.increase}
        disabled={disabled || value >= max}
        onClick={() => onChange(value + 1)}
        className="w-9 h-9 flex items-center justify-center text-gray-600 hover:text-orange-600 disabled:opacity-40 disabled:hover:text-gray-600"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
}

/** Product image from the database, with a neutral fallback if missing or broken. */
export function Thumb({ src, name, className = "" }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div
        aria-hidden="true"
        className={`flex items-center justify-center bg-gradient-to-br from-orange-100 to-gray-200 text-orange-600 font-extrabold text-2xl ${className}`}
      >
        {(name || "?").trim().charAt(0).toUpperCase()}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name || ""}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
    />
  );
}

export const inputClass =
  "w-full px-4 py-3 bg-white border border-gray-300 rounded-2xl text-gray-900 placeholder-gray-400 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20";

export const primaryBtn =
  "px-8 py-3 text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed rounded-full font-bold transition shadow-lg shadow-orange-500/30";