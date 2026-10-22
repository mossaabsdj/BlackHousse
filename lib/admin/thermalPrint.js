/**
 * Impression de tickets sur imprimante thermique 88 mm (via le navigateur).
 * Fichier : lib/admin/thermalPrint.js
 */

const PRINTED_KEY = "blackhousse:printedOrders";
const AUTO_KEY = "blackhousse:autoPrint";
const MAX_PRINTED = 300;

/* ----------------------- Réglage « impression auto » ----------------------- */
export function loadAutoPrint() {
  try {
    return localStorage.getItem(AUTO_KEY) !== "0"; // activé par défaut
  } catch {
    return true;
  }
}

export function saveAutoPrint(on) {
  try {
    localStorage.setItem(AUTO_KEY, on ? "1" : "0");
  } catch {}
}

/* ----------------------------- Anti-doublon ----------------------------- */
function readPrinted() {
  try {
    const raw = JSON.parse(localStorage.getItem(PRINTED_KEY) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function writePrinted(list) {
  try {
    localStorage.setItem(PRINTED_KEY, JSON.stringify(list.slice(-MAX_PRINTED)));
  } catch {}
}

/** Réserve l'impression d'une commande. Retourne false si elle a déjà été imprimée. */
export function claimPrint(reference) {
  const list = readPrinted();
  if (list.includes(reference)) return false;
  list.push(reference);
  writePrinted(list);
  return true;
}

/** Annule la réservation (en cas d'échec) pour permettre une nouvelle tentative. */
export function releasePrint(reference) {
  writePrinted(readPrinted().filter((r) => r !== reference));
}

/* ------------------------------- Ticket HTML ------------------------------ */
const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const defaultPrice = (n) => `${Number(n || 0).toLocaleString("fr-FR")} DA`;

export function buildTicketHtml(order, options = {}) {
  const {
    storeName = "BlackHousse",
    paperWidthMm = 88,
    formatPrice = defaultPrice,
    footer = "Merci pour votre commande !",
  } = options;

  const isDelivery = order.fulfillment === "delivery";
  const d = new Date(order.createdAt);
  const dateText = Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

  const items = (order.items ?? [])
    .map(
      (it) => `
      <div class="row">
        <span class="q">${esc(it.quantity)}x</span>
        <span class="n">${esc(it.name)}${
        it.options?.length ? `<div class="opt">${esc(it.options.join(", "))}</div>` : ""
      }</span>
        <span class="p">${esc(formatPrice(it.total))}</span>
      </div>`
    )
    .join("");

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>Ticket ${esc(order.reference)}</title>
<style>
  @page { size: ${paperWidthMm}mm auto; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body {
    width: ${paperWidthMm}mm;
    padding: 3mm 4mm 6mm;
    font-family: "Courier New", ui-monospace, monospace;
    font-size: 13px;
    line-height: 1.3;
    color: #000;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .c { text-align: center; }
  .b { font-weight: 700; }
  h1 { font-size: 20px; margin: 0 0 2px; letter-spacing: 1px; }
  .num { font-size: 28px; font-weight: 800; margin: 2px 0; }
  .type { display: inline-block; border: 2px solid #000; padding: 1px 10px; font-weight: 800; font-size: 15px; }
  .sep { border-top: 1px dashed #000; margin: 6px 0; }
  .row { display: flex; gap: 6px; align-items: flex-start; margin: 2px 0; }
  .q { flex: none; min-width: 28px; font-weight: 700; }
  .n { flex: 1; word-break: break-word; }
  .p { flex: none; white-space: nowrap; }
  .opt { font-size: 11px; }
  .line { display: flex; justify-content: space-between; gap: 8px; }
  .tot { font-size: 18px; font-weight: 800; }
  .small { font-size: 11px; }
  .notes { border: 1px solid #000; padding: 3px 5px; margin-top: 4px; word-break: break-word; }
</style>
</head>
<body>
  <div class="c">
    <h1>${esc(storeName)}</h1>
    <div class="small">${esc(dateText)}</div>
    ${order.dailyNumber != null ? `<div class="num">#${esc(order.dailyNumber)}</div>` : ""}
    <div class="small">${esc(order.reference)}</div>
    <div style="margin-top:4px"><span class="type">${isDelivery ? "LIVRAISON" : "RETRAIT"}</span></div>
  </div>

  <div class="sep"></div>
  <div class="b">${esc(order.customerName)}</div>
  <div>${esc(order.customerPhone)}</div>
  ${
    isDelivery
      ? `<div>${esc(order.municipalityName)}${order.address ? " - " + esc(order.address) : ""}</div>`
      : ""
  }

  <div class="sep"></div>
  ${items}
  ${order.notes ? `<div class="notes">Note : ${esc(order.notes)}</div>` : ""}

  <div class="sep"></div>
  ${
    order.deliveryFee > 0
      ? `<div class="line"><span>Livraison</span><span>${esc(formatPrice(order.deliveryFee))}</span></div>`
      : ""
  }
  <div class="line tot"><span>TOTAL</span><span>${esc(formatPrice(order.total))}</span></div>

  <div class="sep"></div>
  <div class="c small">${esc(footer)}</div>
  <div style="height:8mm"></div>
</body>
</html>`;
}

/* ------------------------------ Impression ------------------------------ */
function printHtml(html) {
  return new Promise((resolve, reject) => {
    if (typeof document === "undefined") {
      reject(new Error("Impression indisponible (côté serveur)"));
      return;
    }

    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.cssText =
      "position:fixed;left:-9999px;top:0;width:88mm;height:100px;border:0;opacity:0;pointer-events:none";

    let finished = false;
    const finish = (err) => {
      if (finished) return;
      finished = true;
      setTimeout(() => iframe.remove(), 1000);
      err ? reject(err) : resolve();
    };

    iframe.onload = () => {
      try {
        const win = iframe.contentWindow;
        win.focus();
        win.onafterprint = () => finish();
        win.print(); // bloquant sous Chrome tant que la boîte d'impression est ouverte
        setTimeout(() => finish(), 1500);
      } catch (err) {
        finish(err);
      }
    };

    iframe.srcdoc = html;
    document.body.appendChild(iframe);
    setTimeout(() => finish(new Error("Délai d'impression dépassé")), 60000);
  });
}

// File d'attente : un ticket à la fois, dans l'ordre d'arrivée
let queue = Promise.resolve();

/**
 * Imprime le ticket d'une commande.
 * options : { storeName, paperWidthMm (défaut 88), formatPrice, footer }
 */
export function printOrderTicket(order, options = {}) {
  const run = () => printHtml(buildTicketHtml(order, options));
  const task = queue.then(run, run);
  queue = task.catch(() => {});
  return task;
}