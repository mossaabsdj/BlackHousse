// app/providers.jsx
"use client";

import { Suspense } from "react";
import { SessionProvider } from "next-auth/react";
import { PwaProvider } from "@/app/component/PWA/PwaContext";
import PwaInstallModal from "@/app/component/PWA/PwaInstallModal";
import PwaInstallBanner from "@/app/component/PWA/PwaInstallBanner";
import { NavigationLoadingProvider } from "@/app/component/NavigationLoading/NavigationLoadingContext";

export function Providers({ children }) {
  return (
    <SessionProvider>
      <PwaProvider>
        <Suspense fallback={null}>
          <NavigationLoadingProvider>
            {children}
            <PwaInstallModal />
            <PwaInstallBanner />
          </NavigationLoadingProvider>
        </Suspense>
      </PwaProvider>
    </SessionProvider>
  );
}
