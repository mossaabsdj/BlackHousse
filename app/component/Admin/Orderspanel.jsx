"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  RefreshCw,
  Search,
  Bell,
  CheckCircle2,
  Radio,
  X,
  Volume2,
  Plus,
  Truck,
  Store,
  Clock,
  Phone,
  MapPin,
  ChefHat,
  PackageCheck,
  ClipboardCheck,
  Printer,
  Undo2,
  SlidersHorizontal,
} from "lucide-react";
import { api, formatDate, formatPrice, useList } from "./adminApi";
import { ErrorBox, btnGhost, btnPrimary, card, inputClass } from "./Ui";
import { useRealtimeAdminOrders } from "@/lib/Firebase";
import QuickOrderModal from "./QuickOrderModal";
import AvailabilityModal from "./AvailabilityModal";
import {
  printOrderTicket,
  claimPrint,
  releasePrint,
  loadAutoPrint,
  saveAutoPrint,
} from "@/lib/admin/thermalPrint";

const AUTO_CONFIRM_KEY = "blackhousse:autoConfirm";

export function loadAutoConfirm() {
  try {
    return localStorage.getItem(AUTO_CONFIRM_KEY) !== "0"; // activé par défaut
  } catch {
    return true;
  }
}

export function saveAutoConfirm(on) {
  try {
    localStorage.setItem(AUTO_CONFIRM_KEY, on ? "1" : "0");
  } catch {}
}

/** Synthesizes a crisp, two-tone service bell chime (Ding-Dong) using the Web Audio API */
function playOrderChime() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const t0 = ctx.currentTime;

    // First tone (E5: ~659.25Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(659.25, t0);
    gain1.gain.setValueAtTime(0.3, t0);
    gain1.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.45);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(t0);
    osc1.stop(t0 + 0.45);

    // Second tone (A5: 880Hz)
    const t1 = t0 + 0.18;
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880, t1);
    gain2.gain.setValueAtTime(0.35, t1);
    gain2.gain.exponentialRampToValueAtTime(0.0001, t1 + 0.75);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(t1);
    osc2.stop(t1 + 0.75);

    // Harmonic bell shimmer (E6: ~1318.5Hz)
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = "triangle";
    osc3.frequency.setValueAtTime(1318.5, t1);
    gain3.gain.setValueAtTime(0.12, t1);
    gain3.gain.exponentialRampToValueAtTime(0.0001, t1 + 0.9);
    osc3.connect(gain3);
    gain3.connect(ctx.destination);
    osc3.start(t1);
    osc3.stop(t1 + 0.9);
  } catch (err) {
    console.warn("[Orders] Audio notification error:", err);
  }
}

/* ------------------------------------------------------------------ */
/*  Statuts : correspondance avec les valeurs existantes de l'API      */
/*  (ajuste ces alias si tes valeurs de statut sont différentes)       */
/* ------------------------------------------------------------------ */
const ALIASES = {
  confirmed: ["CONFIRMED", "PENDING", "NEW", "RECEIVED"],
  preparing: ["PREPARING", "IN_PREPARATION", "IN_PROGRESS"],
  ready: ["READY", "READY_FOR_PICKUP"],
  delivering: ["OUT_FOR_DELIVERY", "DELIVERING", "IN_DELIVERY", "ON_THE_WAY"],
  pickupDone: ["COMPLETED", "PICKED_UP", "COLLECTED", "DELIVERED"],
  deliveryDone: ["DELIVERED", "COMPLETED"],
  cancelled: ["CANCELLED", "CANCELED"],
};

const CLOSED = [...ALIASES.pickupDone, ...ALIASES.deliveryDone, ...ALIASES.cancelled];

const norm = (s) => String(s ?? "").toUpperCase();

/** Retourne la vraie valeur de statut (telle que définie par l'API) pour une étape logique */
function pickStatus(key, list) {
  const aliases = ALIASES[key];
  if (!list || list.length === 0) return aliases[0];
  for (const a of aliases) {
    const hit = list.find((s) => norm(s.value) === a);
    if (hit) return hit.value;
  }
  return null;
}

/** Colonne d'une commande selon son statut */
function columnOf(order) {
  const s = norm(order.status);
  if (ALIASES.ready.includes(s) || ALIASES.delivering.includes(s)) return "ready";
  if (ALIASES.preparing.includes(s)) return "preparing";
  return "confirmed";
}

/** Action principale unique selon le statut et le type de commande */
function getAction(order, list) {
  const s = norm(order.status);
  const isDelivery = order.fulfillment === "delivery";
  const col = columnOf(order);

  // Étape 1 : Si en attente de confirmation, action principale = Confirmer la commande
  if (s === "PENDING" || s === "RECEIVED" || s === "NEW") {
    return { next: "CONFIRMED", label: "Confirmer la commande", icon: ClipboardCheck };
  }

  // Étape 2 : Si confirmée, action = Démarrer la préparation
  if (col === "confirmed")
    return { next: pickStatus("preparing", list) || "PREPARING", label: "Démarrer la préparation", icon: ChefHat };

  // Étape 3 : Si en préparation, action = Marquer prête (pour livraison ou retrait)
  if (col === "preparing")
    return {
      next: pickStatus("ready", list) || "READY",
      label: isDelivery ? "Prête (Attente livraison)" : "Marquer prête (Retrait)",
      icon: PackageCheck,
    };

  // Étape 4 : Prête
  if (!isDelivery)
    return { next: pickStatus("pickupDone", list) || "COMPLETED", label: "Marquer récupérée", icon: CheckCircle2 };

  if (ALIASES.delivering.includes(s))
    return { next: pickStatus("deliveryDone", list) || "COMPLETED", label: "Confirmer la livraison", icon: CheckCircle2 };

  const start = pickStatus("delivering", list) || "OUT_FOR_DELIVERY";
  if (start) return { next: start, label: "Démarrer la livraison", icon: Truck };
  return { next: pickStatus("deliveryDone", list) || "COMPLETED", label: "Confirmer la livraison", icon: CheckCircle2 };
}

/** Statut de l'étape précédente (null si la commande est déjà à la première étape) */
function getPrev(order, list) {
  const s = norm(order.status);
  const col = columnOf(order);
  if (s === "CONFIRMED") return "PENDING";
  if (col === "preparing") return "CONFIRMED";
  if (col === "ready") {
    if (ALIASES.delivering.includes(s)) return "READY";
    return "PREPARING";
  }
  return null;
}

/** Libellé de l'étape précédente, pour l'infobulle du bouton « Retour » */
function prevLabelOf(order) {
  const s = norm(order.status);
  const col = columnOf(order);
  if (s === "CONFIRMED") return "En attente";
  if (col === "preparing") return "Confirmée";
  if (col === "ready") return ALIASES.delivering.includes(s) ? "Prête" : "En préparation";
  return "";
}

const COLUMNS = [
  {
    key: "confirmed",
    title: "À Confirmer / En attente",
    short: "Commandes",
    icon: ClipboardCheck,
    border: "border-orange-200",
    head: "bg-orange-50 text-orange-700 border-orange-200",
    count: "bg-orange-500 text-white",
    btn: "bg-orange-500 hover:bg-orange-600 shadow-orange-500/25",
    empty: "Aucune nouvelle commande",
  },
  {
    key: "preparing",
    title: "En préparation",
    short: "Préparation",
    icon: ChefHat,
    border: "border-amber-200",
    head: "bg-amber-50 text-amber-700 border-amber-200",
    count: "bg-amber-500 text-white",
    btn: "bg-amber-500 hover:bg-amber-600 shadow-amber-500/25",
    empty: "Rien en préparation",
  },
  {
    key: "ready",
    title: "Prêt / Livraison",
    short: "Prêt",
    icon: PackageCheck,
    border: "border-emerald-200",
    head: "bg-emerald-50 text-emerald-700 border-emerald-200",
    count: "bg-emerald-500 text-white",
    btn: "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/25",
    empty: "Aucune commande prête",
  },
];

/* ------------------------------ Attente ------------------------------ */
const waitMinutes = (createdAt, now) => {
  const t = new Date(createdAt).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((now - t) / 60000));
};
const formatWait = (m) =>
  m < 1 ? "À l'instant" : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`;
const waitTone = (m) =>
  m >= 30
    ? "bg-red-50 text-red-700 border-red-200"
    : m >= 15
    ? "bg-amber-50 text-amber-700 border-amber-200"
    : "bg-gray-50 text-gray-600 border-gray-200";

/* ------------------------------ Carte ------------------------------ */
function OrderCard({
  order,
  action,
  busy,
  printing,
  canCancel,
  canUndo,
  prevLabel,
  isNew,
  now,
  accent,
  onAdvance,
  onCancel,
  onUndo,
  onPrint,
}) {
  const [expanded, setExpanded] = useState(false);
  const isDelivery = order.fulfillment === "delivery";
  const minutes = waitMinutes(order.createdAt, now);
  const items = order.items ?? [];
  const visible = expanded ? items : items.slice(0, 4);
  const hiddenCount = items.length - visible.length;
  const ActionIcon = action.icon;

  return (
    <article
      className={`${card} p-3 space-y-2.5 transition-shadow hover:shadow-md ${
        isNew ? "ring-2 ring-orange-400" : ""
      }`}
    >
      {/* En-tête : numéro, référence, attente */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {order.dailyNumber != null && (
            <span
              className="flex items-center justify-center min-w-9 h-9 px-2.5 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 text-white font-black text-base shadow-sm"
              title={`Commande numéro ${order.dailyNumber} de la journée`}
            >
              #{order.dailyNumber}
            </span>
            
          )}
                    <p className="font-bold text-gray-900 text-sm truncate">{order.customerName}</p>

        </div>
        <span
          title={formatDate(order.createdAt)}
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-xs font-bold whitespace-nowrap ${waitTone(
            minutes
          )}`}
        >
          <Clock className="w-3 h-3" />
          {formatWait(minutes)}
        </span>
      </div>

      {/* Type + client */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${
              isDelivery
                ? "bg-blue-50 text-blue-700 border-blue-200"
                : "bg-gray-100 text-gray-700 border-gray-200"
            }`}
          >
            {isDelivery ? <Truck className="w-3 h-3" /> : <Store className="w-3 h-3" />}
            {isDelivery ? "Livraison" : "Retrait"}
          </span>

          {norm(order.status) === "PENDING" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
              À confirmer
            </span>
          )}

          {norm(order.status) === "CONFIRMED" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-orange-100 text-orange-800 border border-orange-300">
              En attente prépa
            </span>
          )}

          {norm(order.status) === "READY" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
              {isDelivery ? "Attente livreur" : "Prête pour retrait"}
            </span>
          )}

          {norm(order.status) === "OUT_FOR_DELIVERY" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-sky-100 text-sky-800 border border-sky-300">
              En livraison
            </span>
          )}

          <a
            href={`tel:${order.customerPhone}`}
            className="inline-flex items-center gap-1.5 text-orange-600 font-semibold text-xs ml-auto"
          >
            <Phone className="w-3 h-3" />
            {order.customerPhone}
          </a>
        </div>
       
        {isDelivery && (
          <p className="flex items-start gap-1.5 text-xs text-gray-600">
            <MapPin className="w-3 h-3 mt-0.5 flex-none text-gray-400" />
            <span>
              <span className="font-semibold">{order.municipalityName}</span>
              {order.address ? ` · ${order.address}` : ""}
            </span>
          </p>
        )}
      </div>

      {/* Articles */}
      <ul className="text-sm space-y-1 border-t border-gray-100 pt-2">
        {visible.map((it, i) => (
          <li key={i} className="flex justify-between gap-3">
            <span className="text-gray-900">
              <span className="font-bold">{it.quantity}×</span> {it.name}
              {it.options?.length > 0 && (
                <span className="block text-xs text-gray-500">{it.options.join(", ")}</span>
              )}
            </span>
            <span className="text-gray-700 whitespace-nowrap text-xs sm:text-sm">{formatPrice(it.total)}</span>
          </li>
        ))}
        {hiddenCount > 0 && (
          <li>
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="text-xs font-bold text-orange-600 hover:underline"
            >
              + {hiddenCount} autre{hiddenCount > 1 ? "s" : ""} article{hiddenCount > 1 ? "s" : ""}
            </button>
          </li>
        )}
      </ul>

      {order.notes && (
        <p className="text-xs rounded-xl bg-gray-50 border border-gray-200 px-2.5 py-1.5 text-gray-700">
          📝 {order.notes}
        </p>
      )}

      {/* Total */}
      <div className="flex items-center justify-between text-sm border-t border-gray-100 pt-2">
        <span className="text-xs text-gray-500">
          {order.deliveryFee > 0 ? `Livraison : ${formatPrice(order.deliveryFee)}` : ""}
        </span>
        <span className="font-extrabold text-gray-900">Total : {formatPrice(order.total)}</span>
      </div>

      {/* Action principale + retour + impression + annulation (colonne Confirmée seulement) */}
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          onClick={() => onAdvance(order)}
          disabled={busy || !action.next}
          title={!action.next ? "Statut indisponible" : undefined}
          className={`flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-extrabold text-white shadow-md transition active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed ${accent}`}
        >
          {busy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ActionIcon className="w-4 h-4" />}
          {action.label}
        </button>
        {canUndo && (
          <button
            type="button"
            onClick={() => onUndo(order)}
            disabled={busy}
            aria-label={`Remettre la commande ${order.reference} à l'étape « ${prevLabel} »`}
            title={`Revenir à l'étape précédente : ${prevLabel}`}
            className="px-3 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
          >
            <Undo2 className="w-4 h-4" />
          </button>
        )}
        <button
          type="button"
          onClick={() => onPrint(order)}
          disabled={printing}
          aria-label={`Imprimer le ticket de ${order.reference}`}
          title="Imprimer le ticket"
          className="px-3 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
        >
          {printing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
        </button>
        {canCancel && (
          <button
            type="button"
            onClick={() => onCancel(order)}
            disabled={busy}
            aria-label={`Annuler la commande ${order.reference}`}
            title="Annuler la commande"
            className="px-3 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 transition disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </article>
  );
}

export default function OrdersPanel() {
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const [actionError, setActionError] = useState("");
  const [saving, setSaving] = useState({});
  const [overrides, setOverrides] = useState({});
  const [newRefs, setNewRefs] = useState([]);
  const [notification, setNotification] = useState(null);
  const [lastAction, setLastAction] = useState(null);
  const [quickOrderOpen, setQuickOrderOpen] = useState(false);
  const [availabilityOpen, setAvailabilityOpen] = useState(false);
  const [mobileCol, setMobileCol] = useState("confirmed");
  const [now, setNow] = useState(() => Date.now());
  const [autoPrint, setAutoPrint] = useState(true);
  const [printing, setPrinting] = useState({});
  const autoPrintRef = useRef(true);
  const [autoConfirm, setAutoConfirm] = useState(true);
  const autoConfirmRef = useRef(true);
  const autoConfirmInFlight = useRef(new Set());
  const inFlight = useRef(new Set());

  // Réglage « impression auto » (activé par défaut, mémorisé sur cet appareil)
  useEffect(() => {
    const saved = loadAutoPrint();
    autoPrintRef.current = saved;
    setAutoPrint(saved);

    const savedConfirm = loadAutoConfirm();
    autoConfirmRef.current = savedConfirm;
    setAutoConfirm(savedConfirm);
  }, []);

  const toggleAutoPrint = () => {
    const next = !autoPrintRef.current;
    autoPrintRef.current = next;
    setAutoPrint(next);
    saveAutoPrint(next);
  };

  const toggleAutoConfirm = () => {
    const next = !autoConfirmRef.current;
    autoConfirmRef.current = next;
    setAutoConfirm(next);
    saveAutoConfirm(next);
  };

  // Horloge pour les temps d'attente
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      setQDebounced(q.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(id);
  }, [q]);

  // Only fetch active (non-completed, non-cancelled) orders
  const params = new URLSearchParams({ page: String(page), pageSize: "100", scope: "active" });
  if (qDebounced) params.set("q", qDebounced);
  const { items, extra, loading, error, reload } = useList(`/api/admin/orders?${params}`);

  const markNew = (reference) => {
    if (!reference) return;
    setNewRefs((s) => [...s, reference]);
    setTimeout(() => setNewRefs((s) => s.filter((r) => r !== reference)), 10000);
  };

  /** Impression manuelle d'un ticket (tous statuts) */
  const printOrder = async (order) => {
    const ref = order.reference;
    if (printing[ref]) return;
    setPrinting((p) => ({ ...p, [ref]: true }));
    setActionError("");

    const stopSpinner = () =>
      setPrinting((p) => {
        const { [ref]: _removed, ...rest } = p;
        return rest;
      });
    // Sécurité : le chargement ne reste jamais bloqué, même si l'impression est annulée
    const safety = setTimeout(stopSpinner, 4000);

    try {
      await printOrderTicket(order, { formatPrice });
    } catch (err) {
      setActionError(`Impression ${ref} : ${err.message}`);
    } finally {
      clearTimeout(safety);
      stopSpinner();
    }
  };

  /** Impression automatique d'une nouvelle commande (une seule fois par commande) */
  const printNewOrder = async (reference) => {
    if (!reference || !autoPrintRef.current || !claimPrint(reference)) return;
    try {
      // La commande complète est récupérée indépendamment des filtres de la page
      let order = null;
      for (let i = 0; i < 4 && !order; i++) {
        if (i > 0) await new Promise((r) => setTimeout(r, 800));
        const data = await api.get(`/api/admin/orders?scope=active&q=${encodeURIComponent(reference)}`);
        order = (data.items ?? []).find((o) => o.reference === reference) ?? null;
      }
      if (!order) throw new Error("commande introuvable");

      // Sécurité : pas d'impression en rafale de commandes anciennes
      const age = Date.now() - new Date(order.createdAt).getTime();
      if (age > 10 * 60 * 1000) return;

      await printOrderTicket(order, { formatPrice });
    } catch (err) {
      releasePrint(reference);
      setActionError(`Impression automatique ${reference} : ${err.message}`);
    }
  };

  // Firebase Real-time Listener for Instant Order Notifications & Sound
  const { connected } = useRealtimeAdminOrders({
    onNewOrder: (event) => {
      // Reload order list silently and immediately without requiring a page refresh
      reload(true);

      // Play audible restaurant notification chime
      playOrderChime();
      markNew(event.reference);
      printNewOrder(event.reference);
      autoConfirmOrder(event.reference);

      // Show prominent alert at the top of the page
      setNotification({
        type: "NEW_ORDER",
        reference: event.reference,
        dailyNumber: event.dailyNumber ?? null,
        customerName: event.customerName,
        total: event.total,
        at: new Date(),
      });
    },
    onStatusChange: () => {
      // Keep statuses in sync if modified in another tab or worker
      reload(true);
    },
  });

  useEffect(() => {
    if (!notification) return;

    const timer = setTimeout(() => {
      setNotification(null);
    }, 5000);

    return () => clearTimeout(timer);
  }, [notification]);

  // La barre « Revenir en arrière » disparaît après 10 secondes
  useEffect(() => {
    if (!lastAction) return;
    const timer = setTimeout(() => setLastAction(null), 10000);
    return () => clearTimeout(timer);
  }, [lastAction]);

  // Fallback background polling only if Firebase is not connected
  useEffect(() => {
    if (connected) return;
    const id = setInterval(() => reload(true), 45000);
    return () => clearInterval(id);
  }, [reload, connected]);

  const allStatuses = extra.allStatuses || extra.statuses || [];
  const pages = Math.max(1, Math.ceil((extra.total ?? 0) / (extra.pageSize ?? 20)));
  const statusLabel = (value) => allStatuses.find((s) => s.value === value)?.label ?? value;

  // Statuts optimistes (mise à jour instantanée de l'interface)
  const orders = useMemo(
    () => (items ?? []).map((o) => (overrides[o.reference] ? { ...o, status: overrides[o.reference] } : o)),
    [items, overrides]
  );

  // Répartition en 3 colonnes, les plus anciennes en premier
  const grouped = useMemo(() => {
    const g = { confirmed: [], preparing: [], ready: [] };
    for (const o of orders) {
      if (CLOSED.includes(norm(o.status))) continue;
      if (type === "delivery" && o.fulfillment !== "delivery") continue;
      if (type === "pickup" && o.fulfillment === "delivery") continue;
      g[columnOf(o)].push(o);
    }
    for (const k of Object.keys(g)) {
      g[k].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    }
    return g;
  }, [orders, type]);

  /** Applique un statut avec protection anti-doublon et retour arrière en cas d'erreur */
  const applyStatus = async (order, next, { track = true } = {}) => {
    const ref = order.reference;
    if (!next || inFlight.current.has(ref) || norm(next) === norm(order.status)) return;

    const label = statusLabel(next);
    const from = order.status;
    inFlight.current.add(ref);
    setSaving((s) => ({ ...s, [ref]: true }));
    setOverrides((o) => ({ ...o, [ref]: next }));
    setActionError("");
    try {
      await api.patch(`/api/admin/orders/${ref}`, { status: next });
      await reload(true);
      // Mémorise le changement pour proposer « Revenir en arrière » (même si la carte a quitté le tableau)
      if (track) setLastAction({ order, from, to: next, label });
    } catch (err) {
      setActionError(`${ref} → « ${label} » : ${err.message}`);
      reload(true);
    } finally {
      setOverrides((o) => {
        const { [ref]: _removed, ...rest } = o;
        return rest;
      });
      setSaving((s) => {
        const { [ref]: _removed, ...rest } = s;
        return rest;
      });
      inFlight.current.delete(ref);
    }
  };

  /** Confirmation automatique d'une commande (PENDING -> CONFIRMED) */
  const autoConfirmOrder = async (orderOrRef) => {
    if (!autoConfirmRef.current) return;
    const ref = typeof orderOrRef === "string" ? orderOrRef : orderOrRef?.reference;
    if (!ref || autoConfirmInFlight.current.has(ref) || inFlight.current.has(ref)) return;

    autoConfirmInFlight.current.add(ref);
    try {
      let order = typeof orderOrRef === "object" ? orderOrRef : (items ?? []).find((o) => o.reference === ref);
      if (!order) {
        for (let i = 0; i < 4 && !order; i++) {
          if (i > 0) await new Promise((r) => setTimeout(r, 600));
          const data = await api.get(`/api/admin/orders?scope=active&q=${encodeURIComponent(ref)}`);
          order = (data.items ?? []).find((o) => o.reference === ref) ?? null;
        }
      }

      if (order && norm(order.status) === "PENDING") {
        await applyStatus(order, "CONFIRMED", { track: false });
        console.log(`[OrdersPanel] Commande #${ref} confirmée automatiquement.`);
      }
    } catch (err) {
      console.warn(`[OrdersPanel] Erreur auto-confirmation #${ref}:`, err.message);
    } finally {
      autoConfirmInFlight.current.delete(ref);
    }
  };

  // Confirme automatiquement les commandes en attente (PENDING) dès leur apparition
  useEffect(() => {
    if (!autoConfirm || !items || !items.length) return;
    items.forEach((o) => {
      if (norm(o.status) === "PENDING" && !autoConfirmInFlight.current.has(o.reference) && !inFlight.current.has(o.reference)) {
        autoConfirmOrder(o);
      }
    });
  }, [items, autoConfirm]);

  const advance = (order) => applyStatus(order, getAction(order, allStatuses).next);

  /** Bouton « Retour » d'une carte : revient à l'étape précédente */
  const undo = (order) => applyStatus(order, getPrev(order, allStatuses));

  /** Barre « Revenir en arrière » : annule le dernier changement (y compris terminé / annulé) */
  const undoLast = () => {
    if (!lastAction) return;
    const { order, from, to } = lastAction;
    setLastAction(null);
    applyStatus({ ...order, status: to }, from, { track: false });
  };

  const cancelOrder = (order) => {
    // L'annulation n'est possible que dans la colonne « Confirmée »
    if (columnOf(order) !== "confirmed" || inFlight.current.has(order.reference)) return;
    if (!window.confirm(`Annuler la commande ${order.reference} ?`)) return;
    applyStatus(order, pickStatus("cancelled", allStatuses) ?? "CANCELLED");
  };

  return (
    <section className="space-y-3">
      {/* Notification temps réel : petit toast en haut à droite */}
      {notification && (
        <div
          role="alert"
          className="fixed top-4 right-4 z-[60] w-[calc(100vw-2rem)] max-w-xs overflow-hidden rounded-2xl bg-gradient-to-r from-orange-600 to-amber-500 text-white shadow-xl shadow-orange-500/25 ring-1 ring-orange-400/40 animate-in fade-in slide-in-from-right-6 duration-300"
        >
          <div className="flex items-start gap-3 p-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center flex-none ring-1 ring-white/30">
              <Bell className="w-4 h-4 animate-bounce" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-wider text-orange-100">
                Nouvelle commande ·{" "}
                {new Date(notification.at).toLocaleTimeString("fr-FR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
              <p className="font-extrabold text-sm truncate">
                {notification.dailyNumber ? `#${notification.dailyNumber} · ` : ""}
                <span className="font-mono">{notification.reference}</span>
              </p>
              <p className="text-xs text-orange-50 truncate">
                {notification.customerName}
                {notification.customerName && notification.total ? " · " : ""}
                {notification.total && (
                  <strong className="text-white">{formatPrice(notification.total)}</strong>
                )}
              </p>
            </div>

            <div className="flex items-center gap-0.5 flex-none">
              <button
                type="button"
                onClick={() => playOrderChime()}
                title="Rejouer le son"
                aria-label="Rejouer le son"
                className="p-1.5 rounded-lg hover:bg-white/20 transition"
              >
                <Volume2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setNotification(null)}
                aria-label="Fermer la notification"
                className="p-1.5 rounded-lg hover:bg-white/20 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Barre de temps (5 s) */}
          <div className="h-0.5 bg-white/20">
            <div
              className="h-full bg-white/80 origin-left"
              style={{ animation: "toast-progress 5s linear forwards" }}
            />
          </div>
          <style>{`@keyframes toast-progress { from { transform: scaleX(1); } to { transform: scaleX(0); } }`}</style>
        </div>
      )}

      {/* Barre « Revenir en arrière » après un changement de statut */}
      {lastAction && (
        <div
          role="status"
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] w-[calc(100vw-2rem)] max-w-sm flex items-center gap-3 rounded-2xl bg-gray-900 text-white px-4 py-2.5 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-200"
        >
          <p className="flex-1 min-w-0 text-sm truncate">
            <span className="font-bold">
              {lastAction.order.dailyNumber != null
                ? `#${lastAction.order.dailyNumber}`
                : lastAction.order.reference}
            </span>{" "}
            → {lastAction.label}
          </p>
          <button
            type="button"
            onClick={undoLast}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 hover:bg-white/25 px-3 py-1.5 text-xs font-bold transition whitespace-nowrap"
          >
            <Undo2 className="w-3.5 h-3.5" />
            Revenir en arrière
          </button>
          <button
            type="button"
            onClick={() => setLastAction(null)}
            aria-label="Fermer"
            className="p-1 rounded-lg hover:bg-white/15 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Quick Order Modal */}
      {quickOrderOpen && (
        <QuickOrderModal
          onClose={() => setQuickOrderOpen(false)}
          onOrderCreated={(newOrder) => {
            reload(true);
            playOrderChime();
            markNew(newOrder.reference);
            printNewOrder(newOrder.reference);
            setNotification({
              type: "NEW_ORDER",
              reference: newOrder.reference,
              dailyNumber: newOrder.dailyNumber,
              customerName: newOrder.customerName,
              total: newOrder.total,
              at: new Date(),
            });
          }}
        />
      )}

      {/* Availability Management Modal */}
      {availabilityOpen && (
        <AvailabilityModal onClose={() => setAvailabilityOpen(false)} />
      )}

      {/* Barre unique : état, recherche, impression auto, actions */}
      <div className="flex flex-wrap items-center gap-2">
      
        {connected ? (
          <span
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap"
            title="Synchronisation temps réel Firebase active"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </span>
        ) : (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200 whitespace-nowrap">
            <Radio className="w-3 h-3 text-gray-400" />
            Standard
          </span>
        )}

        <div className="relative flex-1 min-w-[200px] order-last sm:order-none">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            aria-label="Rechercher une commande"
            className={`${inputClass} pl-9`}
            placeholder="Nom, téléphone ou référence..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
           
        </div>

        {/* Interrupteur : impression automatique des nouvelles commandes */}
        <button
          type="button"
          role="switch"
          aria-checked={autoPrint}
          onClick={toggleAutoPrint}
          title="Imprimer automatiquement chaque nouvelle commande (ticket 88 mm)"
          className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs sm:text-sm font-semibold whitespace-nowrap transition ${
            autoPrint
              ? "bg-emerald-50 border-emerald-200 text-emerald-700"
              : "bg-white border-gray-200 text-gray-600"
          }`}
        >
          <Printer className="w-4 h-4" />
          Impression auto
          <span
            className={`relative inline-flex h-5 w-9 flex-none rounded-full transition-colors ${
              autoPrint ? "bg-emerald-500" : "bg-gray-300"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                autoPrint ? "translate-x-4" : ""
              }`}
            />
          </span>
        </button>

        {/* Interrupteur : confirmation automatique des nouvelles commandes */}
        <button
          type="button"
          role="switch"
          aria-checked={autoConfirm}
          onClick={toggleAutoConfirm}
          title="Confirmer automatiquement chaque nouvelle commande dès sa réception"
          className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs sm:text-sm font-semibold whitespace-nowrap transition ${
            autoConfirm
              ? "bg-emerald-50 border-emerald-200 text-emerald-700"
              : "bg-white border-gray-200 text-gray-600"
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          Confirmation auto
          <span
            className={`relative inline-flex h-5 w-9 flex-none rounded-full transition-colors ${
              autoConfirm ? "bg-emerald-500" : "bg-gray-300"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                autoConfirm ? "translate-x-4" : ""
              }`}
            />
          </span>
        </button>

        <button
          type="button"
          onClick={() => setAvailabilityOpen(true)}
          className={`${btnGhost} flex items-center gap-1.5 text-xs sm:text-sm whitespace-nowrap hover:border-orange-400 hover:text-orange-600`}
          title="Gérer la disponibilité des produits et options (stocks)"
        >
          <SlidersHorizontal className="w-4 h-4 text-orange-500" />
          Disponibilité
        </button>

        <button
          type="button"
          onClick={() => setQuickOrderOpen(true)}
          className={`${btnPrimary} flex items-center gap-1.5 text-xs sm:text-sm whitespace-nowrap shadow-md shadow-orange-500/25`}
        >
          <Plus className="w-4 h-4" />
          Ajouter une commande
        </button>
        <button
          type="button"
          onClick={() => reload()}
          aria-label="Actualiser"
          className={`${btnGhost} flex items-center gap-2 text-xs sm:text-sm whitespace-nowrap`}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Actualiser
        </button>
      </div>

      {error && <ErrorBox message={error} onRetry={() => reload()} />}
      {actionError && <ErrorBox message={actionError} />}
      {loading && items.length === 0 && <p className="text-gray-500">Chargement...</p>}
      {!loading && items.length === 0 && !error && (
        <div className="p-8 text-center bg-white rounded-3xl border border-gray-200 space-y-2">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
          <p className="font-extrabold text-gray-800">Aucune commande en attente !</p>
          <p className="text-xs text-gray-500">Toutes les commandes ont été traitées ou terminées.</p>
        </div>
      )}

      {items.length > 0 && (
        <>
          {/* Onglets mobile */}
          <div className="lg:hidden grid grid-cols-3 gap-1 p-1 rounded-2xl bg-gray-100">
            {COLUMNS.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setMobileCol(c.key)}
                className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition ${
                  mobileCol === c.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                }`}
              >
                {c.short}
                <span className={`min-w-5 px-1.5 rounded-full text-[11px] ${c.count}`}>
                  {grouped[c.key].length}
                </span>
              </button>
            ))}
          </div>

          {/* Tableau en 3 colonnes */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-start">
            {COLUMNS.map((col) => {
              const list = grouped[col.key];
              const ColIcon = col.icon;
              return (
                <div
                  key={col.key}
                  className={`${mobileCol === col.key ? "flex" : "hidden"} lg:flex flex-col min-w-0 rounded-2xl border bg-gray-50/70 ${col.border}`}
                >
                  <header
                    className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-t-2xl border-b ${col.head}`}
                  >
                    <span className="flex items-center gap-2 text-sm font-extrabold">
                      <ColIcon className="w-4 h-4" />
                      {col.title}
                    </span>
                    <span className={`min-w-6 px-2 py-0.5 rounded-full text-xs font-black text-center ${col.count}`}>
                      {list.length}
                    </span>
                  </header>

                  <div className="p-2.5 space-y-2.5 lg:max-h-[calc(100vh-13rem)] lg:overflow-y-auto">
                    {list.length === 0 ? (
                      <p className="py-8 text-center text-xs font-semibold text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                        {col.empty}
                      </p>
                    ) : (
                      list.map((o) => (
                        <OrderCard
                          key={o.id}
                          order={o}
                          action={getAction(o, allStatuses)}
                          busy={!!saving[o.reference]}
                          printing={!!printing[o.reference]}
                          canCancel={col.key === "confirmed"}
                          canUndo={col.key !== "confirmed" && !!getPrev(o, allStatuses)}
                          prevLabel={prevLabelOf(o)}
                          isNew={newRefs.includes(o.reference)}
                          now={now}
                          accent={col.btn}
                          onAdvance={advance}
                          onCancel={cancelOrder}
                          onUndo={undo}
                          onPrint={printOrder}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className={btnGhost}>Précédent</button>
          <span className="text-sm text-gray-600">Page {page} / {pages}</span>
          <button type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className={btnGhost}>Suivant</button>
        </div>
      )}
    </section>
  );
}