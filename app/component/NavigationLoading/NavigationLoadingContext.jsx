"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Progression from "@/app/component/Proogression/page";

const NavigationLoadingContext = createContext({
  isLoading: false,
  startLoading: () => false,
  stopLoading: () => {},
});

export function NavigationLoadingProvider({ children }) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSplashVisible, setIsSplashVisible] = useState(true);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const timeoutRef = useRef(null);

  // Initial Application Launch Splash Screen Lifecycle
  useEffect(() => {
    const startTime = Date.now();
    const MIN_SPLASH_MS = 900; // Minimum pleasant display time for branding

    const dismissSplash = () => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, MIN_SPLASH_MS - elapsed);
      setTimeout(() => {
        setIsSplashVisible(false);
      }, remaining);
    };

    if (typeof document !== "undefined") {
      if (document.readyState === "complete") {
        dismissSplash();
      } else {
        window.addEventListener("load", dismissSplash, { once: true });
      }
    }

    // Failsafe timeout: never stay locked for more than 2.5 seconds
    const failsafe = setTimeout(() => {
      setIsSplashVisible(false);
    }, 2500);

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("load", dismissSplash);
      }
      clearTimeout(failsafe);
    };
  }, []);

  // Stop navigation loading immediately when route (pathname or searchParams) changes
  useEffect(() => {
    setIsLoading(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, [pathname, searchParams]);

  // Handle browser back/forward (popstate), bfcache restore (pageshow), and escape key
  useEffect(() => {
    const handlePopState = () => {
      setIsLoading(false);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    const handlePageShow = () => {
      // bfcache restored page
      setIsLoading(false);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setIsLoading(false);
        setIsSplashVisible(false);
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      }
    };

    window.addEventListener("popstate", handlePopState);
    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("keydown", handleKeyDown);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const stopLoading = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsLoading(false);
  }, []);

  const startLoading = useCallback(
    (targetHref) => {
      if (targetHref && typeof window !== "undefined") {
        try {
          const currentUrl = new URL(window.location.href);
          const targetUrl = new URL(targetHref, window.location.origin);

          // Avoid triggering loading if navigating to the exact same pathname and search
          if (
            targetUrl.pathname === currentUrl.pathname &&
            targetUrl.search === currentUrl.search
          ) {
            return false;
          }
        } catch (e) {
          if (targetHref === pathname) return false;
        }
      }

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setIsLoading(true);

      // Failsafe: never stay locked for more than 4 seconds
      timeoutRef.current = setTimeout(() => {
        setIsLoading(false);
      }, 4000);

      return true;
    },
    [pathname]
  );

  return (
    <NavigationLoadingContext.Provider value={{ isLoading, startLoading, stopLoading }}>
      {children}
      {/* 1. Initial Application / PWA Launch Splash Screen */}
      <Progression
        isVisible={isSplashVisible}
        mode="splash"
        onDismiss={() => setIsSplashVisible(false)}
      />
      {/* 2. Route-to-Route Navigation Transition Loading */}
      {!isSplashVisible && (
        <Progression
          isVisible={isLoading}
          mode="transition"
          onDismiss={stopLoading}
        />
      )}
    </NavigationLoadingContext.Provider>
  );
}

export function useNavigationLoading() {
  return useContext(NavigationLoadingContext);
}

