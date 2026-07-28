import { test, expect } from "./fixtures/auth";
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
  supabaseAdmin,
}) => {
  const page = authenticatedPage;

  const { data: story, error: storyError } = await supabaseAdmin
    .from("stories")
    .select("id")
    .limit(1)
    .single();

  if (storyError || !story) {
    throw new Error(
      `No story available to favorite: ${storyError?.message ?? "empty stories table"}. ` +
        "Seed the local stack (npm run seed-db) before running release probes."
    );
  }

  const storyId = story.id as string;

  // Read the session the auth fixture injected, and drive the real API from
  // inside the page — the same path the browser client takes.
  const accessToken = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.includes("auth-token"));
    return key ? JSON.parse(localStorage.getItem(key) as string).access_token : null;
  });
  expect(accessToken, "authenticated session must carry an access token").toBeTruthy();

  async function createFavorite(): Promise<number> {
    return page.evaluate(
      async ({ storyId, token }) => {
        const response = await fetch("/api/favorites", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ storyIds: [storyId] }),
        });
        return response.status;
      },
      { storyId, token: accessToken }
    );
  }

  // DELETE takes storyId as a query parameter, not a body.
  async function deleteFavorite(): Promise<number> {
    return page.evaluate(
      async ({ storyId, token }) => {
        const response = await fetch(
          `/api/favorites?storyId=${encodeURIComponent(storyId)}`,
          {
            method: "DELETE",
            headers: { authorization: `Bearer ${token}` },
          }
        );
        return response.status;
      },
      { storyId, token: accessToken }
    );
  }

  const userId = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.includes("auth-token"));
    return key ? JSON.parse(localStorage.getItem(key) as string).user.id : null;
  });
  expect(userId, "authenticated session must identify a user").toBeTruthy();

  async function readBack(): Promise<number> {
    const { count, error } = await supabaseAdmin
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
    expect(await createFavorite()).toBeLessThan(300);

    // Datastore oracle: the write is observed in Postgres, not inferred from
    // the HTTP response.
    expect(await readBack(), "favorite must exist in user_favorites").toBe(1);
  } finally {
    // Cleanup oracle: the row is removed, and its removal is verified.
    expect(await deleteFavorite()).toBeLessThan(300);
  }

  expect(await readBack(), "favorite must be removed after cleanup").toBe(0);
});
