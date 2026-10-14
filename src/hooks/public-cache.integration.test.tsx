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
  ClientQueryProvider,
  getBrowserQueryClient,
  publicQueryKey,
} from "@/lib/client-query";
import { StoriesProvider, useStories } from "./use-stories";
import { FeatureFlagsProvider, useFeatureFlags } from "./use-feature-flags";
import { CacheRetryNotice } from "@/components/cache-retry-notice";
import { LanguageProvider } from "@/lib/i18n";
import { Providers } from "@/app/providers";
import PricingPage from "@/app/pricing/page";
import { ImmersivePageContent } from "@/app/immersive/immersive-page-content";
import type { Story } from "@/types/immersive";
const route = vi.hoisted(() => ({ path: "/immersive" }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: () => {} }),
  usePathname: () => route.path,
}));
const story: Story = {
  id: "public",
  slug: "public",
  title: "Warm story",
  subtitle: "",
  description: "",
  image: "",
  category: "nature",
  sourcePdf: "private.pdf",
};
const boundary = vi.fn<typeof fetch>();
function StoriesConsumer({ name }: { name: string }) {
  const state = useStories();
  return (
    <section aria-label={name}>
      <input aria-label={`Edit ${name}`} defaultValue="unchanged" />
      <p>{state.stories.map((item) => item.title).join(",")}</p>
      <CacheRetryNotice
        error={state.error}
        onRetry={() => void state.refresh()}
      />
    </section>
  );
}
function FlagsConsumer() {
  const flags = useFeatureFlags();
  return (
    <p>{flags.isEnabled("visitor_voice_agent") ? "enabled" : "disabled"}</p>
  );
}
beforeEach(() => {
  route.path = "/immersive";
  getBrowserQueryClient().clear();
  localStorage.clear();
  boundary.mockReset();
  vi.stubGlobal("fetch", boundary);
});
afterEach(() => {
  cleanup();
  getBrowserQueryClient().clear();
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("keeps cached stories immediate, shares failed focus refresh, retains editing focus and retries visibly", async () => {
  boundary
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce(
      Response.json({ data: [{ ...story, title: "Recovered story" }] }),
    );
  render(
    <ClientQueryProvider>
      <LanguageProvider initialLocale="es">
        <StoriesProvider initialStories={[story]}>
          <StoriesConsumer name="one" />
          <StoriesConsumer name="two" />
        </StoriesProvider>
      </LanguageProvider>
    </ClientQueryProvider>,
  );
  expect(screen.getAllByText("Warm story")).toHaveLength(2);
  expect(boundary).not.toHaveBeenCalled();
  const input = screen.getByLabelText("Edit one");
  input.focus();
  fireEvent.change(input, { target: { value: "kept edit" } });
  const now = Date.now();
  vi.spyOn(Date, "now").mockReturnValue(now + 300_001);
  fireEvent(window, new Event("focus"));
  await waitFor(() => expect(screen.getAllByRole("alert")).toHaveLength(2));
  expect(boundary).toHaveBeenCalledTimes(1);
  expect(screen.getAllByText("Warm story")).toHaveLength(2);
  expect(document.activeElement).toBe(input);
  expect(input).toHaveValue("kept edit");
  fireEvent.click(
    screen.getAllByRole("button", { name: "Volver a intentar" })[0]!,
  );
  await waitFor(() =>
    expect(screen.getAllByText("Recovered story")).toHaveLength(2),
  );
  expect(screen.queryByRole("alert")).toBeNull();
  expect(input).toHaveValue("kept edit");
  expect(boundary).toHaveBeenCalledTimes(2);
});
it("seeded flag providers share exactly one timed revalidation and update all followers", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  boundary.mockResolvedValue(
    Response.json({
      data: [{ flagKey: "visitor_voice_agent", enabled: false }],
    }),
  );
  const initial = { visitor_voice_agent: true };
  render(
    <ClientQueryProvider>
      <FeatureFlagsProvider initialFlags={initial}>
        <FlagsConsumer />
      </FeatureFlagsProvider>
      <FeatureFlagsProvider initialFlags={initial}>
        <FlagsConsumer />
      </FeatureFlagsProvider>
    </ClientQueryProvider>,
  );
  expect(screen.getAllByText("enabled")).toHaveLength(2);
  expect(boundary).not.toHaveBeenCalled();
  await act(async () => {
    vi.advanceTimersByTime(59_999);
  });
  expect(boundary).not.toHaveBeenCalled();
  await act(async () => {
    vi.advanceTimersByTime(1);
  });
  expect(screen.getAllByText("disabled")).toHaveLength(2);
  expect(boundary).toHaveBeenCalledTimes(1);
  cleanup();
  await act(async () => {
    vi.advanceTimersByTime(60_000);
  });
  expect(boundary).toHaveBeenCalledTimes(1);
  vi.useRealTimers();
});
it.each(["json", "version", "timestamp", "future", "array"])(
  "discards corrupt public persistence (%s) and fetches a sanitized replacement",
  async (kind) => {
    const persisted = {
      version: kind === "version" ? 99 : 1,
      timestamp:
        kind === "timestamp"
          ? "broken"
          : Date.now() + (kind === "future" ? 6000 : 0),
      data: kind === "array" ? [17] : [story],
    };
    localStorage.setItem(
      "paisaxe-stories-cache",
      kind === "json" ? "{" : JSON.stringify(persisted),
    );
    boundary.mockResolvedValue(Response.json({ data: [story] }));
    render(
      <StoriesProvider>
        <StoriesConsumer name="one" />
      </StoriesProvider>,
    );
    await waitFor(() =>
      expect(screen.getByText("Warm story")).toBeInTheDocument(),
    );
    expect(boundary).toHaveBeenCalledTimes(1);
    const stored = JSON.parse(localStorage.getItem("paisaxe-stories-cache")!);
    expect(stored.version).toBe(1);
    expect(stored.data[0]).not.toHaveProperty("sourcePdf");
  },
);
it("a staggered flag provider does not refetch a fresh shared result", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  boundary.mockImplementation(async () =>
    Response.json({
      data: [{ flagKey: "visitor_voice_agent", enabled: false }],
    }),
  );
  const initial = { visitor_voice_agent: true };
  const tree = (second: boolean) => (
    <ClientQueryProvider>
      <FeatureFlagsProvider initialFlags={initial}>
        <FlagsConsumer />
      </FeatureFlagsProvider>
      {second && (
        <FeatureFlagsProvider initialFlags={initial}>
          <FlagsConsumer />
        </FeatureFlagsProvider>
      )}
    </ClientQueryProvider>
  );
  const view = render(tree(false));
  await act(async () => {
    vi.advanceTimersByTime(10_000);
  });
  view.rerender(tree(true));
  await act(async () => {
    vi.advanceTimersByTime(50_000);
  });
  expect(boundary).toHaveBeenCalledTimes(1);
  await act(async () => {
    vi.advanceTimersByTime(10_000);
  });
  expect(boundary).toHaveBeenCalledTimes(1);
  expect(screen.getAllByText("disabled")).toHaveLength(2);
  vi.useRealTimers();
});
it.each(["bestMonths", "prompts", "translated-prompts", "related"])(
  "discards consumed optional story corruption (%s)",
  async (kind) => {
    const corrupt = {
      ...story,
      ...(kind === "bestMonths"
        ? { bestMonths: {} }
        : kind === "related"
          ? { relatedStories: {} }
          : {
              metadata:
                kind === "prompts"
                  ? { question_prompts: [{}] }
                  : {
                      translations: {
                        en: {
                          title: "English",
                          subtitle: "",
                          description: "",
                          question_prompts: [{}],
                        },
                      },
                    },
            }),
    };
    localStorage.setItem(
      "paisaxe-stories-cache",
      JSON.stringify({ version: 1, timestamp: Date.now(), data: [corrupt] }),
    );
    boundary.mockResolvedValue(Response.json({ data: [story] }));
    render(
      <StoriesProvider>
        <StoriesConsumer name="one" />
      </StoriesProvider>,
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(boundary).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(screen.getByText("Warm story")).toBeInTheDocument(),
    );
  },
);
it("an older remounted story seed cannot replace a completed API result, but a newer timestamped seed can", async () => {
  const now = Date.now();
  boundary.mockResolvedValue(Response.json({ data: [story] }));
  const first = render(
    <StoriesProvider>
      <StoriesConsumer name="one" />
    </StoriesProvider>,
  );
  await waitFor(() =>
    expect(screen.getByText("Warm story")).toBeInTheDocument(),
  );
  first.unmount();
  const older = render(
    <StoriesProvider
      initialStories={[{ ...story, title: "Old RSC seed" }]}
      initialUpdatedAt={now - 1000}
    >
      <StoriesConsumer name="two" />
    </StoriesProvider>,
  );
  expect(screen.getByText("Warm story")).toBeInTheDocument();
  expect(screen.queryByText("Old RSC seed")).toBeNull();
  older.unmount();
  const later = Date.now() + 1000;
  vi.spyOn(Date, "now").mockReturnValue(later);
  render(
    <StoriesProvider
      initialStories={[{ ...story, title: "New server seed" }]}
      initialUpdatedAt={later}
    >
      <StoriesConsumer name="three" />
    </StoriesProvider>,
  );
  expect(screen.getByText("New server seed")).toBeInTheDocument();
  expect(boundary).toHaveBeenCalledTimes(1);
});

it("the actual immersive no-results consumer still discloses stale failures and retries", async () => {
  boundary
    .mockResolvedValueOnce(Response.json({ data: [] }))
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce(Response.json({ data: [] }));
  render(
    <ClientQueryProvider>
      <LanguageProvider initialLocale="es">
        <ImmersivePageContent serverShuffleSeed={1} initialFlags={{}} />
      </LanguageProvider>
    </ClientQueryProvider>,
  );
  await waitFor(() => expect(screen.getByRole("button")).toBeInTheDocument());
  vi.spyOn(Date, "now").mockReturnValue(Date.now() + 300_001);
  fireEvent(window, new Event("focus"));
  const retry = await screen.findByRole("button", {
    name: "Volver a intentar",
  });
  fireEvent.click(retry);
  await waitFor(() =>
    expect(
      screen.queryByRole("button", { name: "Volver a intentar" }),
    ).toBeNull(),
  );
  expect(boundary).toHaveBeenCalledTimes(3);
});

it("timestamp-less flag remounts retain authoritative data and newer timestamped seeds supersede it", async () => {
  const beforeFetch = Date.now();
  boundary.mockResolvedValue(
    Response.json({
      data: [{ flagKey: "visitor_voice_agent", enabled: false }],
    }),
  );
  const first = render(
    <FeatureFlagsProvider>
      <FlagsConsumer />
    </FeatureFlagsProvider>,
  );
  await waitFor(() => expect(boundary).toHaveBeenCalledTimes(1));
  await act(async () => {
    await Promise.resolve();
  });
  first.unmount();
  const old = render(
    <FeatureFlagsProvider initialFlags={{ visitor_voice_agent: true }}>
      <FlagsConsumer />
    </FeatureFlagsProvider>,
  );
  expect(screen.getByText("disabled")).toBeInTheDocument();
  old.unmount();
  const older = render(
    <FeatureFlagsProvider
      initialFlags={{ visitor_voice_agent: true }}
      initialUpdatedAt={beforeFetch - 1000}
    >
      <FlagsConsumer />
    </FeatureFlagsProvider>,
  );
  expect(screen.getByText("disabled")).toBeInTheDocument();
  older.unmount();
  const now = Date.now() + 1000;
  vi.spyOn(Date, "now").mockReturnValue(now);
  render(
    <FeatureFlagsProvider
      initialFlags={{ visitor_voice_agent: true }}
      initialUpdatedAt={now}
    >
      <FlagsConsumer />
    </FeatureFlagsProvider>,
  );
  expect(screen.getByText("enabled")).toBeInTheDocument();
  expect(boundary).toHaveBeenCalledTimes(1);
});
it("timestamp-less story remounts cannot overwrite a completed API result", async () => {
  boundary.mockResolvedValue(Response.json({ data: [story] }));
  const first = render(
    <StoriesProvider>
      <StoriesConsumer name="one" />
    </StoriesProvider>,
  );
  await waitFor(() =>
    expect(screen.getByText("Warm story")).toBeInTheDocument(),
  );
  first.unmount();
  render(
    <StoriesProvider initialStories={[{ ...story, title: "Unknown-age seed" }]}>
      <StoriesConsumer name="two" />
    </StoriesProvider>,
  );
  expect(screen.getByText("Warm story")).toBeInTheDocument();
  expect(screen.queryByText("Unknown-age seed")).toBeNull();
});
it("a newer story seed revokes a held older response, including its persistence write, and allows a later refresh", async () => {
  let release!: (payload: unknown) => void;
  const body = new Promise((resolve) => {
    release = resolve;
  });
  boundary
    .mockResolvedValueOnce({ ok: true, json: () => body } as Response)
    .mockResolvedValueOnce(
      Response.json({ data: [{ ...story, title: "Later API story" }] }),
    );
  const client = getBrowserQueryClient();
  const now = Date.now();
  const tree = (title: string, updatedAt: number) => (
    <ClientQueryProvider>
      <StoriesProvider
        initialStories={[{ ...story, title }]}
        initialUpdatedAt={updatedAt}
      >
        <StoriesConsumer name="one" />
        <StoriesConsumer name="two" />
      </StoriesProvider>
    </ClientQueryProvider>
  );
  const view = render(tree("Warm story", now));
  let pending!: Promise<void>;
  await act(async () => {
    pending = client.refetchQueries({
      queryKey: publicQueryKey("stories"),
      exact: true,
    });
    await Promise.resolve();
  });
  expect(boundary).toHaveBeenCalledTimes(1);
  view.rerender(tree("New server seed", now + 1000));
  await act(async () => {
    release({ data: [{ ...story, title: "Held old story" }] });
    await pending;
  });
  expect(screen.getAllByText("New server seed")).toHaveLength(2);
  expect(
    client.getQueryData<Story[]>(publicQueryKey("stories"))?.[0]?.title,
  ).toBe("New server seed");
  expect(localStorage.getItem("paisaxe-stories-cache")).toBeNull();
  await act(async () => {
    await client.refetchQueries({
      queryKey: publicQueryKey("stories"),
      exact: true,
    });
  });
  expect(screen.getAllByText("Later API story")).toHaveLength(2);
  expect(
    JSON.parse(localStorage.getItem("paisaxe-stories-cache")!).data[0].title,
  ).toBe("Later API story");
  expect(boundary).toHaveBeenCalledTimes(2);
});
it("a newer flag seed revokes a held older response and allows a later refresh", async () => {
  let release!: (payload: unknown) => void;
  const body = new Promise((resolve) => {
    release = resolve;
  });
  boundary
    .mockResolvedValueOnce({ ok: true, json: () => body } as Response)
    .mockResolvedValueOnce(
      Response.json({
        data: [{ flagKey: "visitor_voice_agent", enabled: false }],
      }),
    );
  const client = getBrowserQueryClient();
  const now = Date.now();
  const tree = (enabled: boolean, updatedAt: number) => (
    <ClientQueryProvider>
      <FeatureFlagsProvider
        initialFlags={{ visitor_voice_agent: enabled }}
        initialUpdatedAt={updatedAt}
      >
        <FlagsConsumer />
        <FlagsConsumer />
      </FeatureFlagsProvider>
    </ClientQueryProvider>
  );
  const view = render(tree(false, now));
  let pending!: Promise<void>;
  await act(async () => {
    pending = client.refetchQueries({
      queryKey: publicQueryKey("feature-flags"),
      exact: true,
    });
    await Promise.resolve();
  });
  expect(boundary).toHaveBeenCalledTimes(1);
  view.rerender(tree(true, now + 1000));
  await act(async () => {
    release({ data: [{ flagKey: "visitor_voice_agent", enabled: false }] });
    await pending;
  });
  expect(screen.getAllByText("enabled")).toHaveLength(2);
  expect(
    client.getQueryData<{ enabled: boolean }[]>(
      publicQueryKey("feature-flags"),
    )?.[0]?.enabled,
  ).toBe(true);
  await act(async () => {
    await client.refetchQueries({
      queryKey: publicQueryKey("feature-flags"),
      exact: true,
    });
  });
  expect(screen.getAllByText("disabled")).toHaveLength(2);
  expect(boundary).toHaveBeenCalledTimes(2);
});
it("the actual pricing root exposes flag retry and suppresses that error after a disabled-route transition", async () => {
  route.path = "/pricing";
  boundary
    .mockRejectedValueOnce(new Error("offline flags"))
    .mockRejectedValueOnce(new Error("still offline flags"))
    .mockResolvedValueOnce(Response.json({ data: [] }));
  const view = render(
    <Providers>
      <PricingPage />
    </Providers>,
  );
  const retry = await screen.findByRole("button", { name: "Try again" });
  fireEvent.click(retry);
  await waitFor(() => expect(boundary).toHaveBeenCalledTimes(2));
  await act(async () => {
    await Promise.resolve();
  });
  expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  route.path = "/about";
  view.rerender(
    <Providers>
      <p>Static content</p>
    </Providers>,
  );
  expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  expect(boundary).toHaveBeenCalledTimes(2);
  route.path = "/pricing";
  view.rerender(
    <Providers>
      <PricingPage />
    </Providers>,
  );
  await waitFor(() => expect(boundary).toHaveBeenCalledTimes(3));
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull(),
  );
});
