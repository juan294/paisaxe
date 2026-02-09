import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock Supabase SSR
vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  })),
}));

// Mock cookies
vi.mock("next/headers", () => ({
  cookies: vi.fn(() =>
    Promise.resolve({
      getAll: vi.fn(() => []),
      set: vi.fn(),
    })
  ),
}));

import { createServerClient } from "@supabase/ssr";
const mockCreateServerClient = vi.mocked(createServerClient);

import { getSupabaseClient, getUserFromRequest } from "./supabase-auth";

describe("getSupabaseClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a Supabase server client with cookies", async () => {
    await getSupabaseClient();

    expect(createServerClient).toHaveBeenCalledWith(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      expect.objectContaining({
        cookies: expect.objectContaining({
          getAll: expect.any(Function),
          setAll: expect.any(Function),
        }),
      })
    );
  });

  it("should return the created client", async () => {
    const mockClient = {
      auth: { getUser: vi.fn() },
      from: vi.fn(),
    };
    mockCreateServerClient.mockReturnValue(mockClient as never);

    const client = await getSupabaseClient();
    expect(client).toBe(mockClient);
  });
});

describe("getUserFromRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createRequest = (headers: Record<string, string> = {}) => {
    return new NextRequest("http://localhost:3000/api/test", {
      method: "GET",
      headers,
    });
  };

  it("should return null when Authorization header is missing", async () => {
    const request = createRequest();
    const user = await getUserFromRequest(request);
    expect(user).toBeNull();
  });

  it("should return null when Authorization header does not start with Bearer", async () => {
    const request = createRequest({ Authorization: "Basic some-token" });
    const user = await getUserFromRequest(request);
    expect(user).toBeNull();
  });

  it("should return null when getUser returns an error", async () => {
    const mockGetUser = vi.fn().mockResolvedValue({
      data: { user: null },
      error: { message: "Token expired" },
    });
    mockCreateServerClient.mockReturnValue({
      auth: { getUser: mockGetUser },
      from: vi.fn(),
    } as never);

    const request = createRequest({ Authorization: "Bearer expired-token" });
    const user = await getUserFromRequest(request);

    expect(user).toBeNull();
    expect(mockGetUser).toHaveBeenCalledWith("expired-token");
  });

  it("should return null when getUser returns no user", async () => {
    mockCreateServerClient.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
      from: vi.fn(),
    } as never);

    const request = createRequest({ Authorization: "Bearer token" });
    const user = await getUserFromRequest(request);

    expect(user).toBeNull();
  });

  it("should return user when token is valid", async () => {
    const mockUser = { id: "user-123", email: "test@example.com" };
    mockCreateServerClient.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: mockUser },
          error: null,
        }),
      },
      from: vi.fn(),
    } as never);

    const request = createRequest({ Authorization: "Bearer valid-token" });
    const user = await getUserFromRequest(request);

    expect(user).toEqual(mockUser);
  });

  it("should extract token correctly from Bearer header", async () => {
    const mockGetUser = vi.fn().mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    mockCreateServerClient.mockReturnValue({
      auth: { getUser: mockGetUser },
      from: vi.fn(),
    } as never);

    const request = createRequest({ Authorization: "Bearer my-secret-token" });
    await getUserFromRequest(request);

    expect(mockGetUser).toHaveBeenCalledWith("my-secret-token");
  });
});
