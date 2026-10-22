"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import {
  ShoppingBag,
  History,
  TrendingUp,
  Receipt,
  UtensilsCrossed,
  Sliders,
  Layers,
  Truck,
  Database,
  Menu,
  X,
  ExternalLink,
  ShieldCheck,
  ChevronRight,
  LogOut,
  Calendar,
  PanelLeftClose,
  PanelLeftOpen,
  MessageSquareQuote,
} from "lucide-react";
import { api, formatPrice } from "./adminApi";
import { card, btnPrimary } from "./Ui";
import OrdersPanel from "./Orderspanel";
import OrdersHistoryPanel from "./OrdersHistoryPanel";
import FinancePanel from "./FinancePanel";
import ExpensesPanel from "./ExpensesPanel";
import ProductsPanel from "./Productspanel";
import OptionGroupsPanel from "./Optiongroupspanel";
import SimplePanel from "./Simplepanel";
import DatabaseBackupPanel from "./DatabaseBackupPanel";
import FeedbackPanel from "./FeedbackPanel";
import AdminNotificationToggle from "./AdminNotificationToggle";

const NAV_GROUPS = [
  {
    title: "Commandes & Ventes",
    items: [
      { id: "orders", label: "Commandes en cours", icon: ShoppingBag },
      { id: "history", label: "Historique", icon: History },
      { id: "feedback", label: "Avis & Commentaires", icon: MessageSquareQuote },
    ],
  },
  {
    title: "Comptabilité",
    items: [
      { id: "finance", label: "Finances & Bilan", icon: TrendingUp },
      { id: "expenses", label: "Registre Dépenses", icon: Receipt },
    ],
  },
  {
    title: "Menu & Restaurant",
    items: [
      { id: "products", label: "Produits", icon: UtensilsCrossed },
      { id: "options", label: "Options & Suppléments", icon: Sliders },
      { id: "categories", label: "Catégories", icon: Layers },
      { id: "municipalities", label: "Municipalités & Frais", icon: Truck },
    ],
  },
  {
    title: "Système & Données",
    items: [
      { id: "database", label: "Sauvegarde BDD (JSON)", icon: Database },
    ],
  },
];

function Categories() {
  return (
    <SimplePanel
      title="Catégories"
      url="/api/admin/categories"
      addLabel="Ajouter une catégorie"
      blank={{ sortOrder: "0" }}
      columns={[
        { key: "name", label: "Nom" },
        { key: "productCount", label: "Produits" },
        { key: "sortOrder", label: "Ordre" },
      ]}
      fields={[
        { key: "name", label: "Nom", type: "text" },
        { key: "sortOrder", label: "Ordre d'affichage", type: "int", hint: "Plus petit = affiché en premier" },
        { key: "isActive", label: "Visible sur le menu", type: "switch" },
      ]}
      describeDelete={(c) => `Supprimer la catégorie « ${c.name} » ?`}
    />
  );
}

function Municipalities() {
  return (
    <SimplePanel
      title="Municipalités de livraison"
      url="/api/admin/municipalities"
      addLabel="Ajouter une municipalité"
      blank={{ sortOrder: "0", deliveryFee: "" }}
      columns={[
        { key: "name", label: "Municipalité" },
        {
          key: "deliveryFee",
          label: "Frais de livraison",
          render: (m) =>
            m.deliveryFee == null ? (
              <span className="text-gray-400">non défini</span>
            ) : m.deliveryFee === 0 ? (
              "Gratuit"
            ) : (
              formatPrice(m.deliveryFee)
            ),
        },
        { key: "orderCount", label: "Commandes" },
      ]}
      fields={[
        { key: "name", label: "Nom de la municipalité", type: "text" },
        {
          key: "deliveryFee",
          label: "Frais de livraison (DA)",
          type: "int",
          nullable: true,
          hint: "Vide = aucun frais configuré · 0 = livraison gratuite",
        },
        { key: "sortOrder", label: "Ordre d'affichage", type: "int" },
        { key: "isActive", label: "Livraison active", type: "switch" },
      ]}
      describeDelete={(m) => `Supprimer « ${m.name} » ? Les anciennes commandes gardent leur copie du nom.`}
    />
  );
}

export default function AdminDashboard() {
  const [gate, setGate] = useState({ status: "loading" });
  const [tab, setTab] = useState("orders");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // Desktop sidebar collapsed by default (icons only)
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  const handleLogout = () => {
    signOut({ callbackUrl: "/Login" });
  };

  useEffect(() => {
    api
      .get("/api/admin/me")
      .then((me) => setGate({ status: "ok", me }))
      .catch((e) =>
        setGate({
          status: e.status === 401 ? "login" : e.status === 403 ? "forbidden" : "error",
          message: e.message,
        })
      );
  }, []);

  if (gate.status !== "ok") {
    const text = {
      loading: "Vérification de l'accès...",
      login: "Vous devez être connecté pour accéder à l'administration.",
      forbidden: "Accès réservé aux administrateurs.",
      error: gate.message || "Impossible de vérifier l'accès.",
    }[gate.status];
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-100 p-6">
        <div className={`${card} max-w-md w-full p-8 text-center space-y-4`}>
          <p className="text-gray-700" role={gate.status === "loading" ? "status" : "alert"}>
            {text}
          </p>
          {gate.status === "login" && (
            <a href="/Login" className={`${btnPrimary} inline-block`}>
              Se connecter
            </a>
          )}
        </div>
      </main>
    );
  }

  // Find active navigation item info
  const allNavItems = NAV_GROUPS.flatMap((g) => g.items);
  const activeItem = allNavItems.find((i) => i.id === tab) || allNavItems[0];

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col lg:flex-row">
      {/* ============================================================== */}
      {/* 1. DESKTOP SIDEBAR (Collapsible, Icons-Only by Default)        */}
      {/* ============================================================== */}
      <aside
        className={`hidden lg:flex flex-col fixed inset-y-0 left-0 z-30 bg-zinc-950 text-zinc-300 border-r border-zinc-800/80 shadow-2xl transition-all duration-300 ease-in-out ${
          sidebarExpanded ? "w-72" : "w-20"
        }`}
      >
        {/* Brand Header & Toggle */}
        <div
          className={`border-b border-zinc-800/80 transition-all duration-300 flex items-center ${
            sidebarExpanded ? "p-5 justify-between" : "p-4 justify-center"
          }`}
        >
          {sidebarExpanded ? (
            <>
              <div className="flex items-center gap-3 min-w-0">
<Image src="/images/logo.png" width={30} height={30}  alt="BlackHousse" className=" object-contain" />
                <div className="truncate">
                  <h1 className="font-black text-base text-white tracking-wider uppercase leading-tight truncate">
                    Black<span className="text-orange-500">Housse</span>
                  </h1>
                  <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 font-medium mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Administration</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSidebarExpanded(false)}
                title="Réduire le menu"
                aria-label="Réduire le menu"
                className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition flex-none"
              >
                <PanelLeftClose className="w-5 h-5" />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setSidebarExpanded(true)}
              title="Agrandir le menu (Barre latérale)"
              aria-label="Agrandir le menu"
              className="w-12 h-12 rounded-2xl  flex items-center justify-center shadow-lg  hover:scale-105 active:scale-95 transition-all group"
            >
<Image src="/images/logo.png" width={30} height={30}  alt="BlackHousse" className=" object-contain" />
              <PanelLeftOpen className="w-5 h-5 text-white hidden group-hover:block" />
            </button>
          )}
        </div>

        {/* Nav Groups / Items */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5 scrollbar-thin scrollbar-thumb-zinc-800">
          {NAV_GROUPS.map((group, gIdx) => (
            <div key={gIdx} className="space-y-1">
              {sidebarExpanded ? (
                <p className="px-3 text-[10px] font-extrabold uppercase tracking-widest text-zinc-500 select-none">
                  {group.title}
                </p>
              ) : (
                gIdx > 0 && <div className="w-8 mx-auto my-2 border-t border-zinc-800/60" />
              )}

              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = tab === item.id;
                  return (
                    <div key={item.id} className="relative group">
                      <button
                        type="button"
                        onClick={() => {
                          setTab(item.id);
                          // Automatically collapse sidebar after clicking a navigation item
                          setSidebarExpanded(false);
                        }}
                        title={!sidebarExpanded ? item.label : undefined}
                        className={`transition-all duration-200 text-left ${
                          sidebarExpanded
                            ? `w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold ${
                                isActive
                                  ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold shadow-lg shadow-orange-500/25 ring-1 ring-orange-400/40"
                                  : "text-zinc-300 hover:text-white hover:bg-zinc-900"
                              }`
                            : `w-12 h-12 mx-auto flex items-center justify-center rounded-2xl ${
                                isActive
                                  ? "bg-gradient-to-tr from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/30 ring-2 ring-orange-400/50"
                                  : "text-zinc-400 hover:text-white hover:bg-zinc-900/90"
                              }`
                        }`}
                      >
                        <div className={`flex items-center gap-3 ${sidebarExpanded ? "min-w-0" : "justify-center"}`}>
                          <Icon className={`w-5 h-5 flex-none ${isActive ? "text-white" : "text-zinc-400 group-hover:text-white"}`} />
                          {sidebarExpanded && <span className="truncate text-xs">{item.label}</span>}
                        </div>
                        {sidebarExpanded && isActive && (
                          <ChevronRight className="w-3.5 h-3.5 flex-none opacity-80" />
                        )}
                      </button>

                      {/* Tooltip for Collapsed State */}
                      {!sidebarExpanded && (
                        <div
                          role="tooltip"
                          className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-zinc-900 text-white text-xs font-bold rounded-xl shadow-2xl border border-zinc-700/80 whitespace-nowrap pointer-events-none opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 z-50 flex items-center gap-2"
                        >
                          <span>{item.label}</span>
                          {isActive && (
                            <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer: User profile & Quick Links */}
        <div className="p-3 border-t border-zinc-800/80 bg-zinc-950/90">
          {sidebarExpanded ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 px-2 py-1">
                <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-orange-400 flex-none">
                  {gate.me?.email?.slice(0, 2).toUpperCase() || "AD"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white truncate">{gate.me?.email}</p>
                  <div className="flex items-center gap-1 text-[10px] text-zinc-400 font-medium">
                    <ShieldCheck className="w-3 h-3 text-emerald-500 inline" />
                    <span>Administrateur</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between gap-2 text-xs">
                <Link
                  href="/"
                  className="flex items-center gap-1.5 text-zinc-400 hover:text-white transition font-medium"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Voir le site</span>
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center gap-1 text-zinc-400 hover:text-red-400 transition"
                  title="Se déconnecter"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-2">
              <div
                className="relative group w-10 h-10 rounded-xl bg-zinc-800/90 border border-zinc-700 flex items-center justify-center text-xs font-bold text-orange-400 cursor-default"
                title={gate.me?.email || "Administrateur"}
              >
                {gate.me?.email?.slice(0, 2).toUpperCase() || "AD"}
                <div
                  role="tooltip"
                  className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-zinc-900 text-white text-xs font-bold rounded-xl shadow-2xl border border-zinc-700/80 whitespace-nowrap pointer-events-none opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 z-50"
                >
                  <p>{gate.me?.email}</p>
                  <p className="text-[10px] text-emerald-400 font-normal">Administrateur</p>
                </div>
              </div>

              <Link
                href="/"
                className="relative group p-2.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-900 transition"
                title="Voir le site web"
              >
                <ExternalLink className="w-4 h-4" />
                <div
                  role="tooltip"
                  className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-zinc-900 text-white text-xs font-bold rounded-xl shadow-2xl border border-zinc-700/80 whitespace-nowrap pointer-events-none opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 z-50"
                >
                  Voir le site web
                </div>
              </Link>

              <button
                type="button"
                onClick={handleLogout}
                className="relative group p-2.5 rounded-xl text-zinc-400 hover:text-red-400 hover:bg-zinc-900 transition"
                title="Se déconnecter"
              >
                <LogOut className="w-4 h-4" />
                <div
                  role="tooltip"
                  className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-zinc-900 text-red-400 text-xs font-bold rounded-xl shadow-2xl border border-zinc-700/80 whitespace-nowrap pointer-events-none opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 z-50"
                >
                  Se déconnecter
                </div>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ============================================================== */}
      {/* 2. MOBILE TOP BAR HEADER (Preserved unchanged)                 */}
      {/* ============================================================== */}
      <header className="lg:hidden sticky top-0 z-30 bg-zinc-950 text-white admin-header-safe-area pb-3 flex items-center justify-between shadow-md border-b border-zinc-800">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Ouvrir le menu"
            className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white focus:outline-none"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Image width={30} height={30} src="/images/logo.png" alt="BlackHousse" className=" object-contain" />
            <span className="font-extrabold text-sm uppercase tracking-wider">
              Black<span className="text-orange-500">Housse</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <AdminNotificationToggle compact />
          <span className="px-2.5 py-1 rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold border border-orange-500/30">
            {activeItem.label}
          </span>
        </div>
      </header>

      {/* ============================================================== */}
      {/* 3. MOBILE SLIDE-OVER DRAWER (Preserved unchanged)              */}
      {/* ============================================================== */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
          {/* Drawer container (full width w-72 with labels) */}
          <div className="fixed inset-y-0 left-0 w-72 max-w-[85vw] z-50 shadow-2xl bg-zinc-950 flex flex-col h-full animate-in slide-in-from-left duration-200">
            {/* Brand Header */}
            <div className="p-6 border-b border-zinc-800/80 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Image src="/images/logo.png" width={40} height={40} alt="BlackHousse" className="object-contain" />
                <div>
                  <h1 className="font-black text-lg text-white tracking-wider uppercase">
                    Black<span className="text-orange-500">Housse</span>
                  </h1>
                  <div className="flex items-center gap-1.5 text-[11px] text-zinc-300 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Console d'Administration</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-xl bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Navigation Groups */}
            <nav className="flex-1 overflow-y-auto px-4 py-5 space-y-6">
              {NAV_GROUPS.map((group, gIdx) => (
                <div key={gIdx} className="space-y-1.5">
                  <p className="px-3 text-[10px] font-extrabold uppercase tracking-widest text-zinc-300/80">
                    {group.title}
                  </p>
                  <div className="space-y-1">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = tab === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setTab(item.id);
                            setMobileMenuOpen(false);
                          }}
                          className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 text-left ${
                            isActive
                              ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold shadow-lg shadow-orange-500/25 ring-1 ring-orange-400/40"
                              : "text-zinc-300 hover:text-white hover:bg-zinc-900"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <Icon className={`w-4 h-4 flex-none ${isActive ? "text-white" : "text-zinc-400"}`} />
                            <span className="truncate">{item.label}</span>
                          </div>
                          {isActive && <ChevronRight className="w-3.5 h-3.5 flex-none opacity-80" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>

            {/* Profile Footer */}
            <div className="p-4 border-t border-zinc-800/80 space-y-3 bg-zinc-950/80">
              <div className="flex items-center gap-3 px-2 py-1">
                <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-orange-400">
                  {gate.me?.email?.slice(0, 2).toUpperCase() || "AD"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white truncate">{gate.me?.email}</p>
                  <div className="flex items-center gap-1 text-[10px] text-zinc-300 font-medium">
                    <ShieldCheck className="w-3 h-3 text-emerald-500 inline" />
                    <span>Administrateur</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between gap-2 text-xs">
                <Link
                  href="/"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-1.5 text-zinc-300 hover:text-white transition font-medium"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Voir le site</span>
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleLogout();
                  }}
                  className="flex items-center gap-1 text-zinc-300 hover:text-red-400 transition"
                  title="Se déconnecter"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 4. MAIN CONTENT AREA (Smoothly adjusts to sidebar width)       */}
      {/* ============================================================== */}
      <main
        className={`flex-1 min-h-screen flex flex-col transition-all duration-300 ease-in-out ${
          sidebarExpanded ? "lg:pl-72" : "lg:pl-20"
        }`}
      >
        {/* Desktop Top Header Bar with Sidebar Toggle */}
        <header className="hidden lg:flex items-center justify-between px-8 py-4 bg-white border-b border-gray-200 shadow-sm sticky top-0 z-20">
          <div className="flex items-center gap-3.5">
            {/* Desktop Toggle Button */}
            <button
              type="button"
              onClick={() => setSidebarExpanded((prev) => !prev)}
              aria-label={sidebarExpanded ? "Réduire la barre latérale" : "Agrandir la barre latérale"}
              title={sidebarExpanded ? "Réduire la barre latérale" : "Agrandir la barre latérale"}
              className="p-2 rounded-xl text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-200 transition focus:outline-none"
            >
              {sidebarExpanded ? (
                <PanelLeftClose className="w-5 h-5 text-gray-700" />
              ) : (
                <PanelLeftOpen className="w-5 h-5 text-gray-700" />
              )}
            </button>

            <div>
              <div className="flex items-center gap-2 text-xs text-gray-400 font-medium">
                <span>Administration</span>
                <span>/</span>
                <span className="text-orange-600 font-bold">{activeItem.label}</span>
              </div>
              <h2 className="text-xl font-extrabold text-gray-900 mt-0.5">{activeItem.label}</h2>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <AdminNotificationToggle />
            <div className="flex items-center gap-1.5 text-gray-500 font-semibold bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-full">
              <Calendar className="w-3.5 h-3.5 text-orange-500" />
              <span>
                {new Date().toLocaleDateString("fr-FR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </div>
          </div>
        </header>

        {/* Dynamic Tab Content View */}
        <div className="flex-1 px-4 sm:px-6 lg:px-2 py-2 max-w-7xl w-full mx-auto space-y-6">
          {tab === "orders" && <OrdersPanel />}
          {tab === "history" && <OrdersHistoryPanel />}
          {tab === "feedback" && <FeedbackPanel />}
          {tab === "finance" && <FinancePanel onNavigateToExpenses={() => setTab("expenses")} />}
          {tab === "expenses" && <ExpensesPanel />}
          {tab === "products" && <ProductsPanel />}
          {tab === "options" && <OptionGroupsPanel />}
          {tab === "categories" && <Categories />}
          {tab === "municipalities" && <Municipalities />}
          {tab === "database" && <DatabaseBackupPanel />}
        </div>
      </main>
    </div>
  );
}