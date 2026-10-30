import { spawn } from "node:child_process";
import { readFileSync, appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { test, expect } from "@playwright/test";
import {
  BOOKING_PREVIEW_ORIGIN,
  csrfHeaders,
  localServiceClient,
  NOTHING_LEFT,
  requireLocalBookingEnv,
} from "./fixtures/booking-local";

const COPY = {
  es: { browserLocale: "es-ES", enter: "Entrar", composer: "Escribe tu pregunta...", title: "Buscar a mi medida", preference: "¿Qué tipo de experiencia te apetece?", disclosure: "Cada búsqueda usa un turno de tu acceso; si vuelves a buscar, se usa otro turno.", style: "Un paseo tranquilo con vistas", date: "Fecha (opcional)", people: "Personas (opcional)", stepFree: "Acceso sin escalones", submit: "Buscar experiencias", use: "Usar en el chat", unknown: "No confirmado por el proveedor", estimated: "Se ha estimado el estilo", remaining: "Te quedan", coast: "Paseo por la senda costera", cancel: "Cancelar búsqueda", cancelled: "Búsqueda cancelada", retry: "Volver a buscar", close: "Cerrar" },
  en: { browserLocale: "en-GB", enter: "Enter", composer: "Ask about this place...", title: "Find my kind of experience", preference: "What kind of experience would you like?", disclosure: "Each search uses one turn from your access; searching again uses another turn.", style: "A quiet walk with views", date: "Date (optional)", people: "People (optional)", stepFree: "Step-free access", submit: "Find experiences", use: "Use in chat", unknown: "Not confirmed by the provider", estimated: "Style was estimated", remaining: "turns left", coast: "Coastal path walk", cancel: "Cancel search", cancelled: "Search cancelled", retry: "Search again", close: "Close" },
} as const;

for (const language of ["es", "en"] as const) {
  test.describe(`experience matching ${language}`, () => {
    const copy = COPY[language];
    test.use({ locale: copy.browserLocale, viewport: { width: 390, height: 844 } });

/** Browser UI forwards only matching HTTP to the prebound real local handler.
 * Authentication, metering and catalog use the owned database. Next proxy is
 * checked separately below; the bridge is explicitly outside proxy evidence.
 */
test("@release-required @local-docker experience matching: real quota/facts/cancellation, mobile keyboard and composer-only selection", async ({
  page,
  request,
  baseURL,
}, testInfo) => {
  test.setTimeout(360_000);
  page.setDefaultTimeout(20_000);
  page.setDefaultNavigationTimeout(45_000);
  const progressPath = testInfo.outputPath("progress.jsonl");
  mkdirSync(dirname(progressPath), { recursive: true });
  const pending = new Map<object, { origin: string; pathname: string; kind: string }>();
  const checkpoint = (stage: string) => appendFileSync(progressPath, JSON.stringify({ stage, at: new Date().toISOString(), pending: [...pending.values()] }) + "\n", { mode: 0o600 });
  page.on("request", incoming => { const url = new URL(incoming.url()); pending.set(incoming, { origin: url.origin, pathname: url.pathname, kind: incoming.resourceType() }); });
  page.on("requestfinished", incoming => pending.delete(incoming));
  page.on("requestfailed", incoming => pending.delete(incoming));
  page.on("domcontentloaded", () => checkpoint("domcontentloaded"));
  page.on("load", () => checkpoint("load"));
  checkpoint("driver-start");
  const env = requireLocalBookingEnv(),
    admin = localServiceClient(env);
  const child = spawn(
    process.execPath,
    [
      "--import",
      "tsx",
      "--conditions=react-server",
      "e2e/fixtures/jev-match-driver.ts",
      language,
    ],
    {
      cwd: process.cwd(),
      env: { ...process.env, NODE_ENV: "test" },
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
  child.stdin.on("error", () => {
    /* A failed child may close its input before cleanup. */
  });
  let stderr = "",
    output = "",
    metadataPath = "",
    browserPassed = false;
  let readyResolve!: (path: string) => void,
    readyReject!: (reason: Error) => void;
  const ready = new Promise<string>((resolve, reject) => {
    readyResolve = resolve;
    readyReject = reject;
  });
  child.stderr.on("data", (chunk) => {
    stderr += String(chunk);
  });
  child.stdout.on("data", (chunk) => {
    output += String(chunk);
    const marker = output
      .split("\n")
      .find((line) => line.startsWith("JEV_MATCH_READY "));
    if (marker) {
      metadataPath = marker.slice("JEV_MATCH_READY ".length);
      readyResolve(metadataPath);
    }
  });
  const exited = new Promise<number | null>((resolve) =>
    child.once("exit", (code) => {
      if (!metadataPath)
        readyReject(
          new Error("Local matching driver failed before readiness: " + stderr),
        );
      resolve(code);
    }),
  );
  child.once("error", (error) => readyReject(error));
  let metadata:
    | {
        origin: string;
        voucherCode: string;
        tag: string;
        reportPath: string;
        directory: string;
      }
    | undefined;
  try {
    const path = await Promise.race([
      ready,
      new Promise<never>((_resolve, reject) =>
        setTimeout(
          () => reject(new Error("Matching driver readiness timed out")),
          180_000,
        ),
      ),
    ]);
    metadata = JSON.parse(readFileSync(path, "utf8"));
    checkpoint("driver-ready");
    if (!metadata) throw new Error("Missing private matching fixture");
    let holdNext = false,
      heldResolve: (() => void) | undefined,
      release: (() => void) | undefined,
      browserAuthorization: string | undefined;
    const calls: { method: string; body: unknown }[] = [];
    await page.route("**/api/booking/match**", async (route) => {
      const incoming = route.request(),
        url = new URL(incoming.url());
      const headers = await incoming.allHeaders();
      browserAuthorization = headers.authorization ?? browserAuthorization;
      for (const name of [
        "host",
        "connection",
        "content-length",
        "accept-encoding",
      ])
        delete headers[name];
      const method = incoming.method();
      calls.push({
        method,
        body: method === "POST" ? incoming.postDataJSON() : null,
      });
      const response = await fetch(
        metadata!.origin + url.pathname + url.search,
        {
          method,
          headers,
          ...(method === "POST" ? { body: incoming.postData() } : {}),
        },
      );
      const body = await response.text(),
        outgoingHeaders = Object.fromEntries(response.headers);
      delete outgoingHeaders["content-length"];
      delete outgoingHeaders["content-encoding"];
      if (holdNext && method === "POST") {
        holdNext = false;
        heldResolve?.();
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      }
      try {
        await route.fulfill({
          status: response.status,
          headers: outgoingHeaders,
          body,
        });
      } catch {
        if (!release) throw new Error("Unexpected matching bridge failure");
      }
    });
    const initial = await admin
      .from("voucher_redemptions")
      .select("user_id,vouchers!inner(label)")
      .eq("vouchers.label", metadata.tag);
    if (initial.error) throw new Error(initial.error.message);
    const initialUsers = new Set(
      (initial.data ?? []).map((row) => row.user_id),
    );
    checkpoint("access-navigation-start");
    await page.goto("/acceso");
    checkpoint("access-navigation-complete");
    await page.locator("#voucher-code").fill(metadata.voucherCode);
    checkpoint("access-code-filled");
    await page.getByRole("button", { name: copy.enter }).click();
    checkpoint("access-submit-clicked");
    await page.waitForURL(/\/immersive\?booking=1/, { timeout: 60_000 });
    const composer = page.getByRole("textbox", {
      name: copy.composer,
    });
    await expect(composer).toBeVisible({ timeout: 60_000 });
    checkpoint("booking-composer-ready");
    expect(calls).toHaveLength(0);
    const redemption = async () => {
      const { data, error } = await admin
        .from("voucher_redemptions")
        .select(
          "user_id,chat_turns_used,booking_attempts_used,vouchers!inner(label)",
        )
        .eq("vouchers.label", metadata!.tag);
      if (error) throw new Error(error.message);
      const browserRows = (data ?? []).filter(
        (row) => !initialUsers.has(row.user_id),
      );
      expect(
        browserRows,
        "exactly one new guest redeems this run's code in the browser",
      ).toHaveLength(1);
      return browserRows[0]!;
    };
    expect((await redemption()).chat_turns_used).toBe(0);
    await page.getByRole("button", { name: copy.title }).click();
    const preference = page.getByRole("textbox", {
      name: copy.preference,
    });
    await expect(preference).toBeVisible();
    checkpoint("matching-form-ready");
    await expect(
      page.getByText(
        copy.disclosure,
      ),
    ).toBeInViewport();
    await preference.fill(copy.style);
    const date = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Madrid",
    }).format(new Date(Date.now() + 2 * 86_400_000));
    await page.getByLabel(copy.date).fill(date);
    await page.getByLabel(copy.people).fill("2");
    await page.getByRole("checkbox", { name: copy.stepFree }).check();
    expect(calls.filter((call) => call.method === "POST")).toHaveLength(0);
    expect((await redemption()).chat_turns_used).toBe(0);
    await expect(
      page.getByText(
        copy.disclosure,
      ),
    ).toBeVisible();
    const dialog = page.getByRole("dialog");
    const box = await dialog.locator(":scope > div").last().boundingBox();
    expect(
      box?.y,
      "mobile chat panel stays within the viewport",
    ).toBeGreaterThanOrEqual(0);
    await expect(page.getByRole("log")).toBeInViewport({ ratio: 0.1 });
    await expect(composer).toBeInViewport();
    await page.screenshot({
      path: testInfo.outputPath("matching-mobile-form.png"),
    });
    await page.getByRole("button", { name: copy.submit }).click();
    const use = page.getByRole("button", { name: copy.use }).first();
    await expect(use).toBeVisible();
    checkpoint("matching-results-ready");
    expect(calls.find((call) => call.method === "POST")?.body).toMatchObject({
      locale: language, preference: copy.style, date, partySize: 2, constraints: { step_free: true },
    });
    if (language === "en") {
      await expect(page.getByText("Coastal path walk", { exact: true }).first()).toBeVisible();
      await expect(page.getByText("Paseo por la senda costera", { exact: true })).toHaveCount(0);
    }
    await expect(
      page
        .getByText(copy.unknown, { exact: false })
        .first(),
    ).toBeVisible();
    expect((await redemption()).chat_turns_used).toBe(1);
    await expect(
      page.getByRole("status").filter({ hasText: copy.estimated }),
    ).toContainText(copy.remaining);
    await use.scrollIntoViewIfNeeded();
    await expect(use).toBeInViewport();
    await expect(composer).toBeInViewport();
    await expect(page.getByRole("log")).toBeInViewport({ ratio: 0.1 });
    await page.screenshot({
      path: testInfo.outputPath("matching-mobile-results.png"),
    });
    await use.focus();
    await page.keyboard.press("Enter");
    await expect(composer).toBeFocused();
    checkpoint("composer-prefilled");
    await expect(composer).toHaveValue(new RegExp(copy.coast));
    expect(await composer.inputValue()).toContain(copy.stepFree);
    expect((await redemption()).chat_turns_used).toBe(1);
    const guest = await redemption();
    for (const table of ["booking_drafts", "quotes", "bookings"]) {
      const { data, error } = await admin
        .from(table)
        .select("id")
        .eq("user_id", guest.user_id);
      if (error) throw new Error(error.message);
      expect(data).toEqual([]);
    }
    // A late successful response after cancellation must not replace editable input.
    await page.getByRole("button", { name: copy.title }).click();
    await expect(preference).toBeVisible();
    holdNext = true;
    const held = new Promise<void>((resolve) => {
      heldResolve = resolve;
    });
    await page.getByRole("button", { name: copy.submit }).click();
    await held;
    await page.getByRole("button", { name: copy.cancel }).click();
    release?.();
    await expect(
      page.getByRole("status").filter({ hasText: copy.cancelled }),
    ).toBeVisible();
    expect(await preference.inputValue()).toBe(copy.style);
    expect((await redemption()).chat_turns_used).toBe(2);
    await expect(
      page.getByRole("button", { name: copy.use }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: copy.retry }).click();
    await expect(
      page.getByRole("button", { name: copy.use }).first(),
    ).toBeVisible();
    expect((await redemption()).chat_turns_used).toBe(3);
    await page.getByRole("button", { name: copy.close, exact: true }).click();
    await expect(
      page.getByRole("button", { name: copy.title }),
    ).toBeFocused();
    // Actual Next endpoints retain concealment/CSRF/Preview behavior outside the local bridge.
    if (!browserAuthorization)
      throw new Error(
        "The actual matching request must carry guest authentication",
      );
    const defaultOff = await page
      .context()
      .request.get(`/api/booking/match?locale=${language}`, {
        headers: { authorization: browserAuthorization },
      });
    expect(defaultOff.status()).toBe(200);
    expect(await defaultOff.json()).toEqual({ available: false });
    expect(
      (
        await page
          .context()
          .request.post("/api/booking/match", {
            headers: csrfHeaders(baseURL!, {
              authorization: browserAuthorization,
            }),
            data: { locale: language, preference: copy.style },
          })
      ).status(),
    ).toBe(404);
    expect((await redemption()).chat_turns_used).toBe(3);
    expect(
      (
        await request.post("/api/booking/match", {
          headers: csrfHeaders(baseURL!, { origin: "https://evil.invalid" }),
          data: {},
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await request.get(
          BOOKING_PREVIEW_ORIGIN + `/api/booking/match?locale=${language}`,
        )
      ).status(),
    ).toBe(404);
    browserPassed = true;
    checkpoint("browser-complete");
  } finally {
    checkpoint("driver-cleanup-start");
    child.stdin.end(JSON.stringify({ finish: true, browserPassed }) + "\n");
    const exit = await Promise.race([
      exited,
      new Promise<never>((_resolve, reject) =>
        setTimeout(() => {
          child.kill("SIGTERM");
          reject(new Error("Matching driver cleanup timed out"));
        }, 45_000),
      ),
    ]);
    await testInfo.attach("matching-driver-stderr", {
      body: stderr,
      contentType: "text/plain",
    });
    if (metadata) {
      const report = JSON.parse(readFileSync(metadata.reportPath, "utf8"));
      await testInfo.attach("matching-route-database-evidence", {
        body: JSON.stringify(report, null, 2),
        contentType: "application/json",
      });
      expect(report.cleanup).toEqual(NOTHING_LEFT);
      if (browserPassed) {
        expect(exit).toBe(0);
        expect(report.complete).toBe(true);
        expect(report.apiComplete).toBe(true);
      }
    }
  }
});

  });
}
