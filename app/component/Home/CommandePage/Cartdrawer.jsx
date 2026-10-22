"use client";
import { AlertTriangle, Loader2, Pencil, Trash2 } from "lucide-react";
import Overlay from "./Overlay";
import { Stepper, Thumb, primaryBtn } from "./UI";
import { formatPrice } from "./Logic";

export default function CartDrawer({ t, resolved, totals, catalogStatus, onClose, onQuantity, onEdit, onRemove, onConfirm, onRetry }) {
  const c = t.cart;
  const ready = catalogStatus === "ready";
  const canConfirm = ready && resolved.length > 0 && !totals.blocked;

  let body;
  if (!ready && catalogStatus === "error") {
    body = (
      <div className="py-10 text-center space-y-4" role="alert">
        <AlertTriangle className="w-8 h-8 mx-auto text-red-600" />
        <p className="text-gray-600">{c.loadError}</p>
        <button type="button" onClick={onRetry} className={primaryBtn}>
          {t.retry}
        </button>
      </div>
    );
  } else if (!ready) {
    body = (
      <p className="py-10 text-center text-gray-600 flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> {c.loading}
      </p>
    );
  } else if (resolved.length === 0) {
    body = <p className="py-10 text-center text-gray-600">{c.empty}</p>;
  } else {
    body = (
      <ul className="space-y-4">
        {resolved.map((r) => (
          <li key={r.line.key} className="rounded-2xl border border-gray-200 bg-white p-3 flex gap-3">
            <Thumb src={r.product?.image} name={r.product?.name} className="w-20 h-20 rounded-xl flex-none" />
            <div className="flex-1 min-w-0 space-y-2">
              <p className="font-bold text-gray-900">{r.product ? r.product.name : c.unknownProduct}</p>
              {r.optionNames.length > 0 && <p className="text-xs text-gray-600">{r.optionNames.join(", ")}</p>}
              {!r.ok && (
                <p role="alert" className="text-xs font-semibold text-red-600">
                  {r.reason === "missing" ? c.unknownProductHint : c.lineUnavailable}
                </p>
              )}
              <div className="flex items-center justify-between gap-2">
                <Stepper
                  value={r.line.quantity}
                  min={0}
                  t={t}
                  disabled={!r.ok}
                  onChange={(q) => onQuantity(r.line.key, q)}
                />
                {r.ok && <span className="font-extrabold text-orange-600">{formatPrice(r.total, t.currency)}</span>}
              </div>
              <div className="flex gap-4 text-xs font-semibold">
                {r.product && (
                  <button type="button" onClick={() => onEdit(r)} className="flex items-center gap-1 text-gray-600 hover:text-orange-600">
                    <Pencil className="w-3.5 h-3.5" /> {c.edit}
                  </button>
                )}
                <button type="button" onClick={() => onRemove(r.line.key)} className="flex items-center gap-1 text-gray-600 hover:text-red-600">
                  <Trash2 className="w-3.5 h-3.5" /> {c.remove}
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <Overlay
      variant="drawer"
      title={c.title}
      closeLabel={c.close}
      onClose={onClose}
      footer={
        <div className="space-y-3">
          <div className="flex justify-between text-sm text-gray-600">
            <span>{c.subtotal}</span>
            <span>{ready ? formatPrice(totals.subtotal, t.currency) : "—"}</span>
          </div>
          <div className="flex justify-between text-lg font-extrabold text-gray-900">
            <span>{c.total}</span>
            <span>{ready ? formatPrice(totals.subtotal, t.currency) : "—"}</span>
          </div>
          <p className="text-xs text-gray-500">{c.deliveryNote}</p>
          {ready && totals.blocked && (
            <p role="alert" className="text-xs font-semibold text-red-600">
              {c.blocked}
            </p>
          )}
          <button type="button" disabled={!canConfirm} onClick={onConfirm} className={`w-full ${primaryBtn}`}>
            {c.confirm}
          </button>
        </div>
      }
    >
      {body}
    </Overlay>
  );
}