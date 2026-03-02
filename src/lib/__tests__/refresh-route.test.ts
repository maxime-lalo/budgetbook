import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks hoistés ---

const {
  mockCookieStore,
  mockFindFirstRefreshTokens,
  mockFindFirstUsers,
  mockDeleteWhere,
  mockInsertValues,
  mockVerifyRefreshToken,
  mockSignAccessToken,
  mockSignRefreshToken,
  mockResponseCookies,
} = vi.hoisted(() => ({
  mockCookieStore: {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  },
  mockFindFirstRefreshTokens: vi.fn(),
  mockFindFirstUsers: vi.fn(),
  mockDeleteWhere: vi.fn().mockResolvedValue(undefined),
  mockInsertValues: vi.fn().mockResolvedValue(undefined),
  mockVerifyRefreshToken: vi.fn(),
  mockSignAccessToken: vi.fn(),
  mockSignRefreshToken: vi.fn(),
  mockResponseCookies: {
    set: vi.fn(),
  },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      refreshTokens: { findFirst: mockFindFirstRefreshTokens },
      users: { findFirst: mockFindFirstUsers },
    },
    delete: vi.fn(() => ({ where: mockDeleteWhere })),
    insert: vi.fn(() => ({ values: mockInsertValues })),
  },
  users: { id: "users.id" },
  refreshTokens: { tokenHash: "refreshTokens.tokenHash" },
}));

vi.mock("@/lib/auth/jwt", () => ({
  verifyRefreshToken: mockVerifyRefreshToken,
  signAccessToken: mockSignAccessToken,
  signRefreshToken: mockSignRefreshToken,
}));

vi.mock("@/lib/api-auth", () => ({
  hashToken: vi.fn((token: string) => `hash_${token}`),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ field: a, value: b })),
}));

vi.mock("next/server", () => ({
  NextRequest: class {
    url: string;
    nextUrl: { searchParams: URLSearchParams };
    headers: Map<string, string>;
    constructor(url: string) {
      this.url = url;
      this.nextUrl = { searchParams: new URL(url).searchParams };
      this.headers = new Map();
    }
  },
  NextResponse: {
    redirect: vi.fn((url: URL) => ({
      redirectUrl: url.toString(),
      cookies: mockResponseCookies,
    })),
  },
}));

import { GET } from "@/app/api/auth/refresh/route";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const BASE_URL = "https://comptes.local";

function makeRequest(returnTo = "/"): NextRequest {
  return new NextRequest(`${BASE_URL}/api/auth/refresh?returnTo=${returnTo}`);
}

const VALID_USER = {
  id: "user_123",
  email: "test@comptes.local",
  name: "Test User",
  isAdmin: false,
};

const VALID_STORED_TOKEN = {
  tokenHash: "hash_valid-refresh-token",
  userId: "user_123",
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 jours dans le futur
};

function setupSuccessfulRefresh() {
  mockCookieStore.get.mockImplementation((name: string) => {
    if (name === "refresh_token") return { value: "valid-refresh-token" };
    return undefined;
  });
  mockVerifyRefreshToken.mockResolvedValue({ sub: "user_123", exp: Date.now() / 1000 + 604800 });
  mockFindFirstRefreshTokens.mockResolvedValue(VALID_STORED_TOKEN);
  mockFindFirstUsers.mockResolvedValue(VALID_USER);
  mockSignAccessToken.mockResolvedValue("new-access-token");
  mockSignRefreshToken.mockResolvedValue("new-refresh-token");
}

describe("GET /api/auth/refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResponseCookies.set.mockClear();
  });

  // --- Cas d'échec ---

  describe("échecs → redirect /login", () => {
    it("redirige vers /login si le cookie refresh_token est absent", async () => {
      mockCookieStore.get.mockReturnValue(undefined);

      await GET(makeRequest());

      expect(NextResponse.redirect).toHaveBeenCalledOnce();
      const url = (NextResponse.redirect as ReturnType<typeof vi.fn>).mock.calls[0][0] as URL;
      expect(url.pathname).toBe("/login");
    });

    it("redirige vers /login si le JWT du refresh token est invalide", async () => {
      mockCookieStore.get.mockImplementation((name: string) => {
        if (name === "refresh_token") return { value: "invalid-jwt" };
        return undefined;
      });
      mockVerifyRefreshToken.mockRejectedValue(new Error("invalid token"));

      await GET(makeRequest());

      const url = (NextResponse.redirect as ReturnType<typeof vi.fn>).mock.calls[0][0] as URL;
      expect(url.pathname).toBe("/login");
    });

    it("redirige vers /login si le token hashé n'existe pas en BDD", async () => {
      mockCookieStore.get.mockImplementation((name: string) => {
        if (name === "refresh_token") return { value: "orphan-token" };
        return undefined;
      });
      mockVerifyRefreshToken.mockResolvedValue({ sub: "user_123" });
      mockFindFirstRefreshTokens.mockResolvedValue(undefined);

      await GET(makeRequest());

      const url = (NextResponse.redirect as ReturnType<typeof vi.fn>).mock.calls[0][0] as URL;
      expect(url.pathname).toBe("/login");
      expect(mockCookieStore.delete).toHaveBeenCalledWith("access_token");
      expect(mockCookieStore.delete).toHaveBeenCalledWith("refresh_token");
    });

    it("redirige vers /login si le token en BDD est expiré", async () => {
      mockCookieStore.get.mockImplementation((name: string) => {
        if (name === "refresh_token") return { value: "expired-db-token" };
        return undefined;
      });
      mockVerifyRefreshToken.mockResolvedValue({ sub: "user_123" });
      mockFindFirstRefreshTokens.mockResolvedValue({
        ...VALID_STORED_TOKEN,
        expiresAt: new Date(Date.now() - 1000), // expiré
      });

      await GET(makeRequest());

      const url = (NextResponse.redirect as ReturnType<typeof vi.fn>).mock.calls[0][0] as URL;
      expect(url.pathname).toBe("/login");
    });

    it("redirige vers /login si l'utilisateur n'existe plus en BDD", async () => {
      mockCookieStore.get.mockImplementation((name: string) => {
        if (name === "refresh_token") return { value: "valid-refresh-token" };
        return undefined;
      });
      mockVerifyRefreshToken.mockResolvedValue({ sub: "deleted-user" });
      mockFindFirstRefreshTokens.mockResolvedValue(VALID_STORED_TOKEN);
      mockFindFirstUsers.mockResolvedValue(undefined);

      await GET(makeRequest());

      const url = (NextResponse.redirect as ReturnType<typeof vi.fn>).mock.calls[0][0] as URL;
      expect(url.pathname).toBe("/login");
      expect(mockCookieStore.delete).toHaveBeenCalledWith("access_token");
      expect(mockCookieStore.delete).toHaveBeenCalledWith("refresh_token");
    });
  });

  // --- Cas de succès ---

  describe("succès → rolling refresh", () => {
    it("redirige vers returnTo avec les nouveaux tokens", async () => {
      setupSuccessfulRefresh();

      await GET(makeRequest("/transactions"));

      expect(NextResponse.redirect).toHaveBeenCalledOnce();
      const url = (NextResponse.redirect as ReturnType<typeof vi.fn>).mock.calls[0][0] as URL;
      expect(url.pathname).toBe("/transactions");
    });

    it("redirige vers / si returnTo est absent", async () => {
      setupSuccessfulRefresh();

      const request = new NextRequest(`${BASE_URL}/api/auth/refresh`);
      await GET(request);

      const url = (NextResponse.redirect as ReturnType<typeof vi.fn>).mock.calls[0][0] as URL;
      expect(url.pathname).toBe("/");
    });

    it("signe un nouveau access token avec les infos utilisateur", async () => {
      setupSuccessfulRefresh();

      await GET(makeRequest());

      expect(mockSignAccessToken).toHaveBeenCalledWith({
        id: VALID_USER.id,
        email: VALID_USER.email,
        name: VALID_USER.name,
        isAdmin: VALID_USER.isAdmin,
      });
    });

    it("signe un nouveau refresh token (rolling)", async () => {
      setupSuccessfulRefresh();

      await GET(makeRequest());

      expect(mockSignRefreshToken).toHaveBeenCalledWith(VALID_USER.id);
    });

    it("supprime l'ancien refresh token en BDD", async () => {
      setupSuccessfulRefresh();

      await GET(makeRequest());

      expect(db.delete).toHaveBeenCalled();
      expect(mockDeleteWhere).toHaveBeenCalled();
    });

    it("insère le nouveau refresh token en BDD avec une expiration de 7 jours", async () => {
      setupSuccessfulRefresh();
      const beforeCall = Date.now();

      await GET(makeRequest());

      expect(db.insert).toHaveBeenCalled();
      expect(mockInsertValues).toHaveBeenCalledOnce();

      const insertedData = mockInsertValues.mock.calls[0][0];
      expect(insertedData.userId).toBe(VALID_USER.id);
      expect(insertedData.tokenHash).toBe("hash_new-refresh-token");

      // Vérifier que l'expiration est ~7 jours dans le futur
      const expiresAt = insertedData.expiresAt as Date;
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      expect(expiresAt.getTime()).toBeGreaterThanOrEqual(beforeCall + sevenDaysMs - 1000);
      expect(expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + sevenDaysMs + 1000);
    });

    it("set le cookie access_token avec maxAge 15 minutes", async () => {
      setupSuccessfulRefresh();

      await GET(makeRequest());

      expect(mockResponseCookies.set).toHaveBeenCalledWith(
        "access_token",
        "new-access-token",
        expect.objectContaining({
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          maxAge: 15 * 60,
        }),
      );
    });

    it("set le cookie refresh_token avec maxAge 7 jours", async () => {
      setupSuccessfulRefresh();

      await GET(makeRequest());

      expect(mockResponseCookies.set).toHaveBeenCalledWith(
        "refresh_token",
        "new-refresh-token",
        expect.objectContaining({
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          maxAge: 7 * 24 * 60 * 60,
        }),
      );
    });
  });
});
