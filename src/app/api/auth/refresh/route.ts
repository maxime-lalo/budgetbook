import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db, users, refreshTokens } from "@/lib/db";
import { eq } from "drizzle-orm";
import { verifyRefreshToken, signAccessToken, signRefreshToken } from "@/lib/auth/jwt";
import { hashToken } from "@/lib/api-auth";
import { createId } from "@paralleldrive/cuid2";

const REFRESH_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

function getBaseUrl(request: NextRequest): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost) {
    const proto = request.headers.get("x-forwarded-proto") || "https";
    return `${proto}://${forwardedHost}`;
  }
  return request.url;
}

export async function GET(request: NextRequest) {
  const returnTo = request.nextUrl.searchParams.get("returnTo") || "/";
  const baseUrl = getBaseUrl(request);

  try {
    const cookieStore = await cookies();
    const refreshTokenValue = cookieStore.get("refresh_token")?.value;

    if (!refreshTokenValue) {
      return NextResponse.redirect(new URL("/login", baseUrl));
    }

    // Vérifier le JWT du refresh token
    const payload = await verifyRefreshToken(refreshTokenValue);

    // Vérifier que le token hashé existe en BDD
    const oldTokenHash = hashToken(refreshTokenValue);
    const storedToken = await db.query.refreshTokens.findFirst({
      where: eq(refreshTokens.tokenHash, oldTokenHash),
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      cookieStore.delete("access_token");
      cookieStore.delete("refresh_token");
      return NextResponse.redirect(new URL("/login", baseUrl));
    }

    // Récupérer l'utilisateur
    const user = await db.query.users.findFirst({
      where: eq(users.id, payload.sub),
    });

    if (!user) {
      cookieStore.delete("access_token");
      cookieStore.delete("refresh_token");
      return NextResponse.redirect(new URL("/login", baseUrl));
    }

    // Signer un nouveau access token
    const accessToken = await signAccessToken({
      id: user.id,
      email: user.email,
      name: user.name,
      isAdmin: user.isAdmin,
    });

    // Rolling refresh : nouveau refresh token + invalidation de l'ancien
    const newRefreshTokenValue = await signRefreshToken(user.id);
    const newTokenHash = hashToken(newRefreshTokenValue);

    await db.delete(refreshTokens).where(eq(refreshTokens.tokenHash, oldTokenHash));
    await db.insert(refreshTokens).values({
      id: createId(),
      userId: user.id,
      tokenHash: newTokenHash,
      expiresAt: new Date(Date.now() + REFRESH_MAX_AGE * 1000),
    });

    // Set les nouveaux cookies et redirect
    const response = NextResponse.redirect(new URL(returnTo, baseUrl));
    response.cookies.set("access_token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 15 * 60,
    });
    response.cookies.set("refresh_token", newRefreshTokenValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: REFRESH_MAX_AGE,
    });

    return response;
  } catch {
    return NextResponse.redirect(new URL("/login", baseUrl));
  }
}
