import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db, users, refreshTokens } from "@/lib/db";
import { eq } from "drizzle-orm";
import { verifyRefreshToken, signAccessToken } from "@/lib/auth/jwt";
import { hashToken } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const returnTo = request.nextUrl.searchParams.get("returnTo") || "/";

  try {
    const cookieStore = await cookies();
    const refreshTokenValue = cookieStore.get("refresh_token")?.value;

    if (!refreshTokenValue) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    // Vérifier le JWT du refresh token
    const payload = await verifyRefreshToken(refreshTokenValue);

    // Vérifier que le token hashé existe en BDD
    const tokenHash = hashToken(refreshTokenValue);
    const storedToken = await db.query.refreshTokens.findFirst({
      where: eq(refreshTokens.tokenHash, tokenHash),
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      cookieStore.delete("access_token");
      cookieStore.delete("refresh_token");
      return NextResponse.redirect(new URL("/login", request.url));
    }

    // Récupérer l'utilisateur
    const user = await db.query.users.findFirst({
      where: eq(users.id, payload.sub),
    });

    if (!user) {
      cookieStore.delete("access_token");
      cookieStore.delete("refresh_token");
      return NextResponse.redirect(new URL("/login", request.url));
    }

    // Signer un nouveau access token
    const accessToken = await signAccessToken({
      id: user.id,
      email: user.email,
      name: user.name,
      isAdmin: user.isAdmin,
    });

    // Set le nouveau cookie et redirect
    const response = NextResponse.redirect(new URL(returnTo, request.url));
    response.cookies.set("access_token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 15 * 60,
    });

    return response;
  } catch {
    return NextResponse.redirect(new URL("/login", request.url));
  }
}
