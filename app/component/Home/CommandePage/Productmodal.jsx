"use client";
import { useMemo, useState } from "react";
import Overlay from "./Overlay";
import { Stepper, primaryBtn } from "./UI";
import {
  cleanSelection,
  defaultSelection,
  fmt,
  formatPrice,
  groupHint,
  missingGroups,
  sanitizeSelection,
  unitPriceOf,
} from "./Logic";

/** Image with a gradient + initial fallback (outside the component so it keeps its own state) */
function Thumb2({ src, name, className = "" }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div
        aria-hidden="true"
        className={`flex items-center justify-center bg-gradient-to-br from-orange-100 to-gray-200 text-orange-600 font-extrabold text-2xl ${className}`}
      >
        {(name || "?").trim().charAt(0).toUpperCase()}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
<></>  );
}

export default function ProductModal({ product, mode = "add", initialSelection, initialQuantity = 1, level = 0, t, onClose, onSubmit }) {
  const p = t.product;
  const [selection, setSelection] = useState(() =>
    initialSelection ? sanitizeSelection(product, initialSelection) : defaultSelection(product)
  );
  const [quantity, setQuantity] = useState(initialQuantity);
  const [showErrors, setShowErrors] = useState(false);

  const missing = useMemo(() => missingGroups(product, selection), [product, selection]);
  const missingIds = new Set(missing.map((g) => g.id));
  const total = unitPriceOf(product, selection) * quantity;

  const toggle = (g, o) => {
    if (!o.available) return;
    setSelection((prev) => {
      const cur = prev[g.id] || [];
      let next = cur;
      if (g.type === "single") next = cur[0] === o.id ? (g.required ? cur : []) : [o.id];
      else if (cur.includes(o.id)) next = cur.filter((x) => x !== o.id);
      else if (cur.length < g.max) next = [...cur, o.id];
      return { ...prev, [g.id]: next };
    });
  };

  const submit = () => {
    if (missing.length) return setShowErrors(true);
    onSubmit(cleanSelection(selection), quantity);
  };

  return (
    <Overlay
      title={product.name}
      closeLabel={p.close}
      onClose={onClose}
      level={level}
      footer={
        <div>
          <div className="flex items-center gap-4">
            <Stepper value={quantity} onChange={setQuantity} t={t} />
            <button type="button" onClick={submit} className={`flex-1 ${primaryBtn}`}>
              {mode === "edit" ? p.updateLine : p.addToCart} · {formatPrice(total, t.currency)}
            </button>
          </div>
          {showErrors && missing.length > 0 && (
            <p role="alert" className="mt-3 text-sm font-semibold text-red-600">
              {fmt(p.missing, { groups: missing.map((g) => g.name).join(", ") })}
            </p>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        {product.image && <Thumb2 src={product.image} name={product.name} className="w-full h-48 rounded-2xl" />}
        {product.description && <p className="text-gray-600 text-sm">{product.description}</p>}

        {product.optionGroups.map((g) => {
          const chosen = selection[g.id] || [];
          const multi = g.type === "multiple";
          const invalid = showErrors && missingIds.has(g.id);
          return (
            <fieldset key={g.id} className="space-y-2">
              <legend className="w-full flex items-center justify-between gap-3 mb-2">
                <span className="font-bold text-gray-900">{g.name}</span>
                <span className={`text-xs font-semibold ${invalid ? "text-red-600" : "text-gray-500"}`}>
                  {groupHint(g, t)}
                </span>
              </legend>

              {/* Options in a horizontal, wrapping row */}
              <div className="flex flex-wrap gap-2">
                {g.options.map((o) => {
                  const checked = chosen.includes(o.id);
                  const disabled = !o.available || (multi && !checked && chosen.length >= g.max);
                  return (
                    <label
                      key={o.id}
                      className={`flex items-center gap-2 rounded-2xl border px-4 py-2.5 transition ${
                        checked ? "border-orange-500 bg-orange-50" : "border-gray-200 bg-white hover:border-orange-300"
                      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                    >
                      <input
                        type={multi ? "checkbox" : "radio"}
                        name={g.id}
                        checked={checked}
                        disabled={disabled}
                        onChange={() => {}}
                        onClick={() => toggle(g, o)}
                        className="w-4 h-4 accent-orange-500"
                      />
                      <span className="text-sm font-semibold text-gray-900">
                        {o.name}
                        {!o.available && <span className="font-normal text-gray-500"> ({t.unavailable})</span>}
                      </span>
                      {o.price > 0 && (
                        <span className="text-sm text-gray-600">+ {formatPrice(o.price, t.currency)}</span>
                      )}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          );
        })}
      </div>
    </Overlay>
  );
}