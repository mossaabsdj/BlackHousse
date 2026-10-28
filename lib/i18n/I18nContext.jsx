"use client";

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from "react";
import fr from "./translations/fr.json";
import ar from "./translations/ar.json";
import en from "./translations/en.json";

export const SUPPORTED_LOCALES = ["fr", "ar", "en"];
export const DEFAULT_LOCALE = "ar";
export const LOCALE_STORAGE_KEY = "blackhousse:locale";

export const LOCALE_META = {
  fr: {
    code: "fr",
    name: "Français",
    nativeName: "Français",
    dir: "ltr",
    flag: "🇫🇷",
    currency: "DA",
    localeString: "fr-FR",
  },
  ar: {
    code: "ar",
    name: "Arabic",
    nativeName: "العربية",
    dir: "rtl",
    flag: "🇩🇿",
    currency: "د.ج",
    localeString: "ar-DZ",
  },
  en: {
    code: "en",
    name: "English",
    nativeName: "English",
    dir: "ltr",
    flag: "🇬🇧",
    currency: "DA",
    localeString: "en-US",
  },
};

export const TRANSLATIONS = { fr, ar, en };

/**
 * Resolves a dot-separated or direct key in a translation dictionary.
 */
export function resolveKey(dict, key) {
  if (!dict || !key) return undefined;
  if (dict[key] !== undefined) return dict[key];
  const parts = String(key).split(".");
  let cur = dict;
  for (const part of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = cur[part];
  }
  return cur;
}

/**
 * Replaces placeholders like {name}, {count}, {amount} with param values.
 */
export function interpolate(str, params) {
  if (typeof str !== "string") return str;
  if (!params || typeof params !== "object") return str;
  return str.replace(/\{(\w+)\}/g, (match, paramKey) => {
    return params[paramKey] !== undefined ? String(params[paramKey]) : match;
  });
}

export function getSavedLocale() {
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
      if (stored && SUPPORTED_LOCALES.includes(stored)) return stored;
    } catch {}
  }
  return DEFAULT_LOCALE;
}

/**
 * Standalone translation function for utility modules or non-React contexts.
 * Can be called with (locale, key, params, fallback) or (key, params, fallback).
 */
export function tStatic(arg1, arg2, arg3, arg4) {
  let locale, key, params, fallback;
  if (SUPPORTED_LOCALES.includes(arg1)) {
    locale = arg1;
    key = arg2;
    params = arg3;
    fallback = arg4;
  } else {
    locale = getSavedLocale();
    key = arg1;
    params = arg2;
    fallback = arg3;
  }
  const loc = SUPPORTED_LOCALES.includes(locale) ? locale : DEFAULT_LOCALE;
  let val = resolveKey(TRANSLATIONS[loc], key);
  if (val === undefined && loc !== DEFAULT_LOCALE) {
    val = resolveKey(TRANSLATIONS[DEFAULT_LOCALE], key);
  }
  if (val === undefined) {
    return fallback !== undefined ? fallback : key;
  }
  return interpolate(val, params);
}

/**
 * Standalone price formatter.
 */
export function formatPriceStatic(amount, locale) {
  const loc = (locale && SUPPORTED_LOCALES.includes(locale)) ? locale : getSavedLocale();
  const meta = LOCALE_META[loc] || LOCALE_META[DEFAULT_LOCALE];
  const num = Number(amount) || 0;
  const formattedNum = new Intl.NumberFormat(meta.localeString, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(num);

  return `${formattedNum} ${meta.currency}`;
}

/**
 * Standalone date formatter.
 */
export function formatDateStatic(date, locale, options) {
  const loc = (locale && SUPPORTED_LOCALES.includes(locale)) ? locale : getSavedLocale();
  const meta = LOCALE_META[loc] || LOCALE_META[DEFAULT_LOCALE];
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return String(date || "");

  const defaultOpts = {
    dateStyle: "medium",
    timeStyle: "short",
  };

  try {
    return new Intl.DateTimeFormat(meta.localeString, options || defaultOpts).format(d);
  } catch {
    return d.toLocaleString(meta.localeString);
  }
}

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(DEFAULT_LOCALE);
  const [isMounted, setIsMounted] = useState(false);

  // Initialize from localStorage or cookie on client mount
  useEffect(() => {
    setIsMounted(true);
    try {
      const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
      if (stored && SUPPORTED_LOCALES.includes(stored)) {
        setLocaleState(stored);
        applyDomLocale(stored);
      } else {
        // Match browser language if user hasn't set one yet
        const navLang = navigator.language?.slice(0, 2)?.toLowerCase();
        if (navLang && SUPPORTED_LOCALES.includes(navLang) && navLang !== DEFAULT_LOCALE) {
          setLocaleState(navLang);
          applyDomLocale(navLang);
        } else {
          applyDomLocale(DEFAULT_LOCALE);
        }
      }
    } catch {
      applyDomLocale(DEFAULT_LOCALE);
    }
  }, []);

  const applyDomLocale = (loc) => {
    const meta = LOCALE_META[loc] || LOCALE_META[DEFAULT_LOCALE];
    if (typeof document !== "undefined") {
      document.documentElement.lang = loc;
      document.documentElement.dir = meta.dir;
      if (meta.dir === "rtl") {
        document.documentElement.classList.add("rtl");
      } else {
        document.documentElement.classList.remove("rtl");
      }
    }
    // Sync locale to Cache Storage so background Service Worker can read it
    try {
      if (typeof window !== "undefined" && "caches" in window) {
        caches
          .open("blackhousse-locale")
          .then((c) => c.put("/locale", new Response(loc)))
          .catch(() => {});
      }
    } catch {}
  };

  const setLocale = useCallback((newLocale) => {
    if (!SUPPORTED_LOCALES.includes(newLocale)) return;
    setLocaleState(newLocale);
    applyDomLocale(newLocale);
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, newLocale);
      document.cookie = `NEXT_LOCALE=${newLocale};path=/;max-age=31536000;SameSite=Lax`;
    } catch {}
  }, []);

  const meta = LOCALE_META[locale] || LOCALE_META[DEFAULT_LOCALE];
  const currentDict = TRANSLATIONS[locale] || TRANSLATIONS[DEFAULT_LOCALE];
  const fallbackDict = TRANSLATIONS[DEFAULT_LOCALE];

  const t = useCallback(
    (key, params, fallback) => {
      let val = resolveKey(currentDict, key);
      if (val === undefined && currentDict !== fallbackDict) {
        val = resolveKey(fallbackDict, key);
      }
      if (val === undefined) {
        return fallback !== undefined ? fallback : key;
      }
      return interpolate(val, params);
    },
    [currentDict, fallbackDict]
  );

  const formatPrice = useCallback(
    (amount) => {
      return formatPriceStatic(amount, locale);
    },
    [locale]
  );

  const formatDate = useCallback(
    (date, options) => {
      return formatDateStatic(date, locale, options);
    },
    [locale]
  );

  // Provides seamless content compatibility with legacy content.json
  const content = useMemo(() => {
    return {
      TitleApp: meta.name,
      logo: "/images/logo.png",
      FirstPage: currentDict.FirstPage || fallbackDict.FirstPage,
      MenuPage: currentDict.MenuPage || fallbackDict.MenuPage,
      FeedbackPage: currentDict.FeedbackPage || fallbackDict.FeedbackPage,
      OrderingPage: currentDict.OrderingPage || fallbackDict.OrderingPage,
      OrderStatus: currentDict.OrderStatus || fallbackDict.OrderStatus,
      Admin: currentDict.Admin || fallbackDict.Admin,
      Ticket: currentDict.Ticket || fallbackDict.Ticket,
      AboutUs: currentDict.AboutUs || fallbackDict.AboutUs,
      HelpCenter: currentDict.HelpCenter || fallbackDict.HelpCenter,
      PrivacyPolicy: currentDict.PrivacyPolicy || fallbackDict.PrivacyPolicy,
      TermsConditions: currentDict.TermsConditions || fallbackDict.TermsConditions,
      Footer: currentDict.Footer || fallbackDict.Footer,
      Auth: currentDict.Auth || fallbackDict.Auth,
      Pwa: currentDict.Pwa || fallbackDict.Pwa,
      Offline: currentDict.Offline || fallbackDict.Offline,
    };
  }, [currentDict, fallbackDict, meta.name]);

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      dir: meta.dir,
      isRTL: meta.dir === "rtl",
      currency: meta.currency,
      meta,
      locales: SUPPORTED_LOCALES,
      t,
      content,
      formatPrice,
      formatDate,
      isMounted,
    }),
    [locale, setLocale, meta, t, content, formatPrice, formatDate, isMounted]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Graceful fallback for components rendered outside I18nProvider
    const defaultMeta = LOCALE_META[DEFAULT_LOCALE];
    const defaultDict = TRANSLATIONS[DEFAULT_LOCALE];
    return {
      locale: DEFAULT_LOCALE,
      setLocale: () => {},
      dir: defaultMeta.dir,
      isRTL: false,
      currency: defaultMeta.currency,
      meta: defaultMeta,
      locales: SUPPORTED_LOCALES,
      t: (key, params, fallback) => {
        const val = resolveKey(defaultDict, key);
        return interpolate(val !== undefined ? val : fallback !== undefined ? fallback : key, params);
      },
      content: defaultDict,
      formatPrice: (amount) => formatPriceStatic(amount, DEFAULT_LOCALE),
      formatDate: (date, options) => formatDateStatic(date, DEFAULT_LOCALE, options),
      isMounted: false,
    };
  }
  return ctx;
}
