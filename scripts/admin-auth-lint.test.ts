import { requiredValue } from "../src/test/required-value";
// @vitest-environment node
import { describe, it, expect } from "vitest";
import { ESLint } from "eslint";

const eslint = new ESLint();
describe("admin route authorization import boundary", () => {
  for (const file of ["src/app/api/admin/example/route.ts", "src/app/api/admin/nested/example/route.ts", "src/lib/local-operations/agents.ts", "src/lib/local-operations/tunnel.ts"]) {
    it(`rejects direct runtime validator import in ${file}`, async () => {
      const [result] = await eslint.lintText('import { validateAdminAuth } from "@/lib/admin-auth"; export const GET = validateAdminAuth;', {filePath: file});
      expect(requiredValue(result, "ESLint result").messages).toEqual(expect.arrayContaining([expect.objectContaining({ruleId: "no-restricted-imports", severity: 2})]));
    });
  }
  for (const file of ["src/lib/admin-auth.ts", "src/app/api/admin/example/route.test.ts"]) {
    it(`permits implementation/test imports in ${file}`, async () => {
      const [result] = await eslint.lintText('import { validateAdminAuth } from "@/lib/admin-auth"; export const probe = validateAdminAuth;', {filePath: file});
      expect(requiredValue(result, "ESLint result").messages.filter(message => message.ruleId === "no-restricted-imports")).toEqual([]);
    });
  }
  it("permits the enforced wrappers in runtime routes", async () => {
    const [result] = await eslint.lintText('import { withAdmin } from "@/lib/admin-auth"; export const GET = withAdmin;', {filePath: "src/app/api/admin/example/route.ts"});
    expect(requiredValue(result, "ESLint result").errorCount).toBe(0);
  });
});
