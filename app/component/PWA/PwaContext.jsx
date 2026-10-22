"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

const PwaContext = createContext({
  isStandalone: false,
  canInstall: false,
  isInstalled: false,
  platform: "other",
  isIos: false,
  isSafari: false,
  showModal: false,
  openInstallModal: () => {},
  closeInstallModal: () => {},
  triggerInstall: () => {},
});

export function PwaProvider({ children }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [platform, setPlatform] = useState("other");
  const [isIos, setIsIos] = useState(false);
  const [isSafari, setIsSafari] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Platform & Standalone detection
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Detect standalone mode (already launched as installed PWA)
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia("(display-mode: standalone)").matches ||
        window.matchMedia("(display-mode: fullscreen)").matches ||
        window.matchMedia("(display-mode: minimal-ui)").matches ||
        window.navigator.standalone === true ||
        document.referrer.includes("android-app://");

      setIsStandalone(Boolean(isStandaloneMode));
    };

    checkStandalone();
    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    const handleMediaChange = (e) => setIsStandalone(e.matches);
    mediaQuery.addEventListener?.("change", handleMediaChange);

    // Detect OS / Platform
    const ua = window.navigator.userAgent || "";
    const isIOSDevice =
      /iPad|iPhone|iPod/.test(ua) ||
      (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
    const isAndroidDevice = /Android/i.test(ua);
    const isMacDevice = /Macintosh|MacIntel|MacPPC|Mac68K/i.test(ua) && !isIOSDevice;
    const isWindowsDevice = /Windows|Win32|Win64/i.test(ua);
    const isSafariBrowser =
      /Safari/i.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS/i.test(ua);

    setIsIos(isIOSDevice);
    setIsSafari(isSafariBrowser);

    if (isIOSDevice) setPlatform("ios");
    else if (isAndroidDevice) setPlatform("android");
    else if (isMacDevice) setPlatform("macos");
    else if (isWindowsDevice) setPlatform("windows");
    else setPlatform("other");

    // Register Service Worker in production & development
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/firebase-messaging-sw.js", { scope: "/" })
          .then((registration) => {
            console.log("[PWA] Service Worker registered with scope:", registration.scope);

            // Check for updates periodically
            registration.onupdatefound = () => {
              const installingWorker = registration.installing;
              if (installingWorker) {
                installingWorker.onstatechange = () => {
                  if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
                    console.log("[PWA] New version available.");
                  }
                };
              }
            };
          })
          .catch((err) => {
            console.warn("[PWA] Service worker registration error:", err);
          });
      });
    }

    // Listen for Chromium beforeinstallprompt event
    const handleBeforeInstallPrompt = (e) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      setDeferredPrompt(e);
      console.log("[PWA] beforeinstallprompt event captured");
    };

    // Listen for appinstalled event
    const handleAppInstalled = () => {
      console.log("[PWA] App successfully installed!");
      setIsInstalled(true);
      setDeferredPrompt(null);
      setShowModal(false);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      mediaQuery.removeEventListener?.("change", handleMediaChange);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const openInstallModal = useCallback(() => setShowModal(true), []);
  const closeInstallModal = useCallback(() => setShowModal(false), []);

  const triggerInstall = useCallback(async () => {
    if (deferredPrompt) {
      // Native prompt available (Android Chrome, Windows Chrome/Edge, macOS Chrome)
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        console.log("[PWA] User choice:", choice.outcome);
        if (choice.outcome === "accepted") {
          setIsInstalled(true);
        }
        setDeferredPrompt(null);
      } catch (err) {
        console.warn("[PWA] Prompt error:", err);
        setShowModal(true);
      }
    } else {
      // Automatic prompt unavailable (iOS Safari, macOS Safari, or blocked prompt)
      // Open step-by-step platform instructions
      setShowModal(true);
    }
  }, [deferredPrompt]);

  // Can install if not already running in standalone mode and not yet marked installed
  const canInstall = !isStandalone && !isInstalled;

  return (
    <PwaContext.Provider
      value={{
        isStandalone,
        canInstall,
        isInstalled,
        platform,
        isIos,
        isSafari,
        showModal,
        openInstallModal,
        closeInstallModal,
        triggerInstall,
      }}
    >
      {children}
    </PwaContext.Provider>
  );
}

export function usePwa() {
  return useContext(PwaContext);
}

