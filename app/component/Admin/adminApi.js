"use client";
import { useCallback, useEffect, useRef, useState } from "react";

async function call(method, url, body) {
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw Object.assign(new Error("Connexion impossible. Vérifiez votre réseau."), { status: 0 });
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) {
    throw Object.assign(new Error(data?.message || "Une erreur est survenue."), {
      status: res.status,
      code: data?.code,
      fields: data?.fields,
    });
  }
  return data;
}

export const api = {
  get: (url) => call("GET", url),
  post: (url, body) => call("POST", url, body),
  put: (url, body) => call("PUT", url, body),
  patch: (url, body) => call("PATCH", url, body),
  del: (url) => call("DELETE", url),
};

/** Loads a list endpoint ({ items, ...extra }). reload(true) refreshes silently (no spinner). */
export function useList(url) {
  const [state, setState] = useState({ items: [], extra: {}, loading: true, error: null });
  const alive = useRef(true);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const d = await api.get(url);
        if (alive.current) setState({ items: d.items ?? [], extra: d, loading: false, error: null });
      } catch (e) {
        if (alive.current) setState((s) => ({ ...s, loading: false, error: e.message || "Erreur" }));
      }
    },
    [url]
  );

  useEffect(() => {
    alive.current = true;
    load();
    return () => {
      alive.current = false;
    };
  }, [load]);

  return { ...state, reload: load };
}

export const formatPrice = (n) => `${new Intl.NumberFormat("fr-FR").format(Number(n) || 0)} DA`;
export const formatDate = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
};