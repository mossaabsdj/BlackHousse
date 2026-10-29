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
  Menu,
  X,
  House,
  UtensilsCrossed,
  ShoppingBasket,
  Star,
  MapPin,
  ShoppingBag,
  User,
} from "lucide-react";
import { useNavigationLoading } from "@/app/component/NavigationLoading/NavigationLoadingContext";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
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

const NavTab = ({ item, active, onClick, Icon, label }) => (
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

export default function AppNavbar({}) {
  const { t, isRTL } = useI18n();
  const [open, setOpen] = React.useState(false);
  const { data: session, status } = useSession();
  const [SelectedItem, setselecteditem] = React.useState("home");
  const { startLoading } = useNavigationLoading();
  const route = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [headerHidden, setHeaderHidden] = useState(false);
  const lockRef = React.useRef(null);
  const lastScrollRef = React.useRef(0);

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
    if (pathname !== "/") {
      startLoading("/");
      sessionStorage.setItem("scrollTarget", id);
      route.push("/");
      return;
    }

    // verrouille l'item cliqué pendant le scroll fluide
    lockRef.current = SECTION_IDS[id];
    setselecteditem(SECTION_IDS[id]);
    setHeaderHidden(false);
    setTimeout(() => {
      if (Date.now() - lastScrollRef.current > 150) lockRef.current = null;
    }, 300);

    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  // Suivi de la page et de la section visible
  useEffect(() => {
    if (pathname?.startsWith("/Commande")) {
      setselecteditem("order");
      return;
    }
    if (pathname?.startsWith("/Admin")) {
      setselecteditem("admin");
      return;
    }
    if (pathname !== "/") return;

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
      setselecteditem(getActive());
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
  }, [pathname]);

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
      if (pathname !== "/") {
        startLoading("/");
        route.push("/");
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } else if (id === "feedback") ScroleInteView("FeedBack");
    else if (id === "contact") ScroleInteView("Footer");
    else if (id === "order") {
      if (pathname !== "/Commande") {
        startLoading("/Commande");
        route.push("/Commande");
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }
  };

  const sideDefs = NAV_DEFINITIONS.filter((i) => i.id !== "order");
  const leftItems = sideDefs.slice(0, 2);
  const rightItems = sideDefs.slice(2);
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
              setselecteditem("Home");
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
              className="rounded-lg w-11  h-10 sm:w-11 sm:h-10 object-contain"
            />
            <span className="text-sm sm:text-lg md:text-xl font-bold truncate">
              {t("brandName", null, "BlackHousse")}
            </span>
          </Link>

          {/* Desktop Nav */}
          <NavigationMenu className="hidden lg:flex">
            <NavigationMenuList className="flex gap-4 xl:gap-6">
              {NAV_DEFINITIONS.map((def) => {
                const Icon = def.icon;
                const label = t(def.labelKey);
                return (
                  <NavigationMenuItem key={def.id}>
                    <motion.button
                      onClick={() => handleNavClick(def.id)}
                      whileTap={{ scale: 0.95 }}
                      animate={
                        SelectedItem === def.id ? { scale: 1.08 } : { scale: 1 }
                      }
                      className={`text-sm font-medium transition ${
                        SelectedItem === def.id && SelectedItem !== "order"
                          ? "text-white bg-black font-bold rounded-2xl px-3 py-1.5"
                          : "text-black hover:text-gray-600"
                      }`}
                    >
                      <span className="inline-flex items-center gap-2">
                        {Icon && (
                          <Icon className={`w-4 h-4 ${isRTL ? "rtl-flip" : ""}`} />
                        )}
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
                        setselecteditem("admin");
                        if (pathname !== "/Admin") {
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

          {/* Emplacement mobile (à droite du header) :
              la page Commande y affiche ses boutons « Confirmer » et « Suivre » */}
        <div
  className={`lg:hidden flex items-center gap-1.5 sm:gap-2 flex-shrink-0 ${
    isRTL ? "mr-auto" : "ml-auto"
  }`}
>
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

          {/* Mobile Bottom Navigation
          account  <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <motion.button
                  type="button"
                  aria-label={t("nav.account")}
                  whileTap={{ scale: 0.92 }}
                  className={`flex flex-col items-center justify-center gap-0.5 w-14 sm:w-16 h-11 sm:h-12 rounded-xl border text-[9px] sm:text-[10px] font-bold transition ${
                    open
                      ? "bg-black border-black text-white shadow-md"
                      : "bg-white border-gray-300 text-gray-900 hover:border-orange-400 hover:text-orange-600"
                  }`}
                >
                  <User className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>{t("nav.account")}</span>
                </motion.button>
              </SheetTrigger>

              <SheetContent
                side="bottom"
                className="rounded-t-3xl bg-white p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
              >
                <div className="mx-auto mb-4 h-1.5 w-10 border-2 border-amber-300 rounded-full bg-gray-200" />
                <div className="mb-4">
                  <LanguageSwitcher variant="drawer" />
                </div>
                <div className="mb-3">
                  <PwaInstallButton
                    variant="drawer"
                    label={t("Pwa.installDrawer", null, "Installer l'application BlackHousse")}
                  />
                </div>
                <div className="space-y-2">
                  {status === "loading" ? (
                    <div className="w-full h-10 bg-gray-200 rounded animate-pulse" />
                  ) : session ? (
                    <>
                      <Button
                        asChild
                        className="w-full bg-black text-white hover:bg-gray-700"
                      >
                        <Link
                          href="/Admin"
                          onClick={() => {
                            setselecteditem("admin");
                            setOpen(false);
                            if (pathname !== "/Admin") {
                              startLoading("/Admin");
                            }
                          }}
                        >
                          {t("nav.dashboard")}
                        </Link>
                      </Button>
                      <Button
                        onClick={() => {
                          handleLogout();
                          setOpen(false);
                        }}
                        className="w-full bg-red-600 text-white hover:bg-red-700"
                      >
                        {t("nav.logout")}
                      </Button>
                    </>
                  ) : (
                    <Button
                      asChild
                      className="w-full bg-black hover:bg-gray-700"
                      onClick={() => setOpen(false)}
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
              </SheetContent>
            </Sheet>
          
          (portal -> toujours fixe et visible) */}
          {mounted &&
            createPortal(
              <nav
                className="lg:hidden fixed bottom-0 inset-x-0 z-50 pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] pb-[max(0.75rem,env(safe-area-inset-bottom))]"
                aria-label={t("nav.home")}
              >
                <div className="mx-auto max-w-md flex items-end rounded-3xl border border-black/5 bg-white/90 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.18)] px-1 py-1.5">
                  {leftItems.map((def) => (
                    <NavTab
                      key={def.id}
                      item={def.id}
                      label={t(def.shortKey)}
                      Icon={def.icon}
                      active={SelectedItem === def.id}
                      onClick={() => handleNavClick(def.id)}
                    />
                  ))}

                  {/* Bouton central Commander */}
                  <div className="flex-1 flex justify-center">
                    <motion.button
                      animate={{ scale: SelectedItem === "order" ? 1.1 : 1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleNavClick("order")}
                      aria-label={t("nav.order")}
                      aria-current={SelectedItem === "order" ? "page" : undefined}
                      className={`-mt-8 h-14 w-16 rounded-2xl flex flex-col items-center justify-center transition-colors duration-200 ${
                        SelectedItem === "order"
                          ? "bg-black text-white"
                          : "bg-white text-black"
                      }`}
                    >
                      <OrderIcon className="w-6 h-6" />
                      <span className="text-[10px] font-medium">{t("nav.order")}</span>
                    </motion.button>
                  </div>

                  {rightItems.map((def) => (
                    <NavTab
                      key={def.id}
                      item={def.id}
                      label={t(def.shortKey)}
                      Icon={def.icon}
                      active={SelectedItem === def.id}
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