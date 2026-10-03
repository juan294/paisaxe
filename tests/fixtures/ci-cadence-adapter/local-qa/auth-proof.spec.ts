import { test, expect, readSessionFromAuthCookies } from "../../../../e2e/fixtures/auth";
import { createClient } from "@supabase/supabase-js";

// This file is outside e2e: root's separate local-only config must select both
// original device profiles. Existing E2E/config/source selections are untouched.
test.beforeAll(() => {
  if (process.env.CI_CADENCE_LOCAL_QA !== "1") throw new Error("local_qa_handoff_required");
  const api = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "");
  const app = new URL(process.env.CI_CADENCE_QA_APP_ORIGIN || "");
  const localApi = ["localhost", "127.0.0.1", "[::1]"].includes(api.hostname);
  const localApp = ["localhost", "127.0.0.1", "[::1]"].includes(app.hostname);
  const projectId = process.env.CI_CADENCE_QA_PROJECT_ID;
  const internal = process.env.CI_CADENCE_QA_MODE === "internal" &&
    !!projectId?.match(/^ci-cadence-qa-[a-f0-9]{32}$/) &&
    api.hostname === `${projectId}-auth` && app.hostname === `${projectId}-app`;
  if (api.protocol !== "http:" || app.protocol !== "http:" ||
      (!internal && !(localApi && localApp)) || api.username || api.password || app.username || app.password ||
      !process.env.CI_CADENCE_QA_USER_ID || !process.env.CI_CADENCE_QA_NONCE ||
      !/^[a-f0-9]{32}$/.test(process.env.CI_CADENCE_QA_NONCE || "") ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(process.env.CI_CADENCE_QA_USER_ID || "") ||
      api.search || api.hash || api.pathname !== "/" || app.search || app.hash || app.pathname !== "/" ||
      !process.env.SUPABASE_SERVICE_KEY) throw new Error("local_qa_handoff_invalid");
  // Internal API origins need root's already verified runner/profile binding;
  // this marker is a handoff prerequisite, never standalone ownership evidence.
  if (api.origin !== process.env.CI_CADENCE_QA_API_ORIGIN) throw new Error("local_qa_origin_mismatch");
});

test("created local user authenticates through real SSR cookies and cookie-only app route", async ({ authenticatedPage, supabaseAdmin, browser }) => {
  const expectedId = process.env.CI_CADENCE_QA_USER_ID;
  const email = process.env.QA_TEST_USER_EMAIL;
  const session = await readSessionFromAuthCookies(authenticatedPage.context());
  if (!session?.access_token) throw new Error("local_qa_session_missing");
  expect(session.user.id).toBe(expectedId);
  expect(session.user.email).toBe(email);
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(session.access_token);
  expect(error).toBeNull();
  expect(data.user?.id).toBe(expectedId);
  expect(data.user?.user_metadata?.nonce).toBe(process.env.CI_CADENCE_QA_NONCE);
  const { data: profiles, error: profileError } = await supabaseAdmin.from("user_profiles").select("user_id,email,role").eq("user_id", expectedId!);
  expect(profileError).toBeNull();
  expect(profiles).toEqual([{ user_id: expectedId, email, role: "user" }]);
  await authenticatedPage.goto("/favorites");
  expect(new URL(authenticatedPage.url()).origin).toBe(process.env.CI_CADENCE_QA_APP_ORIGIN);
  const authenticated = await authenticatedPage.request.get("/api/favorites");
  expect(authenticated.status()).toBe(200);
  expect(Array.isArray(await authenticated.json())).toBe(true);
  const anonymous = await browser.newContext();
  try {
    const response = await anonymous.request.get(`${process.env.CI_CADENCE_QA_APP_ORIGIN}/api/favorites`);
    expect(response.status()).toBe(401);
  } finally {
    await anonymous.close();
  }
});
