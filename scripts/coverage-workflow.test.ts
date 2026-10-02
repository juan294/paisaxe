// @vitest-environment node
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";

interface CoverageWorkflow {
  on?: { push?: { branches?: string[] } };
  jobs?: {
    coverage?: {
      steps?: Array<{
        name?: string;
        env?: Record<string, string>;
      }>;
    };
  };
}

describe("Coverage workflow default-branch contract", () => {
  const workflow = parse(
    readFileSync(".github/workflows/coverage.yml", "utf8")
  ) as CoverageWorkflow;

  it("runs and reports only the GitHub default branch", () => {
    expect(workflow.on?.push?.branches).toEqual(["main"]);

    const reportStep = workflow.jobs?.coverage?.steps?.find(
      (step) => step.name === "Report coverage to Portfolio"
    );
    expect(reportStep?.env?.SOURCE_TARGET_BRANCH).toBe("main");
  });
});
