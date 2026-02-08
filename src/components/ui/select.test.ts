import { describe, it, expect } from "vitest";
import * as SelectModule from "./select";

describe("select.tsx exports", () => {
  const exportedNames = Object.keys(SelectModule);

  it("should export Select", () => {
    expect(exportedNames).toContain("Select");
  });

  it("should export SelectValue", () => {
    expect(exportedNames).toContain("SelectValue");
  });

  it("should export SelectTrigger", () => {
    expect(exportedNames).toContain("SelectTrigger");
  });

  it("should export SelectContent", () => {
    expect(exportedNames).toContain("SelectContent");
  });

  it("should export SelectItem", () => {
    expect(exportedNames).toContain("SelectItem");
  });

  it("should NOT export SelectGroup (unused)", () => {
    expect(exportedNames).not.toContain("SelectGroup");
  });

  it("should NOT export SelectLabel (unused)", () => {
    expect(exportedNames).not.toContain("SelectLabel");
  });

  it("should NOT export SelectSeparator (unused)", () => {
    expect(exportedNames).not.toContain("SelectSeparator");
  });

  it("should NOT export SelectScrollUpButton (unused)", () => {
    expect(exportedNames).not.toContain("SelectScrollUpButton");
  });

  it("should NOT export SelectScrollDownButton (unused)", () => {
    expect(exportedNames).not.toContain("SelectScrollDownButton");
  });
});
