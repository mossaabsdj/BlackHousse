import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAdmin } from "./auth";

export class HttpError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export const json = (body, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Tiny validator. spec = { key: { type: "string"|"int"|"bool"|"enum"|"url", min, max, values,
 *                                  required = true, nullable = false, default } }
 * partial = true -> only validates keys that are present (PATCH).
 */
export function parse(body, spec, { partial = false } = {}) {
  const out = {};
  const fields = {};
  for (const [key, s] of Object.entries(spec)) {
    const val = body?.[key];
    if (val === undefined) {
      if (partial) continue;
      if (s.default !== undefined) out[key] = s.default;
      else if (s.nullable) out[key] = null;
      else if (s.required !== false) fields[key] = "required";
      continue;
    }
    if (val === null || val === "") {
      if (s.nullable) out[key] = null;
      else fields[key] = "required";
      continue;
    }
    switch (s.type) {
      case "string": {
        const str = typeof val === "string" ? val.trim() : "";
        if (str.length < (s.min ?? 1) || str.length > (s.max ?? 200)) fields[key] = "invalid";
        else out[key] = str;
        break;
      }
      case "url": {
        const str = typeof val === "string" ? val.trim() : "";
        if (str.length > 500 || !/^(https?:\/\/|\/)\S+$/.test(str)) fields[key] = "invalid";
        else out[key] = str;
        break;
      }
      case "int": {
        const n = typeof val === "number" || typeof val === "string" ? Number(val) : NaN;
        if (!Number.isInteger(n) || n < (s.min ?? 0) || n > (s.max ?? 10_000_000)) fields[key] = "invalid";
        else out[key] = n;
        break;
      }
      case "bool":
        if (typeof val !== "boolean") fields[key] = "invalid";
        else out[key] = val;
        break;
      case "enum":
        if (!s.values.includes(val)) fields[key] = "invalid";
        else out[key] = val;
        break;
    }
  }
  if (Object.keys(fields).length) throw new HttpError(422, "VALIDATION_ERROR", "Données invalides", fields);
  return out;
}

async function readBody(request) {
  const raw = await request.text();
  if (raw.length > 200_000) throw new HttpError(413, "PAYLOAD_TOO_LARGE", "Requête trop volumineuse");
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    throw new HttpError(400, "INVALID_JSON", "JSON invalide");
  }
}

// Extra CSRF defence on top of SameSite cookies: refuse cross-site browser requests.
function sameOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? new URL(request.url).host;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function handleError(e) {
  if (e instanceof HttpError) return json({ code: e.code, message: e.message, ...(e.fields ? { fields: e.fields } : {}) }, e.status);
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2025") return json({ code: "NOT_FOUND", message: "Élément introuvable" }, 404);
    if (e.code === "P2002") return json({ code: "DUPLICATE", message: "Cette valeur existe déjà" }, 409);
    if (e.code === "P2003") return json({ code: "IN_USE", message: "Cet élément est utilisé ailleurs" }, 409);
  }
  console.error("[admin] unexpected error", e);
  return json({ code: "SERVER_ERROR", message: "Erreur serveur" }, 500);
}

/** Wraps a route handler: admin check, origin check, JSON body, params and error mapping. */
export const admin = (handler) => async (request, context) => {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) {
      return json(
        auth.status === 401
          ? { code: "UNAUTHENTICATED", message: "Connexion requise" }
          : { code: "FORBIDDEN", message: "Accès réservé aux administrateurs" },
        auth.status
      );
    }
    const method = request.method;
    if (method !== "GET" && method !== "HEAD" && !sameOrigin(request)) throw new HttpError(403, "BAD_ORIGIN", "Origine non autorisée");
    const body = ["POST", "PUT", "PATCH"].includes(method) ? await readBody(request) : undefined;
    const params = (await context?.params) ?? {};
    return await handler({ request, params, body, token: auth.token });
  } catch (e) {
    return handleError(e);
  }
};