import { describe, it, expect } from "vitest";
import {
  AGENT_PROMPT_DEFAULTS,
  SHARED_CONTEXT_READ_INSTRUCTION,
  SHARED_CONTEXT_WRITE_INSTRUCTION,
  type AgentPromptConfig,
} from "./agent-prompts";

describe("AGENT_PROMPT_DEFAULTS", () => {
  const agentKeys = Object.keys(AGENT_PROMPT_DEFAULTS);

  it("has at least one agent configured", () => {
    expect(agentKeys.length).toBeGreaterThan(0);
  });

  it("all agents have non-empty prompt", () => {
    for (const key of agentKeys) {
      const config: AgentPromptConfig = AGENT_PROMPT_DEFAULTS[key];
      expect(config.prompt.trim().length, `${key} has empty prompt`).toBeGreaterThan(0);
    }
  });

  it("all agents have non-empty schedule", () => {
    for (const key of agentKeys) {
      const config: AgentPromptConfig = AGENT_PROMPT_DEFAULTS[key];
      expect(config.schedule.trim().length, `${key} has empty schedule`).toBeGreaterThan(0);
    }
  });

  it("all agents have non-empty outputFile", () => {
    for (const key of agentKeys) {
      const config: AgentPromptConfig = AGENT_PROMPT_DEFAULTS[key];
      expect(config.outputFile.trim().length, `${key} has empty outputFile`).toBeGreaterThan(0);
    }
  });

  it("no whitespace-only system prompts", () => {
    for (const key of agentKeys) {
      const config: AgentPromptConfig = AGENT_PROMPT_DEFAULTS[key];
      // A prompt that is only whitespace (spaces, newlines, tabs)
      expect(config.prompt.trim(), `${key} prompt is whitespace-only`).not.toBe("");
    }
  });

  it("agent keys are unique (implicit in Record, but verify shape)", () => {
    // Since AGENT_PROMPT_DEFAULTS is a Record, keys are unique by definition.
    // But verify that no two agents share the same outputFile (which would overwrite reports).
    const outputFiles = agentKeys.map((k) => AGENT_PROMPT_DEFAULTS[k].outputFile);
    const uniqueOutputFiles = new Set(outputFiles);
    expect(uniqueOutputFiles.size).toBe(outputFiles.length);
  });

  it("all output files end with .md", () => {
    for (const key of agentKeys) {
      const config: AgentPromptConfig = AGENT_PROMPT_DEFAULTS[key];
      expect(config.outputFile, `${key} outputFile should end with .md`).toMatch(/\.md$/);
    }
  });

  it("all agent keys follow the naming convention (ending with _enabled)", () => {
    for (const key of agentKeys) {
      expect(key, `${key} should end with _enabled`).toMatch(/_enabled$/);
    }
  });

  it("contains the expected set of agents", () => {
    expect(agentKeys).toContain("qa_agent_enabled");
    expect(agentKeys).toContain("coverage_agent_enabled");
    expect(agentKeys).toContain("security_agent_enabled");
    expect(agentKeys).toContain("documentation_agent_enabled");
    expect(agentKeys).toContain("performance_agent_enabled");
    expect(agentKeys).toContain("cost_analyst_agent_enabled");
    expect(agentKeys).toContain("localization_agent_enabled");
  });

  it("snapshot of config structure", () => {
    // Snapshot the keys and structure (not full prompts, as they're long and change often)
    const structure = Object.fromEntries(
      agentKeys.map((key) => [
        key,
        {
          schedule: AGENT_PROMPT_DEFAULTS[key].schedule,
          outputFile: AGENT_PROMPT_DEFAULTS[key].outputFile,
          promptLength: AGENT_PROMPT_DEFAULTS[key].prompt.length,
        },
      ])
    );

    expect(structure).toMatchInlineSnapshot(`
      {
        "cost_analyst_agent_enabled": {
          "outputFile": "docs/agents/cost-analyst-report.md",
          "promptLength": 3638,
          "schedule": "Daily at 3:00 AM",
        },
        "coverage_agent_enabled": {
          "outputFile": "docs/agents/coverage-report.md",
          "promptLength": 823,
          "schedule": "Daily at 2:00 AM",
        },
        "documentation_agent_enabled": {
          "outputFile": "docs/agents/documentation-report.md",
          "promptLength": 1056,
          "schedule": "Weekly on Sunday at 6:00 AM",
        },
        "localization_agent_enabled": {
          "outputFile": "docs/agents/localization-report.md",
          "promptLength": 2322,
          "schedule": "Weekly on Sunday at 7:00 AM",
        },
        "performance_agent_enabled": {
          "outputFile": "docs/agents/performance-report.md",
          "promptLength": 1326,
          "schedule": "Weekly on Saturday at 10:00 AM",
        },
        "qa_agent_enabled": {
          "outputFile": "docs/agents/qa-report.md",
          "promptLength": 2395,
          "schedule": "Weekly on Sunday at 8:00 AM",
        },
        "security_agent_enabled": {
          "outputFile": "docs/agents/security-report.md",
          "promptLength": 2437,
          "schedule": "Weekly on Monday at 9:00 AM",
        },
      }
    `);
  });
});

describe("shared context instructions", () => {
  it("SHARED_CONTEXT_READ_INSTRUCTION is a non-empty string", () => {
    expect(typeof SHARED_CONTEXT_READ_INSTRUCTION).toBe("string");
    expect(SHARED_CONTEXT_READ_INSTRUCTION.trim().length).toBeGreaterThan(0);
  });

  it("SHARED_CONTEXT_WRITE_INSTRUCTION is a non-empty string", () => {
    expect(typeof SHARED_CONTEXT_WRITE_INSTRUCTION).toBe("string");
    expect(SHARED_CONTEXT_WRITE_INSTRUCTION.trim().length).toBeGreaterThan(0);
  });

  it("SHARED_CONTEXT_WRITE_INSTRUCTION contains required markers", () => {
    expect(SHARED_CONTEXT_WRITE_INSTRUCTION).toContain("SHARED_CONTEXT_START");
    expect(SHARED_CONTEXT_WRITE_INSTRUCTION).toContain("SHARED_CONTEXT_END");
  });
});
