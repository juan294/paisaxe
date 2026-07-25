import { describe, expect, it } from "vitest";
import {
  buildAgentCliArgs,
  buildAgentUpdateBody,
  buildToolCliArgs,
} from "./elevenlabs-scoped-ops";

describe("Paisaxe-scoped ElevenLabs operations", () => {
  it("builds a targeted agent pull", () => {
    expect(
      buildAgentCliArgs("pull", {
        agent: "pelayo",
        branch: "agtbrch_2801kgqjhbhaf9097aka9qeek8qj",
        apply: false,
      })
    ).toEqual([
      "agents",
      "pull",
      "--agent",
      "agent_1201kgqhsdzxfkk9x7m1bjaew9mv",
      "--branch",
      "agtbrch_2801kgqjhbhaf9097aka9qeek8qj",
      "--update",
      "--dry-run",
      "--no-ui",
    ]);
  });

  it("uses a dry-run for status and refuses an unowned agent", () => {
    expect(
      buildAgentCliArgs("status", {
        agent: "xander",
        branch: "agtbrch_3701ks19j2yme6m9qedhx8bz808s",
        apply: false,
      })
    ).toContain("--dry-run");
    expect(() =>
      buildAgentCliArgs("status", {
        agent: "agent_roots",
        branch: "agtbrch_roots",
        apply: false,
      })
    ).toThrow(/Paisaxe/);
  });

  it("requires an explicit apply flag for writes", () => {
    expect(() =>
      buildAgentCliArgs("push", {
        agent: "pelayo",
        branch: "agtbrch_2801kgqjhbhaf9097aka9qeek8qj",
        apply: false,
      })
    ).toThrow(/--apply/);
  });

  it("targets exactly one registered webhook tool", () => {
    expect(
      buildToolCliArgs("pull", { tool: "get_weather", apply: false })
    ).toEqual([
      "tools",
      "pull",
      "--tool",
      "tool_7901kgqhsetben3bbbg4p360d987",
      "--update",
      "--dry-run",
      "--no-ui",
    ]);
    expect(() =>
      buildToolCliArgs("push", { tool: "roots_tool", apply: true })
    ).toThrow(/Paisaxe/);
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
});
