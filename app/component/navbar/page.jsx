"use client";
import { useEffect, useState } from "react";
import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import Swal from "sweetalert2";
import { createPortal } from "react-dom";

import LiquidDrip from "@/app/component/Liquiddrip.jsx";
import { motion } from "framer-motion";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useRouter, usePathname } from "next/navigation";

import {
  LayoutDashboard,
  LogOut,
  House,
  UtensilsCrossed,
  ShoppingBasket,
  Star,
  MapPin,
} from "lucide-react";
import { useNavigationLoading } from "@/app/component/NavigationLoading/NavigationLoadingContext";
import { Button } from "@/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuList,
} from "@/components/ui/navigation-menu";
import { useSession, signOut } from "next-auth/react";
import PwaInstallButton from "@/app/component/PWA/PwaInstallButton";
import { useI18n } from "@/lib/i18n/I18nContext";
import LanguageSwitcher from "@/app/component/LanguageSwitcher";

const HOME_PATH = "/Home";
const ORDER_PATH = "/Commande";

// true  -> in Arabic the nav is mirrored (Home on the right ... Contact on the left)
// false -> same left-to-right order as French / English
const MIRROR_NAV_IN_RTL = true;

const NAV_DEFINITIONS = [
  { id: "home", labelKey: "nav.home", shortKey: "nav.home", icon: House },
  { id: "menu", labelKey: "nav.menu", shortKey: "nav.shortMenu", icon: UtensilsCrossed },
  { id: "order", labelKey: "nav.order", shortKey: "nav.order", icon: ShoppingBasket },
  { id: "feedback", labelKey: "nav.feedback", shortKey: "nav.shortFeedback", icon: Star },
  { id: "contact", labelKey: "nav.contact", shortKey: "nav.shortContact", icon: MapPin },
];

// id de section (page d'accueil) -> item de navigation
const SECTION_IDS = {
  NotreMenu: "menu",
  FeedBack: "feedback",
  Footer: "contact",
};

const NavTab = ({ active, onClick, Icon, label }) => (
  <button
    onClick={onClick}
    aria-label={label}
    aria-current={active ? "page" : undefined}
    className="relative flex-1 py-2 mx-0.5"
  >
    {active && (
      <motion.span
        layoutId="bottom-nav-pill"
        className="absolute inset-0 rounded-2xl bg-black"
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
      />
    )}
    <motion.span
      whileTap={{ scale: 0.88 }}
      className={`relative z-10 flex flex-col items-center gap-0.5 text-[11px] font-medium transition-colors ${
        active ? "text-white" : "text-gray-500"
      }`}
    >
      {Icon && <Icon className="w-5 h-5" />}
      <span>{label}</span>
    </motion.span>
  </button>
);

export default function AppNavbar() {
  const { t, isRTL } = useI18n();
  const { data: session, status } = useSession();
  // Active section while scrolling the Home page (scroll-spy)
  const [sectionItem, setSectionItem] = React.useState("home");
  const { startLoading } = useNavigationLoading();
  const route = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [headerHidden, setHeaderHidden] = useState(false);
  const lockRef = React.useRef(null);
  const lastScrollRef = React.useRef(0);

  // Case-insensitive route checks
  const pathLower = (pathname || "").toLowerCase();
  const isHome = pathLower === HOME_PATH.toLowerCase();
  const isOrderPage = pathLower.startsWith(ORDER_PATH.toLowerCase());
  const isAdminPage = pathLower.startsWith("/admin");

  // The active tab comes straight from the URL, so it can never be stale.
  // Only the Home page uses the scroll-spy section.
  const activeId = isOrderPage
    ? "order"
    : isAdminPage
    ? "admin"
    : isHome
    ? sectionItem
    : null;

  // Direction used by the nav bars (mirrors the item order in Arabic)
  const navDir = isRTL && MIRROR_NAV_IN_RTL ? "rtl" : "ltr";

  useEffect(() => setMounted(true), []);

  const handleLogout = () => {
    Swal.fire({
      title: t("nav.logoutConfirmTitle"),
      text: t("nav.logoutConfirmText"),
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: t("nav.logoutConfirmYes"),
      cancelButtonText: t("nav.logoutConfirmCancel"),
    }).then((result) => {
      if (result.isConfirmed) {
        startLoading("/");
        signOut({ callbackUrl: "/" });
      }
    });
  };

  const ScroleInteView = (id) => {
    if (!isHome) {
      startLoading(HOME_PATH);
      sessionStorage.setItem("scrollTarget", id);
      route.push(HOME_PATH);
      return;
    }

    // verrouille l'item cliqué pendant le scroll fluide
    lockRef.current = SECTION_IDS[id];
    setSectionItem(SECTION_IDS[id]);
    setHeaderHidden(false);
    setTimeout(() => {
      if (Date.now() - lastScrollRef.current > 150) lockRef.current = null;
    }, 300);

    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  // Scroll-spy: only runs on the Home page
  useEffect(() => {
    if (!isHome) return;

    let ticking = false;
    let timer;

    const getActive = () => {
      const atBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 4;
      if (atBottom && document.getElementById("Footer"))
        return SECTION_IDS.Footer;

      const line = window.innerHeight * 0.4;
      let current = "home";
      let best = -Infinity;
      for (const id in SECTION_IDS) {
        const el = document.getElementById(id);
        if (!el) continue;
        const top = el.getBoundingClientRect().top;
        if (top <= line && top > best) {
          best = top;
          current = SECTION_IDS[id];
        }
      }
      return current;
    };

    const update = () => {
      ticking = false;
      if (lockRef.current) return;
      setSectionItem(getActive());
    };

    const onScroll = () => {
      lastScrollRef.current = Date.now();
      if (lockRef.current) {
        clearTimeout(timer);
        timer = setTimeout(() => {
          lockRef.current = null;
          update();
        }, 120);
        return;
      }
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };

    update();
    const initTimer = setTimeout(update, 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      clearTimeout(timer);
      clearTimeout(initTimer);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [isHome]);

  // Header desktop : masqué en descendant, affiché en remontant
  useEffect(() => {
    setHeaderHidden(false);
    let lastY = window.scrollY;
    let ticking = false;
    const THRESHOLD = 8;

    const handle = () => {
      ticking = false;

      // desktop uniquement (lg = 1024px)
      if (window.innerWidth < 1024) {
        setHeaderHidden(false);
        return;
      }

      const y = window.scrollY;
      const atTop = y < 80;
      const atBottom =
        window.innerHeight + y >= document.documentElement.scrollHeight - 4;

      // scroll programmatique (clic sur un onglet) ou extrémités -> visible
      if (lockRef.current || atTop || atBottom) {
        setHeaderHidden(false);
        lastY = y;
        return;
      }

      const delta = y - lastY;
      if (Math.abs(delta) < THRESHOLD) return;

      setHeaderHidden(delta > 0);
      lastY = y;
    };

    const onScrollHide = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(handle);
      }
    };

    window.addEventListener("scroll", onScrollHide, { passive: true });
    window.addEventListener("resize", onScrollHide);
    return () => {
      window.removeEventListener("scroll", onScrollHide);
      window.removeEventListener("resize", onScrollHide);
    };
  }, [pathname]);

  const handleNavClick = (id) => {
    if (id === "menu") ScroleInteView("NotreMenu");
    else if (id === "home") {
      if (!isHome) {
        startLoading(HOME_PATH);
        route.push(HOME_PATH);
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } else if (id === "feedback") ScroleInteView("FeedBack");
    else if (id === "contact") ScroleInteView("Footer");
    else if (id === "order") {
      if (!isOrderPage) {
        startLoading(ORDER_PATH);
        route.push(ORDER_PATH);
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }
  };

  // Logical order: Home, Menu, [ORDER], Feedback, Contact.
  // The direction (navDir) decides which side each one ends up on.
  const sideDefs = NAV_DEFINITIONS.filter((i) => i.id !== "order");
  const startItems = sideDefs.slice(0, 2);
  const endItems = sideDefs.slice(2);
  const orderDef = NAV_DEFINITIONS.find((i) => i.id === "order");
  const OrderIcon = orderDef?.icon ?? ShoppingBasket;

  return (
    <>
      <motion.header
        initial={false}
        animate={{ y: headerHidden ? "-250%" : "0%" }}
        transition={{ type: "tween", duration: 0.3, ease: "easeOut" }}
        style={{ pointerEvents: headerHidden ? "none" : "auto" }}
        className="sticky top-0 bg-white text-black drop-shadow-md header-safe-area pb-2.5 sm:pb-4 z-50 w-full"
      >
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="flex items-center justify-between gap-2 sm:gap-4"
        >
          {/* Logo and Brand */}
          <Link
            href="/"
            className="flex items-center gap-2 sm:gap-3 flex-shrink-0 min-w-0"
            onClick={(e) => {
              if (pathname !== "/") {
                startLoading("/");
              } else {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: "smooth" });
              }
            }}
          >
            <Image
              src="/images/logo.png"
              alt="Logo"
              width={50}
              height={45}
              className="rounded-lg w-11 h-10 sm:w-11 sm:h-10 object-contain"
            />
            <span className="text-sm sm:text-lg md:text-xl font-bold truncate">
              {t("brandName", null, "BlackHousse")}
            </span>
          </Link>

          {/* Desktop Nav (order follows navDir) */}
          <NavigationMenu dir={navDir} className="hidden lg:flex">
            <NavigationMenuList className="flex gap-4 xl:gap-6 space-x-0">
              {NAV_DEFINITIONS.map((def) => {
                const Icon = def.icon;
                const label = t(def.labelKey);
                const active = activeId === def.id;
                return (
                  <NavigationMenuItem key={def.id}>
                    <motion.button
                      onClick={() => handleNavClick(def.id)}
                      whileTap={{ scale: 0.95 }}
                      animate={{ scale: active ? 1.08 : 1 }}
                      aria-current={active ? "page" : undefined}
                      className={`text-sm font-medium transition ${
                        active
                          ? "text-white bg-black font-bold rounded-2xl px-3 py-1.5"
                          : "text-black hover:text-gray-600"
                      }`}
                    >
                      <span className="inline-flex items-center gap-2">
                        {Icon && <Icon className="w-4 h-4" />}
                        {label}
                      </span>
                    </motion.button>
                  </NavigationMenuItem>
                );
              })}
            </NavigationMenuList>
          </NavigationMenu>

          {/* Desktop Login / Admin / LanguageSwitcher / PWA Install */}
          <div className="hidden lg:flex items-center gap-3">
            <LanguageSwitcher variant="navbar" />
            <PwaInstallButton variant="navbar" />
            {status === "loading" ? (
              <div className="w-24 h-8 bg-gray-200 rounded animate-pulse" />
            ) : session ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="font-semibold bg-black text-white hover:bg-gray-700 transition"
                  >
                    {t("nav.dashboard")}
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                  align="end"
                  className="w-48 bg-white shadow-lg rounded-xl border border-gray-200"
                >
                  <DropdownMenuItem
                    asChild
                    className="flex items-center gap-2 text-black font-medium hover:bg-gray-100 px-3 py-2 rounded-lg cursor-pointer"
                  >
                    <Link
                      href="/Admin"
                      onClick={() => {
                        if (!isAdminPage) {
                          startLoading("/Admin");
                        }
                      }}
                    >
                      <LayoutDashboard className="w-4 h-4 text-black" />
                      <span>{t("nav.dashboard")}</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="flex items-center gap-2 text-red-600 font-semibold hover:bg-red-100 px-3 py-2 rounded-lg cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 text-red-600" />
                    <span>{t("nav.logout")}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                asChild
                variant="default"
                className="bg-black hover:bg-gray-700"
              >
                <Link
                  onClick={() => {
                    if (pathname !== "/Login") {
                      startLoading("/Login");
                    }
                  }}
                  href="/Login"
                >
                  {t("nav.login")}
                </Link>
              </Button>
            )}
          </div>

          {/* Emplacement mobile (fin du header) :
              la page Commande y affiche ses boutons « Confirmer » et « Suivre » */}
          <div className="lg:hidden flex items-center gap-1.5 sm:gap-2 flex-shrink-0 ms-auto">
            <div
              id="header-mobile-slot"
              dir={isRTL ? "rtl" : "ltr"}
              className="flex items-center gap-1.5 sm:gap-2"
            />
            <LanguageSwitcher variant="navbar" />
            <PwaInstallButton
              variant="icon"
              label={t("Pwa.installDrawer", null, "Installer l'application BlackHousse")}
            />
          </div>

          {/* Mobile Bottom Navigation (portal -> toujours fixe et visible) */}
          {mounted &&
            createPortal(
              <nav
                dir={navDir}
                className="lg:hidden fixed bottom-0 inset-x-0 z-50 ps-[max(0.75rem,env(safe-area-inset-left))] pe-[max(0.75rem,env(safe-area-inset-right))] pb-[max(0.75rem,env(safe-area-inset-bottom))]"
                aria-label={t("nav.home")}
              >
                <div className="mx-auto max-w-md flex items-end rounded-3xl border border-black/5 bg-white/90 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.18)] px-1 py-1.5">
                  {startItems.map((def) => (
                    <NavTab
                      key={def.id}
                      label={t(def.shortKey)}
                      Icon={def.icon}
                      active={activeId === def.id}
                      onClick={() => handleNavClick(def.id)}
                    />
                  ))}

                  {/* Bouton central Commander */}
                  <div className="flex-1 flex justify-center">
                    <motion.button
                      animate={{ scale: activeId === "order" ? 1.1 : 1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleNavClick("order")}
                      aria-label={t("nav.order")}
                      aria-current={activeId === "order" ? "page" : undefined}
                      className={`-mt-8 h-14 w-16 rounded-2xl flex flex-col items-center justify-center transition-colors duration-200 shadow-[0_6px_16px_rgba(0,0,0,0.22)] ${
                        activeId === "order"
                          ? "bg-black text-white ring-4 ring-white"
                          : "bg-white text-black border border-black/10"
                      }`}
                    >
                      <OrderIcon className="w-6 h-6" />
                      <span className="text-[10px] font-medium">{t("nav.order")}</span>
                    </motion.button>
                  </div>

                  {endItems.map((def) => (
                    <NavTab
                      key={def.id}
                      label={t(def.shortKey)}
                      Icon={def.icon}
                      active={activeId === def.id}
                      onClick={() => handleNavClick(def.id)}
                    />
                  ))}
                </div>
              </nav>,
              document.body
            )}
        </motion.div>

        {/* Wavy bottom edge */}
        <svg
          aria-hidden="true"
          viewBox="0 0 1440 40"
          preserveAspectRatio="none"
          className="pointer-events-none absolute left-0 top-full -mt-px block h-6 sm:h-8 w-full"
        >
          <path
            className="fill-white"
            d="M0 0H1440V14C1320 34 1200 34 1080 20S840 6 720 20S480 34 360 20S120 6 0 20Z"
          />
        </svg>
        <LiquidDrip />
      </motion.header>
    </>
  );
}