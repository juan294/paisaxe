import { test, expect, type Locator, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { injectSessionCookies, isValidTestEmail } from "./fixtures/auth";

const localRun = process.env.PHASE6_ADMIN_CARD_LOCAL === "1";
const stories = [
  { kind: "image", title: process.env.PHASE6_ADMIN_CARD_IMAGE_TITLE ?? "", overlays: 4 },
  { kind: "no image", title: process.env.PHASE6_ADMIN_CARD_NO_IMAGE_TITLE ?? "", overlays: 1 },
];

// The dedicated local run uses real Auth/admin APIs. Ordinary mock-oriented
// projects disclose this opt-in fixture requirement instead of impersonating admin.
test.skip(!localRun, "Requires the task-owned Phase 6 admin-card local fixture");
test.use({ bypassCSP: localRun });

test.beforeEach(async ({ page, baseURL }) => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const ownedUrl = process.env.SUPABASE_LOCAL_API_URL ?? "";
  const marker = process.env.SUPABASE_LOCAL_DB_MARKER ?? "";
  const email = process.env.QA_TEST_USER_EMAIL ?? "";
  const password = process.env.QA_TEST_USER_PASSWORD ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  for (const value of [baseURL ?? "", supabaseUrl]) {
    const url = new URL(value);
    expect(url.protocol).toBe("http:");
    expect(["127.0.0.1", "localhost"]).toContain(url.hostname);
  }
  expect(supabaseUrl).toBe(ownedUrl);
  expect(marker).toMatch(/^paisaxe-contracts:[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}:[a-f0-9]{64}$/);
  expect(isValidTestEmail(email)).toBe(true);
  expect(password).not.toBe("");
  expect(anonKey).not.toBe("");
  for (const story of stories) expect(story.title).not.toBe("");

  const supabase = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  expect(error).toBeNull();
  if (!data.session) throw new Error("Owned local admin fixture did not return a session");

  await page.goto("/admin");
  const storageKey = `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;
  await injectSessionCookies(page, storageKey, data.session);
  await page.goto("/admin?tab=stories");
  await expect(page.getByPlaceholder("Search stories...")).toBeVisible();
  await page.getByRole("button", { name: "Filter: show all stories", exact: true }).click();
});

async function findCard(page: Page, title: string): Promise<Locator> {
  await page.getByPlaceholder("Search stories...").fill(title);
  const card = page.getByRole("button").filter({ has: page.getByText(title, { exact: true }) });
  await expect(card).toHaveCount(1);
  return card;
}

async function expectOverlaysVisible(card: Locator, count: number): Promise<void> {
  const overlays = card.locator('[class~="opacity-0"]');
  await expect(overlays).toHaveCount(count);
  for (const overlay of await overlays.all()) {
    await expect.poll(() => overlay.evaluate((node) => getComputedStyle(node).opacity)).toBe("1");
  }
}

test.describe("real admin keyboard journey", () => {
  test.use({ viewport: { width: 1280, height: 900 }, hasTouch: false, isMobile: false });

  for (const story of stories) {
    test(`${story.kind}: keyboard reveals selection and keeps edit separate`, async ({ page }, testInfo) => {
      const card = await findCard(page, story.title);
      await page.mouse.move(0, 0);
      // Reach the actual card from the search input using native tab order.
      for (let step = 0; step < 20; step++) {
        await page.keyboard.press("Tab");
        if (await card.evaluate((node) => node === document.activeElement)) break;
      }
      await expect(card).toBeFocused();
      expect(await card.evaluate((node) => node.matches(":focus-visible"))).toBe(true);
      await expect.poll(() => card.evaluate((node) => getComputedStyle(node).boxShadow)).not.toBe("none");
      await expectOverlaysVisible(card, story.overlays);
      const screenshotPath = testInfo.outputPath("admin-card-keyboard-focus.png");
      await card.screenshot({ path: screenshotPath });
      await testInfo.attach("Admin card with keyboard focus and visible overlays", {
        path: screenshotPath,
        contentType: "image/png",
      });

      const checkbox = card.getByRole("checkbox", { name: `Seleccionar ${story.title}` });
      await page.keyboard.press("Tab");
      await expect(checkbox).toBeFocused();
      await page.keyboard.press("Space");
      await expect(checkbox).toHaveAttribute("aria-checked", "true");
      await expect(checkbox).toBeFocused();
      await expect(page.getByRole("dialog", { name: "Edit Story" })).toHaveCount(0);
      await page.keyboard.press("Enter");
      await expect(checkbox).toHaveAttribute("aria-checked", "false");
      await expect(checkbox).toBeFocused();
      await expect(page.getByRole("dialog", { name: "Edit Story" })).toHaveCount(0);

      await page.keyboard.press("Shift+Tab");
      await expect(card).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("dialog", { name: "Edit Story" })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog", { name: "Edit Story" })).toHaveCount(0);
    });
  }
});

test.describe("real admin coarse-pointer journey", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  for (const story of stories) {
    test(`${story.kind}: selection is visible without hover and tap does not edit`, async ({ page }, testInfo) => {
      expect(await page.evaluate(() => matchMedia("(pointer: coarse)").matches)).toBe(true);
      const card = await findCard(page, story.title);
      await expectOverlaysVisible(card, story.overlays);
      const screenshotPath = testInfo.outputPath("admin-card-coarse-pointer.png");
      await card.screenshot({ path: screenshotPath });
      await testInfo.attach("Admin card on a coarse pointer before selection", {
        path: screenshotPath,
        contentType: "image/png",
      });
      const checkbox = card.getByRole("checkbox", { name: `Seleccionar ${story.title}` });
      await checkbox.tap();
      await expect(checkbox).toHaveAttribute("aria-checked", "true");
      await expect(page.getByRole("dialog", { name: "Edit Story" })).toHaveCount(0);
      await checkbox.tap();
      await expect(checkbox).toHaveAttribute("aria-checked", "false");
      await expect(page.getByRole("dialog", { name: "Edit Story" })).toHaveCount(0);

      await card.getByText(story.title, { exact: true }).tap();
      await expect(page.getByRole("dialog", { name: "Edit Story" })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog", { name: "Edit Story" })).toHaveCount(0);
    });
  }
});
