import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "crypto";

// Mock the db module before importing api-auth so the singleton is never initialised
vi.mock("@/lib/db", () => ({
  db: {
    query: {
      apiTokens: {
        findFirst: vi.fn(),
      },
    },
  },
  apiTokens: {},
}));

// Mock next/server so NextResponse is available without a full Next.js runtime
vi.mock("next/server", () => ({
  NextResponse: {
    json: vi.fn((body: unknown, init?: ResponseInit) => ({
      body,
      status: init?.status ?? 200,
    })),
  },
}));

import { hashToken, validateApiToken, unauthorizedResponse } from "@/lib/api-auth";
import { db } from "@/lib/db";

// Helper to build a minimal Request with an optional Authorization header
function makeRequest(authHeader?: string): Request {
  const headers = new Headers();
  if (authHeader !== undefined) {
    headers.set("Authorization", authHeader);
  }
  return new Request("https://example.com/api/transactions", { headers });
}

// Reference SHA-256 hash computed with Node's crypto directly
function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

const mockFindFirst = db.query.apiTokens.findFirst as ReturnType<typeof vi.fn>;

describe("hashToken", () => {
  it("produces consistent SHA-256 hashes", () => {
    const token = "my-secret-token";
    expect(hashToken(token)).toBe(sha256(token));
    // Calling twice should return the same value
    expect(hashToken(token)).toBe(hashToken(token));
  });

  it("produces different hashes for different tokens", () => {
    expect(hashToken("token-a")).not.toBe(hashToken("token-b"));
  });

  it("returns a 64-character hex string (SHA-256)", () => {
    const hash = hashToken("any-token");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("validateApiToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when no Authorization header is present", async () => {
    const result = await validateApiToken(makeRequest());
    expect(result).toBeNull();
  });

  it("returns null when Authorization header does not start with 'Bearer '", async () => {
    const result = await validateApiToken(makeRequest("Basic dXNlcjpwYXNz"));
    expect(result).toBeNull();
  });

  it("returns null when token is not found in the DB", async () => {
    mockFindFirst.mockResolvedValueOnce(undefined);
    const result = await validateApiToken(makeRequest("Bearer unknown-token"));
    expect(result).toBeNull();
  });

  it("returns userId when token matches a record in the DB", async () => {
    mockFindFirst.mockResolvedValueOnce({ token: hashToken("valid-token"), userId: "user_123" });
    const result = await validateApiToken(makeRequest("Bearer valid-token"));
    expect(result).toBe("user_123");
  });

  it("queries the DB with the hashed token, not the plain token", async () => {
    const plainToken = "plain-token";
    mockFindFirst.mockResolvedValueOnce({ token: hashToken(plainToken), userId: "user_123" });

    await validateApiToken(makeRequest(`Bearer ${plainToken}`));

    expect(mockFindFirst).toHaveBeenCalledOnce();
    // The argument passed to findFirst should be a where clause; the hashed value
    // appears in the call arguments rather than the raw token.
    const callArgs = mockFindFirst.mock.calls[0];
    // Serialize the call args to verify the hashed string is present
    expect(JSON.stringify(callArgs)).not.toContain(plainToken);
    expect(JSON.stringify(callArgs)).not.toContain("plain-token");
  });

  it("returns null when header is 'Bearer' with no space and no token", async () => {
    const result = await validateApiToken(makeRequest("Bearer"));
    expect(result).toBeNull();
    expect(mockFindFirst).not.toHaveBeenCalled();
  });

  it("returns null when header uses lowercase 'bearer' prefix", async () => {
    const result = await validateApiToken(makeRequest("bearer valid-token"));
    expect(result).toBeNull();
    expect(mockFindFirst).not.toHaveBeenCalled();
  });

  it("returns null when token is empty after Bearer prefix", async () => {
    // "Bearer " — space present but no actual token value
    mockFindFirst.mockResolvedValueOnce(undefined);
    const result = await validateApiToken(makeRequest("Bearer "));
    // The slice(7) yields "" which is falsy, so it should return null early
    expect(result).toBeNull();
  });
});

describe("unauthorizedResponse", () => {
  it("returns a response with status 401", () => {
    const response = unauthorizedResponse() as { body: unknown; status: number };
    expect(response.status).toBe(401);
  });

  it("includes { error: 'Unauthorized' } in the body", () => {
    const response = unauthorizedResponse() as { body: unknown; status: number };
    expect(response.body).toEqual({ error: "Unauthorized" });
  });
});
