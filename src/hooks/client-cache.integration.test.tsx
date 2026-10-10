import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  AnalyticsCacheProvider,
  useAnalyticsData,
} from "@/components/admin/analytics-cache-context";
import { AuthProvider, useAuthContext } from "@/components/auth/auth-provider";
import {
  ClientQueryProvider,
  getBrowserQueryClient,
  favoritesStorageKey,
} from "@/lib/client-query";
import { FeatureFlagsProvider } from "./use-feature-flags";
import { useFavorites } from "./use-favorites";
import { useVoiceAccess } from "./use-voice-access";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

const A = "00000000-0000-4000-8000-000000000909";
const B = "00000000-0000-4000-8000-000000000910";
const boundary = vi.fn<typeof fetch>();
const json = (value: unknown, init?: ResponseInit) =>
  Response.json(value, init);
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
let sdk: ReturnType<typeof createSupabaseBrowserClient>;
let favoritesRead: () => Promise<Response>;
let voiceRead: () => Promise<Response>;
let analyticsRead: () => Promise<Response>;
let write: (method: string, story: string) => Promise<Response>;
let tokenSerial = 0;

async function login(id: string) {
  const encode = (value: unknown) =>
    btoa(JSON.stringify(value))
      .replaceAll("=", "")
      .replaceAll("+", "-")
      .replaceAll("/", "_");
  const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: id, aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600, serial: ++tokenSerial })}.c3ludGhldGlj`;
  await act(async () => {
    expect(
      (
        await sdk!.auth.setSession({
          access_token: token,
          refresh_token: "phase9-synthetic-refresh",
        })
      ).error,
    ).toBeNull();
  });
  await sdk!.auth.stopAutoRefresh();
  return token;
}
function Consumer({ name }: { name: string }) {
  const auth = useAuthContext();
  const favorites = useFavorites();
  const access = useVoiceAccess();
  const analytics = useAnalyticsData<string>(
    "integration",
    async () =>
      (
        await fetch("/api/admin/cache-fixture", {
          headers: { Authorization: `Bearer ${auth.session?.access_token}` },
        })
      ).json(),
    "same",
  );
  return (
    <section aria-label={name}>
      <output data-testid={`${name}-analytics`}>
        {analytics.data ?? "none"}
      </output>
      <button onClick={analytics.refresh}>analytics {name}</button>
      <output data-testid={`${name}-user`}>
        {auth.user?.id ?? "anonymous"}
      </output>
      <output data-testid={`${name}-favorites`}>
        {favorites.favorites.join(",")}
      </output>
      <output data-testid={`${name}-access`}>
        {access.hasAccess ? "granted" : "denied"}
      </output>
      <output data-testid={`${name}-issuance`}>
        {access.isAccessDenied ? "blocked" : "resolved"}
      </output>
      <output data-testid={`${name}-retry`}>
        {favorites.retryAfter ?? "none"}
      </output>
      <button onClick={() => void favorites.retry()}>
        retry favorites {name}
      </button>
      <button onClick={() => favorites.toggleFavorite("first")}>
        first {name}
      </button>
      <button onClick={() => favorites.toggleFavorite("second")}>
        second {name}
      </button>
      <button
        onClick={() => void access.refresh({ afterIssuanceDenial: true })}
      >
        deny {name}
      </button>
      <button onClick={() => void access.refresh()}>refresh {name}</button>
    </section>
  );
}
async function mount() {
  render(
    <ClientQueryProvider>
      <AuthProvider>
        <AnalyticsCacheProvider>
          <FeatureFlagsProvider initialFlags={{ visitor_voice_agent: true }}>
            <Consumer name="one" />
            <Consumer name="two" />
          </FeatureFlagsProvider>
        </AnalyticsCacheProvider>
      </AuthProvider>
    </ClientQueryProvider>,
  );
  await waitFor(() =>
    expect(screen.getByTestId("one-user")).toHaveTextContent(A),
  );
}
const reads = (path: string) =>
  boundary.mock.calls.filter(
    ([input, init]) =>
      String(input) === path && (!init?.method || init.method === "GET"),
  ).length;
const bothFavorites = (value: string) => {
  expect(screen.getByTestId("one-favorites").textContent).toBe(value);
  expect(screen.getByTestId("two-favorites").textContent).toBe(value);
};
const bothAccess = (value: string) => {
  expect(screen.getByTestId("one-access")).toHaveTextContent(value);
  expect(screen.getByTestId("two-access")).toHaveTextContent(value);
};
beforeEach(async () => {
  vi.useRealTimers();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "eyJ_phase9_synthetic_anon");
  localStorage.clear();
  getBrowserQueryClient().clear();
  boundary.mockReset();
  favoritesRead = async () => json([]);
  voiceRead = async () =>
    json({ hasAccess: false, expiresAt: null, purchaseType: null });
  analyticsRead = async () => json({ data: "A analytics" });
  write = async () => json({});
  boundary.mockImplementation(async (input, init) => {
    const url = new URL(
      input instanceof Request ? input.url : String(input),
      window.location.origin,
    );
    const method = init?.method ?? "GET";
    if (
      url.origin === "http://127.0.0.1:54321" &&
      url.pathname === "/auth/v1/user"
    ) {
      const headers = new Headers(
        init?.headers ?? (input instanceof Request ? input.headers : undefined),
      );
      const token = headers.get("Authorization")!.replace("Bearer ", "");
      const id = JSON.parse(
        atob(token.split(".")[1]!.replaceAll("-", "+").replaceAll("_", "/")),
      ).sub;
      return json({
        id,
        aud: "authenticated",
        role: "authenticated",
        email: `${id}@example.test`,
        user_metadata: {},
        app_metadata: {},
        created_at: "2026-01-01T00:00:00Z",
      });
    }
    if (
      url.origin === "http://127.0.0.1:54321" &&
      url.pathname === "/auth/v1/logout"
    )
      return json({});
    if (url.origin !== window.location.origin)
      throw new Error(`Forbidden external request: ${url}`);
    if (url.pathname === "/api/favorites")
      return method === "GET"
        ? favoritesRead()
        : write(
            method,
            method === "DELETE"
              ? url.searchParams.get("storyId")!
              : JSON.parse(String(init?.body)).storyIds[0],
          );
    if (url.pathname === "/api/voice-access") return voiceRead();
    if (url.pathname === "/api/admin/cache-fixture") return analyticsRead();
    throw new Error(`Unexpected local request: ${url.pathname}`);
  });
  vi.stubGlobal("fetch", boundary);
  sdk = createSupabaseBrowserClient();
  await login(A);
});
afterEach(async () => {
  vi.useRealTimers();
  cleanup();
  await sdk?.auth.signOut({ scope: "local" });
  await sdk?.auth.stopAutoRefresh();
  getBrowserQueryClient().clear();
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it("shares one favorites read and optimistic changes between actual authenticated consumers", async () => {
  const read = deferred<Response>();
  favoritesRead = () => read.promise;
  await mount();
  expect(reads("/api/favorites")).toBe(1);
  await act(async () => {
    read.resolve(json([]));
  });
  fireEvent.click(screen.getByText("first one"));
  await waitFor(() => bothFavorites("first"));
});
it.each([true, false])(
  "rolls back only its failed story regardless of completion order (failure first: %s)",
  async (failureFirst) => {
    const first = deferred<Response>(),
      second = deferred<Response>();
    write = async (_method, id) => (id === "first" ? first : second).promise;
    await mount();
    await waitFor(() => expect(reads("/api/favorites")).toBeGreaterThan(0));
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.click(screen.getByText("first one"));
    fireEvent.click(screen.getByText("second two"));
    await act(async () => {
      if (failureFirst) {
        first.resolve(json({}, { status: 500 }));
        await Promise.resolve();
        second.resolve(json({}));
      } else {
        second.resolve(json({}));
        await Promise.resolve();
        first.resolve(json({}, { status: 500 }));
      }
    });
    await waitFor(() => bothFavorites("second"));
  },
);
it("never displays or uploads legacy unowned favorites", async () => {
  localStorage.setItem(
    "paisaxe_favorites",
    JSON.stringify(["foreign-favorite"]),
  );
  const read = deferred<Response>();
  favoritesRead = () => read.promise;
  await mount();
  bothFavorites("");
  expect(localStorage.getItem("paisaxe_favorites")).toBeNull();
  await act(async () => {
    read.resolve(json([]));
  });
  expect(boundary.mock.calls.some(([, init]) => init?.method === "POST")).toBe(
    false,
  );
});
it("isolates late old-user responses, hides old access on switch and purges private values on logout", async () => {
  const read = deferred<Response>();
  favoritesRead = () => read.promise;
  voiceRead = async () =>
    json({ hasAccess: true, expiresAt: null, purchaseType: "day_pass" });
  const token = await login(A);
  await mount();
  await waitFor(() => bothAccess("granted"));
  favoritesRead = async () => json(["B-only"]);
  voiceRead = async () =>
    json({ hasAccess: false, expiresAt: null, purchaseType: null });
  await login(B);
  await waitFor(() =>
    expect(screen.getByTestId("one-user")).toHaveTextContent(B),
  );
  bothAccess("denied");
  await waitFor(() => bothFavorites("B-only"));
  await act(async () => {
    read.resolve(json(["A-only"]));
  });
  bothFavorites("B-only");
  expect(
    JSON.stringify(
      getBrowserQueryClient()
        .getQueryCache()
        .getAll()
        .map((query) => query.queryKey),
    ),
  ).not.toContain(token);
  await act(async () => {
    await sdk!.auth.signOut({ scope: "local" });
  });
  await waitFor(() =>
    expect(screen.getByTestId("one-user")).toHaveTextContent("anonymous"),
  );
  bothFavorites("");
  bothAccess("denied");
  expect(
    getBrowserQueryClient()
      .getQueryCache()
      .getAll()
      .filter(
        (query) =>
          query.queryKey[2] === "private" && query.state.data !== undefined,
      ),
  ).toHaveLength(0);
  expect(
    Object.keys(localStorage).some((key) =>
      key.startsWith("paisaxe_favorites"),
    ),
  ).toBe(false);
});
it("denial is shared and an older pending grant cannot restore access", async () => {
  const older = deferred<Response>();
  voiceRead = () => older.promise;
  await mount();
  expect(reads("/api/voice-access")).toBe(1);
  voiceRead = async () =>
    json({}, { status: 429, headers: { "Retry-After": "7" } });
  fireEvent.click(screen.getByText("deny one"));
  await waitFor(() =>
    expect(screen.getByTestId("two-issuance")).toHaveTextContent("blocked"),
  );
  await act(async () => {
    older.resolve(
      json({ hasAccess: true, expiresAt: null, purchaseType: "day_pass" }),
    );
  });
  bothAccess("denied");
  voiceRead = async () =>
    json({ hasAccess: true, expiresAt: null, purchaseType: "day_pass" });
  fireEvent.click(screen.getByText("refresh two"));
  await waitFor(() => bothAccess("granted"));
});
it("expires both mounted grants at their deadline and refreshes a revoked pass", async () => {
  const grant = deferred<Response>();
  voiceRead = () => grant.promise;
  await mount();
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  await act(async () => {
    grant.resolve(
      json({
        hasAccess: true,
        expiresAt: new Date(Date.now() + 1000).toISOString(),
        purchaseType: "day_pass",
      }),
    );
  });
  bothAccess("granted");
  voiceRead = async () =>
    json({
      hasAccess: false,
      expiresAt: null,
      purchaseType: null,
      status: "revoked",
    });
  await act(async () => {
    vi.advanceTimersByTime(1100);
  });
  bothAccess("denied");
  vi.useRealTimers();
  fireEvent.click(screen.getByText("refresh one"));
  await waitFor(() => bothAccess("denied"));
});

it("keeps settled optimistic state when a focus read body completes after the mutation", async () => {
  await mount();
  await act(async () => {
    await Promise.resolve();
  });
  const changed = deferred<Response>();
  write = () => changed.promise;
  fireEvent.click(screen.getByText("first one"));
  await waitFor(() => bothFavorites("first"));
  let body!: ReadableStreamDefaultController;
  const stream = new ReadableStream({
    start(controller) {
      body = controller;
    },
  });
  let nextRead = 0;
  favoritesRead = async () =>
    ++nextRead === 1 ? new Response(stream) : json(["first"]);
  fireEvent(window, new Event("focus"));
  await waitFor(() => expect(nextRead).toBe(1));
  await act(async () => {
    changed.resolve(json({}));
  });
  await act(async () => {
    body.enqueue(new TextEncoder().encode("[]"));
    body.close();
  });
  await waitFor(() => expect(nextRead).toBe(2));
  bothFavorites("first");
  expect(
    JSON.parse(localStorage.getItem(favoritesStorageKey(A))!).data,
  ).toEqual(["first"]);
});
it("serializes opposite intents for one story while other stories remain independent", async () => {
  const first = deferred<Response>(),
    second = deferred<Response>();
  let server: string[] = [];
  favoritesRead = async () => json(server);
  const methods: string[] = [];
  write = async (method, story) => {
    methods.push(method);
    const response = await (method === "POST" ? first.promise : second.promise);
    if (response.ok)
      server =
        method === "POST"
          ? [...server, story]
          : server.filter((id) => id !== story);
    return response;
  };
  await mount();
  await act(async () => {
    await Promise.resolve();
  });
  await act(async () => {
    fireEvent.click(screen.getByText("first one"));
  });
  await waitFor(() => bothFavorites("first"));
  await act(async () => {
    fireEvent.click(screen.getByText("first two"));
  });
  bothFavorites("");
  expect(methods).toEqual(["POST"]);
  // Resolving the later response first cannot make its network write run first.
  second.resolve(json({}));
  expect(methods).toEqual(["POST"]);
  await act(async () => {
    first.resolve(json({}));
  });
  await waitFor(() => expect(methods).toEqual(["POST", "DELETE"]));
  expect(server).toEqual([]);
  fireEvent(window, new Event("focus"));
  await act(async () => {
    await Promise.resolve();
  });
  bothFavorites("");
});
it("a successful independent story does not clear another story's retry notice", async () => {
  const second = deferred<Response>();
  write = async (_method, story) =>
    story === "first"
      ? json({}, { status: 429, headers: { "Retry-After": "13" } })
      : second.promise;
  await mount();
  await act(async () => {
    await Promise.resolve();
  });
  await act(async () => {
    fireEvent.click(screen.getByText("first one"));
  });
  await waitFor(() =>
    expect(screen.getByTestId("one-retry")).toHaveTextContent("13"),
  );
  await act(async () => {
    fireEvent.click(screen.getByText("second two"));
  });
  await act(async () => {
    second.resolve(json({}));
  });
  expect(screen.getByTestId("two-retry")).toHaveTextContent("13");
  bothFavorites("second");
});
it("does not retain obsolete retry after a newer opposite intent succeeds", async () => {
  const first = deferred<Response>();
  let calls = 0;
  write = async () => (++calls === 1 ? first.promise : json({}));
  await mount();
  await act(async () => {
    await Promise.resolve();
  });
  await act(async () => {
    fireEvent.click(screen.getByText("first one"));
  });
  await act(async () => {
    fireEvent.click(screen.getByText("first two"));
  });
  await act(async () => {
    first.resolve(json({}, { status: 429, headers: { "Retry-After": "13" } }));
  });
  await waitFor(() => expect(calls).toBe(2));
  bothFavorites("");
  expect(screen.getByTestId("one-retry")).toHaveTextContent("none");
  fireEvent.click(screen.getByText("retry favorites one"));
  await act(async () => {
    await Promise.resolve();
  });
  expect(calls).toBe(2);
});
it("keeps a monthly grant through the platform timer limit, then shares one expiry read", async () => {
  const grant = deferred<Response>();
  voiceRead = () => grant.promise;
  await mount();
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  const expiry = Date.now() + 30 * 86_400_000;
  await act(async () => {
    grant.resolve(
      json({
        hasAccess: true,
        expiresAt: new Date(expiry).toISOString(),
        purchaseType: "monthly_pass",
      }),
    );
  });
  const renewal = deferred<Response>();
  voiceRead = () => renewal.promise;
  await act(async () => {
    vi.advanceTimersByTime(2_147_483_647);
  });
  bothAccess("granted");
  expect(reads("/api/voice-access")).toBe(1);
  await act(async () => {
    vi.advanceTimersByTime(expiry - Date.now());
  });
  bothAccess("denied");
  expect(reads("/api/voice-access")).toBe(2);
  await act(async () => {
    renewal.resolve(
      json({
        hasAccess: false,
        expiresAt: null,
        purchaseType: null,
        status: "expired",
      }),
    );
  });
  vi.useRealTimers();
});
it.each(["invalid-json", "foreign-owner", "future-timestamp", "bad-array"])(
  "discards corrupt private persistence: %s",
  async (kind) => {
    const record = {
      version: 1,
      userId: kind === "foreign-owner" ? B : A,
      data: kind === "bad-array" ? [17] : ["cached"],
      timestamp: Date.now() + (kind === "future-timestamp" ? 100000 : 0),
    };
    localStorage.setItem(
      favoritesStorageKey(A),
      kind === "invalid-json" ? "{" : JSON.stringify(record),
    );
    const read = deferred<Response>();
    favoritesRead = () => read.promise;
    await mount();
    bothFavorites("");
    await act(async () => {
      read.resolve(json(["fresh"]));
    });
    await waitFor(() => bothFavorites("fresh"));
  },
);
it("storage quota failure cannot prevent a legitimate network mutation", async () => {
  await mount();
  await act(async () => {
    await Promise.resolve();
  });
  const storage = vi
    .spyOn(Storage.prototype, "setItem")
    .mockImplementation(() => {
      throw new Error("quota");
    });
  await act(async () => {
    fireEvent.click(screen.getByText("first one"));
  });
  await waitFor(() => bothFavorites("first"));
  expect(
    boundary.mock.calls.filter(([, init]) => init?.method === "POST"),
  ).toHaveLength(1);
  storage.mockRestore();
});

it("analytics shares verified identity and ignores its old response after token/account replacement", async () => {
  await mount();
  await waitFor(() =>
    expect(screen.getByTestId("two-analytics")).toHaveTextContent(
      "A analytics",
    ),
  );
  expect(reads("/api/admin/cache-fixture")).toBe(1);
  const old = deferred<Response>();
  analyticsRead = () => old.promise;
  fireEvent.click(screen.getByText("analytics one"));
  await waitFor(() => expect(reads("/api/admin/cache-fixture")).toBe(2));
  analyticsRead = async () => json({ data: "B analytics" });
  await login(B);
  await waitFor(() =>
    expect(screen.getByTestId("one-analytics")).toHaveTextContent(
      "B analytics",
    ),
  );
  await act(async () => {
    old.resolve(json({ data: "late A analytics" }));
  });
  expect(screen.getByTestId("two-analytics")).toHaveTextContent("B analytics");
  analyticsRead = async () => json({ data: "replacement token analytics" });
  await login(B);
  await waitFor(() =>
    expect(screen.getByTestId("two-analytics")).toHaveTextContent(
      "replacement token analytics",
    ),
  );
  await act(async () => {
    await sdk!.auth.signOut({ scope: "local" });
  });
  await waitFor(() =>
    expect(screen.getByTestId("one-analytics")).toHaveTextContent("none"),
  );
});

it.each(["network", "rate-limit"])(
  "bounds automatic reconciliation after %s failure and allows explicit recovery",
  async (failure) => {
    await mount();
    await act(async () => {
      await Promise.resolve();
    });
    const changed = deferred<Response>();
    write = () => changed.promise;
    fireEvent.click(screen.getByText("first one"));
    await waitFor(() => bothFavorites("first"));
    let body!: ReadableStreamDefaultController;
    const stream = new ReadableStream({
      start(controller) {
        body = controller;
      },
    });
    let nextRead = 0;
    const unexpected = deferred<Response>();
    favoritesRead = async () => {
      if (++nextRead === 1) return new Response(stream);
      if (nextRead > 2) return unexpected.promise;
      if (failure === "network") throw new Error("offline reconciliation");
      return json({}, { status: 429, headers: { "Retry-After": "19" } });
    };
    fireEvent(window, new Event("focus"));
    await waitFor(() => expect(nextRead).toBe(1));
    await act(async () => {
      changed.resolve(json({}));
    });
    await act(async () => {
      body.enqueue(new TextEncoder().encode("[]"));
      body.close();
    });
    await waitFor(() => expect(nextRead).toBeGreaterThanOrEqual(2));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(nextRead).toBe(2);
    bothFavorites("first");
    if (failure === "rate-limit")
      expect(screen.getByTestId("two-retry")).toHaveTextContent("19");
    favoritesRead = async () => {
      ++nextRead;
      return json(["first"]);
    };
    fireEvent.click(screen.getByText("retry favorites two"));
    await waitFor(() => expect(nextRead).toBe(3));
    bothFavorites("first");
    expect(screen.getByTestId("one-retry")).toHaveTextContent("none");
  },
);
it("releases completed mutation observers so the shared client can collect settled writes", async () => {
  await mount();
  await act(async () => {
    await Promise.resolve();
  });
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  getBrowserQueryClient().setMutationDefaults(["paisaxe", 1, "private"], {
    gcTime: 10,
  });
  await act(async () => {
    fireEvent.click(screen.getByText("first one"));
  });
  bothFavorites("first");
  expect(
    getBrowserQueryClient()
      .getMutationCache()
      .getAll()
      .every((mutation) => mutation.state.status === "success"),
  ).toBe(true);
  await act(async () => {
    vi.advanceTimersByTime(11);
  });
  expect(getBrowserQueryClient().getMutationCache().getAll()).toHaveLength(0);
  bothFavorites("first");
  vi.useRealTimers();
});
