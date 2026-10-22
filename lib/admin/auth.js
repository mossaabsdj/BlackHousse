
import { getToken } from "next-auth/jwt";

export async function requireAdmin(request) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    return { ok: false, status: 401 };
  }

  if (token.role !== "ADMIN") {
    return { ok: false, status: 403 };
  }

  return {
    ok: true,
    token,
  };
}
