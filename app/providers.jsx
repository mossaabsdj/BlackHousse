// app/providers.jsx
"use client";

import { Suspense } from "react";
import { SessionProvider } from "next-auth/react";
import { I18nProvider } from "@/lib/i18n/I18nContext";
import { PwaProvider } from "@/app/component/PWA/PwaContext";
import PwaInstallModal from "@/app/component/PWA/PwaInstallModal";
import PwaInstallBanner from "@/app/component/PWA/PwaInstallBanner";
import { NavigationLoadingProvider } from "@/app/component/NavigationLoading/NavigationLoadingContext";

export function Providers({ children }) {
  return (
    <SessionProvider>
      <I18nProvider>
        <PwaProvider>
          <Suspense fallback={null}>
            <NavigationLoadingProvider>
              {children}
              <PwaInstallModal />
              <PwaInstallBanner />
            </NavigationLoadingProvider>
          </Suspense>
        </PwaProvider>
      </I18nProvider>
    </SessionProvider>
  );
}
