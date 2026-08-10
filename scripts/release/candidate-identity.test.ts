// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  extractDeployedCommit,
  healthUrl,
  releaseIdentityHeaders,
  resolveTreeWithGit,
  runCli,
  verifyCandidateIdentity,
  type HealthProbeResult,
} from "./candidate-identity";

const EXPECTED_TREE = "95a62c4be18d9b222187b88a450ba02bcc664365";
const OTHER_TREE = "0123456789abcdef0123456789abcdef01234567";
const DEPLOYED_COMMIT = "9411eada1c2b3d4e5f60718293a4b5c6d7e8f901";

function healthy(build: unknown): HealthProbeResult {
  return { status: 200, body: { status: "healthy", build } };
}

function deps(overrides: {
  tree?: string;
  probe?: HealthProbeResult;
  resolveTree?: (ref: string) => string;
}) {
  return {
    resolveTree: overrides.resolveTree ?? (() => overrides.tree ?? EXPECTED_TREE),
    fetchHealth: vi
      .fn()
      .mockResolvedValue(
        overrides.probe ?? healthy({ commit: DEPLOYED_COMMIT, tree: "unused" })
      ),
  };
}

describe("healthUrl", () => {
  it("points at /api/health and drops query and hash", () => {
    expect(healthUrl("https://paisaxe.es/stories?a=1#top")).toBe(
      "https://paisaxe.es/api/health"
    );
  });
});

describe("releaseIdentityHeaders", () => {
  it("authorizes with CRON_SECRET", () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    vi.stubEnv("VERCEL_AUTOMATION_BYPASS_SECRET", "");

    expect(releaseIdentityHeaders()).toEqual({
      authorization: "Bearer s3cret",
    });

    vi.unstubAllEnvs();
  });

  it("adds the Vercel protection bypass for preview deployments", () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    vi.stubEnv("VERCEL_AUTOMATION_BYPASS_SECRET", "bypass");

    expect(releaseIdentityHeaders()["x-vercel-protection-bypass"]).toBe("bypass");

    vi.unstubAllEnvs();
  });

  it("refuses to probe without CRON_SECRET rather than reporting a false 'no identity'", () => {
    vi.stubEnv("CRON_SECRET", "");

    expect(() => releaseIdentityHeaders()).toThrow(/CRON_SECRET is not set/);

    vi.unstubAllEnvs();
  });
});

describe("resolveTreeWithGit", () => {
  it("resolves a real ref to a 40-character tree hash", () => {
    expect(resolveTreeWithGit("HEAD")).toMatch(/^[0-9a-f]{40}$/);
  });

  it("throws on an unknown ref rather than returning an empty hash", () => {
    expect(() => resolveTreeWithGit("definitely-not-a-ref")).toThrow();
  });
});

describe("extractDeployedCommit", () => {
  it("returns the reported commit", () => {
    expect(extractDeployedCommit(healthy({ commit: DEPLOYED_COMMIT }))).toBe(
      DEPLOYED_COMMIT
    );
  });

  it("fails closed when the deployment reports no identity at all", () => {
    expect(() =>
      extractDeployedCommit({ status: 200, body: { status: "healthy" } })
    ).toThrow(/no build identity/);
  });

  it("fails closed when build.commit is missing", () => {
    expect(() => extractDeployedCommit(healthy({ tree: EXPECTED_TREE }))).toThrow(
      /no build.commit/
    );
  });

  it('fails closed when the deployment reports commit "unknown"', () => {
    expect(() => extractDeployedCommit(healthy({ commit: "unknown" }))).toThrow(
      /unknown/
    );
  });

  it("fails closed on a non-200 health response", () => {
    expect(() =>
      extractDeployedCommit({ status: 503, body: { status: "degraded" } })
    ).toThrow(/HTTP 503/);
  });
});

describe("verifyCandidateIdentity", () => {
  it("passes when the deployed tree equals the candidate tree", async () => {
    const result = await verifyCandidateIdentity(
      { expectedTree: EXPECTED_TREE, url: "https://paisaxe.es" },
      deps({ tree: EXPECTED_TREE })
    );

    expect(result).toEqual({
      deployedCommit: DEPLOYED_COMMIT,
      deployedTree: EXPECTED_TREE,
      expectedTree: EXPECTED_TREE,
    });
  });

  it("resolves the tree from the commit the deployment reported", async () => {
    const resolveTree = vi.fn().mockReturnValue(EXPECTED_TREE);

    await verifyCandidateIdentity(
      { expectedTree: EXPECTED_TREE, url: "https://paisaxe.es" },
      deps({ resolveTree })
    );

    expect(resolveTree).toHaveBeenCalledWith(DEPLOYED_COMMIT);
  });

  it("rejects a tree mismatch", async () => {
    await expect(
      verifyCandidateIdentity(
        { expectedTree: EXPECTED_TREE, url: "https://paisaxe.es" },
        deps({ tree: OTHER_TREE })
      )
    ).rejects.toThrow(/does not match the candidate/);
  });

  it("rejects an --expected value that is not a full tree hash", async () => {
    await expect(
      verifyCandidateIdentity(
        { expectedTree: "HEAD", url: "https://paisaxe.es" },
        deps({})
      )
    ).rejects.toThrow(/full 40-character tree hash/);
  });

  it("fails closed when the deployed commit cannot be resolved locally", async () => {
    await expect(
      verifyCandidateIdentity(
        { expectedTree: EXPECTED_TREE, url: "https://paisaxe.es" },
        deps({
          resolveTree: () => {
            throw new Error("unknown revision");
          },
        })
      )
    ).rejects.toThrow(/Cannot resolve the tree/);
  });

  it("fails closed when the deployment reports no identity", async () => {
    await expect(
      verifyCandidateIdentity(
        { expectedTree: EXPECTED_TREE, url: "https://paisaxe.es" },
        deps({ probe: { status: 200, body: { status: "healthy" } } })
      )
    ).rejects.toThrow(/no build identity/);
  });
});

describe("runCli", () => {
  it("prints the tree hash for a ref and exits 0", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await expect(runCli(["node", "candidate-identity.ts", "--tree", "HEAD"])).resolves.toBe(0);
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/^[0-9a-f]{40}$/));

    log.mockRestore();
  });

  it("exits non-zero when no mode is given", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(runCli(["node", "candidate-identity.ts"])).resolves.toBe(1);

    error.mockRestore();
  });

  it("exits non-zero when --verify is missing --expected or --url", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      runCli(["node", "candidate-identity.ts", "--verify", "--url", "https://paisaxe.es"])
    ).resolves.toBe(1);

    error.mockRestore();
  });

  it("exits non-zero when a flag is missing its value", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      runCli(["node", "candidate-identity.ts", "--tree"])
    ).resolves.toBe(1);

    error.mockRestore();
  });
});
