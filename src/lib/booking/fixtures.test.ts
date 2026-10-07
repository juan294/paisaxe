// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FIXTURE_EXPERIENCE_SLUGS, FIXTURE_MERCHANT_SLUG, FIXTURE_OPERATOR_ACCESS_ID } from "./fixtures";

const seedSql = readFileSync(
  join(process.cwd(), "supabase/migrations/116_operator_access_and_fixture.sql"),
  "utf8"
);

describe("fixture constants match the seed in migration 116", () => {
  it("names the seeded merchant, experiences and operator access row", () => {
    expect(seedSql).toContain(`'${FIXTURE_MERCHANT_SLUG}'`);
    for (const slug of Object.values(FIXTURE_EXPERIENCE_SLUGS)) {
      expect(seedSql).toContain(`'${slug}'`);
    }
    expect(seedSql).toContain(`'${FIXTURE_OPERATOR_ACCESS_ID}'`);
  });

  it("labels the merchant as fictitious and fixture data", () => {
    expect(seedSql).toMatch(/'Rutas del Sella \(demo, ficticio\)'/);
    expect(seedSql).toMatch(/'Europe\/Madrid', 24, true\)/);
  });
});
