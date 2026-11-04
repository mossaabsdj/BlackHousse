export function getClientIp(request: Request): string {
  const forwarded =
    request.headers.get("x-vercel-forwarded-for") ||
    request.headers.get("x-forwarded-for") ||
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip");

  const ip = forwarded?.split(",")[0]?.trim();

  if (ip) return ip;

  // Local development / direct connection fallback
  return "127.0.0.1";
}
