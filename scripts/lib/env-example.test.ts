// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parseEnvExampleKeys } from "./env-example";

describe("parseEnvExampleKeys", () => {
  it("preserves active and optional key syntax without interpreting values", () => {
    const content = [
      "  ACTIVE_KEY = $OTHER=a=b # value  ",
      "EMPTY=", "DUPLICATE=first", "DUPLICATE=second",
      " # OPTIONAL_SECRET = $TOKEN== ", "# SECOND_TOKEN=",
      "lowercase=value", "$ACTIVE_KEY=value", "strange key=value",
      "=value", "   ", "#OPTIONAL_KEY=value", "## HIDDEN_KEY=value",
      "# lowercase=value", "# $COMMENT_KEY=value", "# prose with spaces=value",
      "NO_EQUALS", "# NO_EQUALS",
    ].join("\r\n");
    expect([...parseEnvExampleKeys(content)]).toEqual([
      "ACTIVE_KEY", "EMPTY", "DUPLICATE", "OPTIONAL_SECRET", "SECOND_TOKEN",
      "lowercase", "$ACTIVE_KEY", "strange key",
    ]);
  });

  it("returns fresh independent sets, including empty content", () => {
    const first = parseEnvExampleKeys("A=1");
    first.add("INJECTED");
    expect([...parseEnvExampleKeys("A=2")]).toEqual(["A"]);
    expect(parseEnvExampleKeys("")).toEqual(new Set());
    expect(parseEnvExampleKeys("\r\n  # comment  \r\n")).toEqual(new Set());
  });
});
