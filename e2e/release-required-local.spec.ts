import {
  test,
  expect,
  readSessionFromAuthCookies,
} from "./fixtures/auth";
import { createClient } from "@supabase/supabase-js";
import { assertLocalDatastore } from "../scripts/release/probe-guards";

/**
 * Release-required probes — LOCAL DOCKER ONLY, mutating.
 *
 * Tagged `@release-required @local-docker`. The `release-required` project
 * grep-inverts `@local-docker`, so a deployed release run cannot select these;
 * only `release-required-local`, which always targets localhost, can.
 *
 * Plan D-B: state-changing verification runs against the local Docker Postgres
 * (supabase/config.toml, port 54322) and nowhere else. Preview and Production
 * share one Supabase project, so a write there is a production write. The
 * guard below enforces that in code rather than trusting the runner.
 */

test.beforeAll(() => {
  // Fail closed, never skip: a required probe that opts out of running is a
  // vacuous pass.
  assertLocalDatastore(process.env.NEXT_PUBLIC_SUPABASE_URL);
});

test("@release-required @local-docker favorite-roundtrip: create, read back from the datastore, clean up", async ({
  authenticatedPage,
}) => {
  const page = authenticatedPage;

  // Read the SSR cookie session the auth fixture injected, then drive the real
  // API from inside the page — the same path the browser client takes.
  const session = await readSessionFromAuthCookies(page.context());
  const accessToken = session?.access_token as string | undefined;
  const userId = session?.user?.id as string | undefined;
  expect(accessToken, "authenticated session must carry an access token").toBeTruthy();
  expect(userId, "authenticated session must identify a user").toBeTruthy();

  const userSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    }
  );

  const { data: story, error: storyError } = await userSupabase
    .from("stories")
    .select("id")
    .limit(1)
    .single();

  if (storyError || !story) {
    throw new Error(
      `No story available to favorite: ${storyError?.message ?? "empty stories table"}. ` +
        "Reset the local stack so supabase/seed.sql is applied."
    );
  }

  const storyId = story.id as string;

  async function callFavoriteApi(method: "POST" | "DELETE"): Promise<number> {
    return page.evaluate(
      async ({ method, storyId, token }) => {
        const isDelete = method === "DELETE";
        const csrfToken = document.cookie
          .split("; ")
          .find((row) => row.startsWith("__csrf="))
          ?.slice("__csrf=".length);
        if (!csrfToken) {
          throw new Error("CSRF cookie was not issued before the mutating probe");
        }
        const response = await fetch(isDelete
          ? `/api/favorites?storyId=${encodeURIComponent(storyId)}`
          : "/api/favorites", {
          method,
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`,
            "x-csrf-token": csrfToken,
          },
          body: isDelete ? undefined : JSON.stringify({ storyIds: [storyId] }),
        });
        return response.status;
      },
      { method, storyId, token: accessToken }
    );
  }

  async function readBack(): Promise<number> {
    const { count, error } = await userSupabase
      .from("user_favorites")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("story_id", storyId);

    if (error) {
      throw new Error(`Datastore read-back failed: ${error.message}`);
    }
    return count ?? 0;
  }

  try {
    expect(await callFavoriteApi("POST")).toBeLessThan(300);

    // Datastore oracle: the write is observed in Postgres, not inferred from
    // the HTTP response.
    expect(await readBack(), "favorite must exist in user_favorites").toBe(1);
  } finally {
    // Cleanup oracle: the row is removed, and its removal is verified.
    expect(await callFavoriteApi("DELETE")).toBeLessThan(300);
  }

  expect(await readBack(), "favorite must be removed after cleanup").toBe(0);
});
