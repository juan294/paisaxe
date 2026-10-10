import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const boundaries = [
  ["root", () => import("./error")],
  ["global", () => import("./global-error")],
  ["admin", () => import("./admin/error")],
  ["favorites", () => import("./favorites/error")],
  ["immersive", () => import("./immersive/error")],
] as const;

const capture = vi.fn();
const sdk = { captureException: capture };
const sdkFactory = vi.fn<() => typeof sdk | Promise<typeof sdk>>();

function deferredSdk() {
  let resolve!: (value: typeof sdk) => void;
  const promise = new Promise<typeof sdk>((done) => { resolve = done; });
  return { promise, resolve: () => resolve(sdk) };
}

beforeEach(() => {
  vi.resetModules();
  capture.mockReset();
  sdkFactory.mockReset().mockReturnValue(sdk);
  vi.doMock("@sentry/nextjs", async () => sdkFactory());
  vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://example@sentry.io/1");
  vi.spyOn(console, "error").mockImplementation(() => {});
  localStorage.clear();
  document.cookie = "paisaxe-locale=es; Path=/";
});

afterEach(async () => {
  cleanup();
  // Drain reporting promises while their SDK mock/environment still belongs to this case.
  await act(async () => {});
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.doUnmock("@sentry/nextjs");
});

describe.each(boundaries)("%s lazy error reporting", (_name, loadBoundary) => {
  async function load() {
    // Both the boundary and its owned loader are real. Only the external SDK is replaced.
    const [{ default: ErrorBoundary }, { LanguageProvider }] = await Promise.all([
      loadBoundary(),
      import("@/lib/i18n"),
    ]);
    const wrap = (child: ReactElement) => (
      <LanguageProvider initialLocale="es">{child}</LanguageProvider>
    );
    return { ErrorBoundary, wrap };
  }

  it.each([undefined, "", "   "])("does not import or capture with DSN %s, while logging and reset work", async (dsn) => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", dsn);
    const { ErrorBoundary, wrap } = await load();
    const error = new Error("no reporting configured");
    const reset = vi.fn();
    render(wrap(<ErrorBoundary error={error} reset={reset} />));
    await act(async () => {});

    expect(sdkFactory).not.toHaveBeenCalled();
    expect(capture).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(error);
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(reset).toHaveBeenCalledOnce();
  });

  it("captures the configured error once, does not recapture an unchanged error, and captures a new error", async () => {
    const { ErrorBoundary, wrap } = await load();
    const first = new Error("first configured error");
    const second = new Error("next configured error");
    const reset = vi.fn();
    const view = render(wrap(<ErrorBoundary error={first} reset={reset} />));
    await waitFor(() => expect(capture).toHaveBeenCalledExactlyOnceWith(first));
    view.rerender(wrap(<ErrorBoundary error={first} reset={reset} />));
    await act(async () => {});
    expect(capture).toHaveBeenCalledTimes(1);

    view.rerender(wrap(<ErrorBoundary error={second} reset={reset} />));
    await waitFor(() => expect(capture).toHaveBeenCalledTimes(2));
    expect(capture).toHaveBeenLastCalledWith(second);
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(reset).toHaveBeenCalledOnce();
  });

  it("keeps the real recovery UI and reset usable after a rejected SDK import", async () => {
    sdkFactory.mockRejectedValue(new Error("SDK import rejected"));
    const { ErrorBoundary, wrap } = await load();
    const error = new Error("original page failure");
    const reset = vi.fn();
    render(wrap(<ErrorBoundary error={error} reset={reset} />));
    await waitFor(() => expect(sdkFactory).toHaveBeenCalledOnce());
    await act(async () => {});

    expect(capture).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(error);
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(reset).toHaveBeenCalledOnce();
  });

  it.each(["throw", "reject"] as const)("keeps reset usable when SDK capture fails by %s", async (mode) => {
    const failure = new Error("SDK capture failed");
    if (mode === "throw") capture.mockImplementation(() => { throw failure; });
    else capture.mockImplementation(() => Promise.reject(failure));
    const { ErrorBoundary, wrap } = await load();
    const error = new Error("original failure to recover");
    const reset = vi.fn();
    render(wrap(<ErrorBoundary error={error} reset={reset} />));
    await waitFor(() => expect(capture).toHaveBeenCalledExactlyOnceWith(error));
    await act(async () => {});

    expect(console.error).toHaveBeenCalledWith(error);
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(reset).toHaveBeenCalledOnce();
  });

  async function whileSdkPending(run: (loaded: Awaited<ReturnType<typeof load>>, release: () => void) => Promise<void>) {
    const deferred = deferredSdk();
    sdkFactory.mockReturnValue(deferred.promise);
    let loaded: Awaited<ReturnType<typeof load>> | undefined;
    const loading = load().then((value) => { loaded = value; });
    try {
      // Eager SDK imports block boundary evaluation here; the recovery component must load independently.
      await waitFor(() => expect(loaded).toBeDefined());
      if (!loaded) throw new Error("Recovery boundary did not load");
      await run(loaded, deferred.resolve);
    } finally {
      deferred.resolve();
      await loading;
      await act(async () => { await vi.dynamicImportSettled(); });
    }
  }

  it("allows reset while the configured SDK is still importing", async () => {
    await whileSdkPending(async ({ ErrorBoundary, wrap }, release) => {
      const error = new Error("pending SDK");
      const reset = vi.fn();
      render(wrap(<ErrorBoundary error={error} reset={reset} />));
      await waitFor(() => expect(sdkFactory).toHaveBeenCalledOnce());
      expect(capture).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
      expect(reset).toHaveBeenCalledOnce();
      release();
      await waitFor(() => expect(capture).toHaveBeenCalledExactlyOnceWith(error));
    });
  });

  it("does not capture after unmount while the SDK import was pending", async () => {
    await whileSdkPending(async ({ ErrorBoundary, wrap }, release) => {
      const view = render(wrap(<ErrorBoundary error={new Error("unmounted error")} reset={vi.fn()} />));
      await waitFor(() => expect(sdkFactory).toHaveBeenCalledOnce());
      view.unmount();
      release();
      await act(async () => { await vi.dynamicImportSettled(); });
      expect(capture).not.toHaveBeenCalled();
    });
  });

  it("captures only the current error if a pending reporting effect is superseded", async () => {
    await whileSdkPending(async ({ ErrorBoundary, wrap }, release) => {
      const first = new Error("superseded error");
      const current = new Error("current error");
      const reset = vi.fn();
      const view = render(wrap(<ErrorBoundary error={first} reset={reset} />));
      await waitFor(() => expect(sdkFactory).toHaveBeenCalledOnce());
      view.rerender(wrap(<ErrorBoundary error={current} reset={reset} />));
      release();
      await waitFor(() => expect(capture).toHaveBeenCalledExactlyOnceWith(current));
    });
  });
});
