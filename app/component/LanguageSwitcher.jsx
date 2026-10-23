"use client";

import { useState, useRef, useEffect } from "react";
import { Globe, ChevronDown, Check } from "lucide-react";
import { useI18n, LOCALE_META, SUPPORTED_LOCALES } from "@/lib/i18n/I18nContext";

export default function LanguageSwitcher({ variant = "navbar", className = "" }) {
  const { locale, setLocale, isRTL } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const currentMeta = LOCALE_META[locale] || LOCALE_META.fr;

  // Drawer variant (horizontal pill selector)
  if (variant === "drawer") {
    return (
      <div className={`space-y-1.5 ${className}`}>
        <p className="text-[11px] font-extrabold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
          <Globe className="w-3.5 h-3.5" />
          <span>{locale === "ar" ? "اللغة" : locale === "en" ? "Language" : "Langue"}</span>
        </p>
        <div className="grid grid-cols-3 gap-2 p-1 bg-gray-100 rounded-2xl">
          {SUPPORTED_LOCALES.map((code) => {
            const item = LOCALE_META[code];
            const active = locale === code;
            return (
              <button
                key={code}
                type="button"
                onClick={() => setLocale(code)}
                aria-pressed={active}
                className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-bold transition ${
                  active
                    ? "bg-white text-gray-900 shadow-sm border border-gray-200"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <span>{item.flag}</span>
                <span>{item.nativeName}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Footer variant
  if (variant === "footer") {
    return (
      <div className={`flex items-center gap-2 flex-wrap ${className}`}>
        <Globe className="w-4 h-4 text-gray-400" />
        <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1">
          {SUPPORTED_LOCALES.map((code) => {
            const item = LOCALE_META[code];
            const active = locale === code;
            return (
              <button
                key={code}
                type="button"
                onClick={() => setLocale(code)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  active
                    ? "bg-white text-black shadow-xs"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <span>{item.flag}</span>
                <span>{item.nativeName}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Admin variant
  if (variant === "admin") {
    return (
      <div className={`relative ${className}`} ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-label="Changer de langue"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border border-zinc-700/80 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 transition"
        >
          <span>{currentMeta.flag}</span>
          <span className="uppercase">{currentMeta.code}</span>
          <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
        </button>

        {isOpen && (
          <div
            className={`absolute top-full mt-1.5 ${
              isRTL ? "left-0" : "right-0"
            } z-50 w-36 rounded-2xl bg-zinc-900 border border-zinc-700 shadow-2xl p-1.5 space-y-1 animate-in fade-in zoom-in-95`}
          >
            {SUPPORTED_LOCALES.map((code) => {
              const item = LOCALE_META[code];
              const active = locale === code;
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => {
                    setLocale(code);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-semibold transition ${
                    active ? "bg-orange-500 text-white" : "text-zinc-200 hover:bg-zinc-800"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span>{item.flag}</span>
                    <span>{item.nativeName}</span>
                  </span>
                  {active && <Check className="w-3.5 h-3.5" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Default navbar dropdown
  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-label="Sélectionner la langue"
        className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full border border-gray-300 hover:border-gray-400 bg-white text-gray-800 hover:text-black transition shadow-xs text-xs font-bold"
      >
        <span>{currentMeta.flag}</span>
        <span className="uppercase tracking-wide hidden sm:inline">{currentMeta.code}</span>
        <ChevronDown className="w-3 h-3 text-gray-500" />
      </button>

      {isOpen && (
        <div
          className={`absolute top-full mt-2 ${
            isRTL ? "left-0" : "right-0"
          } z-50 w-40 rounded-2xl bg-white border border-gray-200 shadow-2xl p-1.5 space-y-1 animate-in fade-in zoom-in-95`}
        >
          {SUPPORTED_LOCALES.map((code) => {
            const item = LOCALE_META[code];
            const active = locale === code;
            return (
              <button
                key={code}
                type="button"
                onClick={() => {
                  setLocale(code);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition ${
                  active
                    ? "bg-orange-500 text-white shadow-xs"
                    : "text-gray-800 hover:bg-gray-100"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="text-sm">{item.flag}</span>
                  <span>{item.nativeName}</span>
                </span>
                {active && <Check className="w-3.5 h-3.5" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

