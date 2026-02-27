import { SignJWT, jwtVerify } from "jose";
import type { AuthUser } from "@/lib/types";

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters");
  }
  return new TextEncoder().encode(secret);
}

const ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRY || "15m";
const REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || "7d";

export async function signAccessToken(user: AuthUser): Promise<string> {
  return new SignJWT({ sub: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(ACCESS_EXPIRY)
    .sign(getSecret());
}

export async function signRefreshToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(REFRESH_EXPIRY)
    .sign(getSecret());
}

export type AccessTokenPayload = {
  sub: string;
  email: string;
  name: string;
  isAdmin: boolean;
  exp: number;
};

export type RefreshTokenPayload = {
  sub: string;
  exp: number;
};

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, getSecret());
  return payload as unknown as AccessTokenPayload;
}

export async function verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
  const { payload } = await jwtVerify(token, getSecret());
  return payload as unknown as RefreshTokenPayload;
}
