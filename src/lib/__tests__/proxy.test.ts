import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockJwtVerify, mockHeaders } = vi.hoisted(() => ({
  mockJwtVerify: vi.fn(),
  mockHeaders: { set: vi.fn() },
}));

vi.mock("jose", () => ({
  jwtVerify: mockJwtVerify,
}));

vi.mock("@/lib/api-rate-limit", () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 59 })),
}));

vi.mock("next/server", () => ({
  NextResponse: {
    next: vi.fn(() => ({ headers: mockHeaders })),
    redirect: vi.fn((url: URL) => ({ redirectUrl: url.toString(), headers: mockHeaders })),
    json: vi.fn((body: unknown, init?: ResponseInit) => ({
      body,
      status: init?.status ?? 200,
    })),
  },
}));

import { proxy } from "@/proxy";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function makeRequest(
  pathname: string,
  cookies: Record<string, string> = {},
  headers: Record<string, string> = {},
): NextRequest {
  return {
    nextUrl: {
      pathname,
    },
    url: `https://comptes.local${pathname}`,
    cookies: {
      get: vi.fn((name: string) => {
        const value = cookies[name];
        return value ? { value } : undefined;
      }),
    },
    headers: {
      get: vi.fn((name: string) => headers[name] ?? null),
    },
  } as unknown as NextRequest;
}

describe("proxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = "a-very-secret-key-that-is-at-least-32-chars";
  });

  describe("routes publiques", () => {
    it("laisse passer /login sans vérification", async () => {
      await proxy(makeRequest("/login"));
      expect(NextResponse.next).toHaveBeenCalled();
      expect(NextResponse.redirect).not.toHaveBeenCalled();
    });

    it("laisse passer /register sans vérification", async () => {
      await proxy(makeRequest("/register"));
      expect(NextResponse.next).toHaveBeenCalled();
      expect(NextResponse.redirect).not.toHaveBeenCalled();
    });

    it("laisse passer /_next/ sans vérification", async () => {
      await proxy(makeRequest("/_next/static/chunk.js"));
      expect(NextResponse.next).toHaveBeenCalled();
      expect(NextResponse.redirect).not.toHaveBeenCalled();
    });
  });

  describe("routes API", () => {
    it("laisse passer les routes /api/ avec rate limiting", async () => {
      await proxy(makeRequest("/api/transactions", {}, { "x-forwarded-for": "1.2.3.4" }));
      expect(NextResponse.next).toHaveBeenCalled();
      expect(NextResponse.redirect).not.toHaveBeenCalled();
    });
  });

  describe("routes protégées — access token valide", () => {
    it("laisse passer avec un access_token JWT valide", async () => {
      mockJwtVerify.mockResolvedValueOnce({ payload: { sub: "user_123" } });
      await proxy(makeRequest("/transactions", { access_token: "valid-jwt" }));
      expect(NextResponse.next).toHaveBeenCalled();
      expect(NextResponse.redirect).not.toHaveBeenCalled();
    });
  });

  describe("routes protégées — access token expiré", () => {
    it("redirige vers /api/auth/refresh si le JWT est expiré", async () => {
      mockJwtVerify.mockRejectedValueOnce(new Error("token expired"));
      await proxy(makeRequest("/transactions", { access_token: "expired-jwt" }));

      expect(NextResponse.redirect).toHaveBeenCalledOnce();
      const url = (NextResponse.redirect as ReturnType<typeof vi.fn>).mock.calls[0][0] as URL;
      expect(url.pathname).toBe("/api/auth/refresh");
      expect(url.searchParams.get("returnTo")).toBe("/transactions");
    });
  });

  describe("routes protégées — pas d'access token", () => {
    it("redirige vers /api/auth/refresh si refresh_token est présent", async () => {
      await proxy(makeRequest("/budgets", { refresh_token: "valid-refresh" }));

      expect(NextResponse.redirect).toHaveBeenCalledOnce();
      const url = (NextResponse.redirect as ReturnType<typeof vi.fn>).mock.calls[0][0] as URL;
      expect(url.pathname).toBe("/api/auth/refresh");
      expect(url.searchParams.get("returnTo")).toBe("/budgets");
    });

    it("redirige vers /login si aucun token n'est présent", async () => {
      await proxy(makeRequest("/transactions"));

      expect(NextResponse.redirect).toHaveBeenCalledOnce();
      const url = (NextResponse.redirect as ReturnType<typeof vi.fn>).mock.calls[0][0] as URL;
      expect(url.pathname).toBe("/login");
    });

    it("passe le pathname dans returnTo pour le refresh", async () => {
      await proxy(makeRequest("/accounts", { refresh_token: "some-token" }));

      const url = (NextResponse.redirect as ReturnType<typeof vi.fn>).mock.calls[0][0] as URL;
      expect(url.searchParams.get("returnTo")).toBe("/accounts");
    });
  });

  describe("mode dev — pas de JWT_SECRET", () => {
    it("laisse passer sans vérification si JWT_SECRET est absent", async () => {
      delete process.env.JWT_SECRET;
      await proxy(makeRequest("/transactions", { access_token: "any-token" }));
      expect(NextResponse.next).toHaveBeenCalled();
      expect(mockJwtVerify).not.toHaveBeenCalled();
    });
  });
});
