import { describe, expect, it } from "vitest";
import {
  extractTreeFromTagMessage,
  findDevelopCommitForTree,
  resolveShipBoundary,
} from "./what-would-ship";

describe("extractTreeFromTagMessage", () => {
  it("extracts the tree hash recorded in a release tag message", () => {
    const message =
      "v1.6.0          Release v1.6.0 (tree cfbd702979f83f043eee0c85c56dba5d018618b9)";

    expect(extractTreeFromTagMessage(message)).toBe(
      "cfbd702979f83f043eee0c85c56dba5d018618b9"
    );
  });

  it("returns undefined when no tree hash is present", () => {
    expect(extractTreeFromTagMessage("v1.6.0          some other message")).toBeUndefined();
  });
});

describe("findDevelopCommitForTree", () => {
  it("returns the develop commit whose tree matches", () => {
    const log = [
      "aaaa111 1111111111111111111111111111111111111111",
      "bbbb222 2222222222222222222222222222222222222222",
    ].join("\n");

    const commit = findDevelopCommitForTree({
      tree: "2222222222222222222222222222222222222222",
      readDevelopLog: () => log,
    });

    expect(commit).toBe("bbbb222");
  });

  it("returns undefined when no develop commit has that tree", () => {
    const log = "aaaa111 1111111111111111111111111111111111111111";

    const commit = findDevelopCommitForTree({
      tree: "ffffffffffffffffffffffffffffffffffffffffff".slice(0, 40),
      readDevelopLog: () => log,
    });

    expect(commit).toBeUndefined();
  });
});

describe("resolveShipBoundary", () => {
  it("bounds to the develop commit matching the last release tag's tree", () => {
    const result = resolveShipBoundary({
      findLastReleaseTag: () => "v1.6.0",
      readTagMessage: () => "Release v1.6.0 (tree 2222222222222222222222222222222222222222)",
      readDevelopLog: () =>
        "bbbb222 2222222222222222222222222222222222222222",
      findMergeBase: () => "should-not-be-used",
    });

    expect(result).toEqual({ boundary: "bbbb222", source: "last-release" });
  });

  it("falls back to merge-base when no release tag exists yet", () => {
    const result = resolveShipBoundary({
      findLastReleaseTag: () => undefined,
      readTagMessage: () => {
        throw new Error("should not be called");
      },
      readDevelopLog: () => "",
      findMergeBase: () => "mergebasecommit",
    });

    expect(result).toEqual({ boundary: "mergebasecommit", source: "merge-base" });
  });

  it("falls back to merge-base when the tag's tree has no matching develop commit", () => {
    const result = resolveShipBoundary({
      findLastReleaseTag: () => "v1.6.0",
      readTagMessage: () => "Release v1.6.0 (tree 2222222222222222222222222222222222222222)",
      readDevelopLog: () => "aaaa111 1111111111111111111111111111111111111111",
      findMergeBase: () => "mergebasecommit",
    });

    expect(result).toEqual({ boundary: "mergebasecommit", source: "merge-base" });
  });

  it("falls back to merge-base when the tag message has no parseable tree", () => {
    const result = resolveShipBoundary({
      findLastReleaseTag: () => "v1.6.0",
      readTagMessage: () => "v1.6.0 some non-standard message",
      readDevelopLog: () => "",
      findMergeBase: () => "mergebasecommit",
    });

    expect(result).toEqual({ boundary: "mergebasecommit", source: "merge-base" });
  });
});
