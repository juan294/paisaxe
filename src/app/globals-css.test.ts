import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf-8");

describe("Tailwind sources", () => {
  it("keeps the Claude Design sync inputs out of the app CSS", () => {
    // Tailwind v4 scans every committed file; .design-sync/ holds previews and docs
    // whose classes (including the ones its docs list as absent) must not ship.
    expect(read("src/app/globals.css")).toContain('@source not "../../.design-sync";');
  });

  it("shares the base styles between the app and the design-sync stylesheet", () => {
    expect(read("src/app/globals.css")).toContain('@import "./base.css";');
    const ds = read(".design-sync/tailwind.css");
    expect(ds).toContain('@import "../src/app/base.css";');
    // Importing globals.css would inherit its .design-sync exclusion and drop the previews.
    expect(ds).not.toMatch(/@import\s+"[^"]*globals\.css"/);
  });
});
