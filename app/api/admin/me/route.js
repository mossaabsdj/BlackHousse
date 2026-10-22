
import { admin, json } from "@/lib/admin/http";

export const dynamic = "force-dynamic";

export const GET = admin(async ({ token }) =>
  json({
    id: token.id ?? null,
    email: token.email ?? null,
    role: token.role ?? null,
  })
);
