import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { checkRateLimit } from "@/lib/api-rate-limit";
import { jwtVerify } from "jose";

const PUBLIC_PATHS = ["/login", "/register"];

function getJwtSecret(): Uint8Array | null {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) return null;
  return new TextEncoder().encode(secret);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Security headers sur toutes les réponses
  const addSecurityHeaders = (response: NextResponse) => {
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set("X-XSS-Protection", "1; mode=block");
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    return response;
  };

  // Routes statiques Next.js — pas de vérification auth
  if (pathname.startsWith("/_next/") || pathname === "/favicon.ico") {
    return addSecurityHeaders(NextResponse.next());
  }

  // Routes API — rate limiting (auth Bearer gérée dans les routes)
  if (pathname.startsWith("/api/")) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? request.headers.get("x-real-ip")
      ?? "unknown";

    const { allowed, remaining } = checkRateLimit(ip);
    const response = NextResponse.next();
    response.headers.set("X-RateLimit-Remaining", remaining.toString());

    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": "60", "X-RateLimit-Remaining": "0" } }
      );
    }

    return addSecurityHeaders(response);
  }

  // Routes publiques (login, register) — pas de vérification auth
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return addSecurityHeaders(NextResponse.next());
  }

  // Routes protégées — vérifier le cookie access_token
  const accessToken = request.cookies.get("access_token")?.value;

  if (!accessToken) {
    // Pas de token → redirect vers login
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Vérifier le JWT (jose fonctionne en Edge)
  const secret = getJwtSecret();
  if (!secret) {
    // Pas de secret configuré — laisser passer (mode dev)
    return addSecurityHeaders(NextResponse.next());
  }

  try {
    await jwtVerify(accessToken, secret);
    return addSecurityHeaders(NextResponse.next());
  } catch {
    // Token expiré → essayer le refresh
    const refreshUrl = new URL("/api/auth/refresh", request.url);
    refreshUrl.searchParams.set("returnTo", pathname);
    return NextResponse.redirect(refreshUrl);
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
