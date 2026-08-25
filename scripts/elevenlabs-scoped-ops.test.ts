import { describe, expect, it } from "vitest";
import {
  buildAgentUpdateBody,
  buildAgentUrl,
  buildToolUrl,
  formatProviderFailure,
  runDirectAgentPull,
  runDirectToolPull,
} from "./elevenlabs-scoped-ops";

describe("Paisaxe-scoped ElevenLabs operations", () => {
  it("scopes an agent pull to the owned agent and pinned branch", () => {
    const url = buildAgentUrl(
      "agent_1201kgqhsdzxfkk9x7m1bjaew9mv",
      "agtbrch_2801kgqjhbhaf9097aka9qeek8qj"
    );
    expect(url.pathname).toBe(
      "/v1/convai/agents/agent_1201kgqhsdzxfkk9x7m1bjaew9mv"
    );
    expect(url.searchParams.get("branch_id")).toBe(
      "agtbrch_2801kgqjhbhaf9097aka9qeek8qj"
    );
  });

  it("refuses to pull an agent Paisaxe does not own", async () => {
    await expect(
      runDirectAgentPull({
        agent: "agent_roots",
        branch: "agtbrch_roots",
        apply: false,
      })
    ).rejects.toThrow(/Paisaxe/);
  });

  it("refuses to pull an agent onto an unpinned branch", async () => {
    await expect(
      runDirectAgentPull({
        agent: "pelayo",
        branch: "agtbrch_not_the_pinned_branch",
        apply: false,
      })
    ).rejects.toThrow(/does not match the Paisaxe agent manifest/);
  });

  it("targets exactly one registered webhook tool", async () => {
    expect(buildToolUrl("tool_7901kgqhsetben3bbbg4p360d987")).toBe(
      "https://api.elevenlabs.io/v1/convai/tools/tool_7901kgqhsetben3bbbg4p360d987"
    );
    await expect(
      runDirectToolPull({ tool: "roots_tool", apply: true })
    ).rejects.toThrow(/Paisaxe/);
  });

  it("puts the exact branch in direct agent update bodies", () => {
    expect(
      buildAgentUpdateBody(
        {
          name: "Pelayo",
          conversation_config: { agent: {} },
          platform_settings: { auth: {} },
          tags: ["paisaxe"],
        },
        "agtbrch_modernization"
      )
    ).toEqual({
      name: "Pelayo",
      conversation_config: { agent: {} },
      platform_settings: { auth: {} },
      workflow: undefined,
      tags: ["paisaxe"],
      version_description: "Paisaxe scoped configuration update",
    });
  });

  it("removes deprecated inline tools when tool IDs are present", () => {
    const body = buildAgentUpdateBody(
      {
        conversation_config: {
          agent: {
            prompt: {
              tool_ids: ["tool-1"],
              tools: [{ name: "deprecated" }],
            },
          },
        },
      },
      "agtbrch_modernization"
    );
    const conversationConfig = body.conversation_config as {
      agent: { prompt: Record<string, unknown> };
    };
    expect(conversationConfig.agent.prompt).toEqual({ tool_ids: ["tool-1"] });
  });

  it("reports provider failures without echoing response bodies", () => {
    const message = formatProviderFailure(
      "ElevenLabs agent update failed",
      400,
      "req-safe-123"
    );
    expect(message).toBe(
      "ElevenLabs agent update failed (400, request req-safe-123)."
    );
    expect(message).not.toContain("secret");
  });
});
