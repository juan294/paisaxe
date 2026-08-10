#!/usr/bin/env tsx

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface PaisaxeConfig extends Record<string, unknown> {
  conversation_config: {
    agent: {
      prompt: {
        prompt: string;
        temperature?: number;
        llm?: string;
        [key: string]: unknown;
      };
    };
    tts: {
      model_id: string;
      expressive_mode: boolean;
      [key: string]: unknown;
    };
    language_presets: Record<
      string,
      {
        overrides: Record<string, unknown> & {
          agent?: { first_message?: string; [key: string]: unknown };
          tts?: { voice_id: string; [key: string]: unknown };
        };
        [key: string]: unknown;
      }
    >;
    [key: string]: unknown;
  };
  platform_settings: {
    guardrails: {
      focus: { is_enabled: boolean };
      prompt_injection: { is_enabled: boolean };
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
}

export const BRANCH_CONFIGS = {
  pelayo:
    "agent_configs/Paisaxe-Pelayo-(Visitor-Guide).agtbrch_1601kydfmhhgex7rmdakv76nbhpa.json",
  booking:
    "agent_configs/Paisaxe-Pelayo-(Booking).agtbrch_3601kydfmjcbfx9s6wbz7xgz6w9w.json",
  penny:
    "agent_configs/Paisaxe-Penny-(Pinterest).agtbrch_2801kydfmk2xf8fre1n90msb5z6e.json",
  iris:
    "agent_configs/Paisaxe-Iris-(Instagram).agtbrch_8301kydfmkwmfavt22z6e96cmwhe.json",
  xander:
    "agent_configs/Paisaxe-Xander-(X).agtbrch_3701kydfmmkzfpbtry6mq7mn7bq4.json",
} as const;

export type PaisaxeAgent = keyof typeof BRANCH_CONFIGS;
export type ModernizationStage =
  | "booking-confirmation"
  | "booking-temperature"
  | "booking-llm"
  | "llm-v35"
  | "llm-gpt4o-mini"
  | "focus"
  | "focus-off"
  | "prompt-injection"
  | "native-voices"
  | "v3";

const BOOKING_CONFIRMATION_RULE = `# Critical booking confirmation

For every restaurant booking, use this state machine:
1. Collect venue name, restaurant phone, party size, date, time, customer full name, and customer phone.
2. When all seven fields are present, your entire next turn must summarize the venue, party size, date, time, and customer name, then ask "¿Correcto?".
3. Stop after that question. Do not call make_booking until the user explicitly confirms.
4. After confirmation, call make_booking before speaking again.

Never begin a confirmation and leave it incomplete. Never claim the restaurant confirmed a booking; a successful tool call only means the phone call was initiated and the user will receive the final outcome by SMS.

`;

export function modernizeConfig(
  config: PaisaxeConfig,
  agent: PaisaxeAgent,
  stage: ModernizationStage,
): PaisaxeConfig {
  const next = structuredClone(config);

  if (stage === "booking-confirmation") {
    if (agent !== "pelayo") {
      throw new Error("The booking confirmation correction only applies to Pelayo.");
    }
    const prompt = next.conversation_config.agent.prompt.prompt as string;
    if (!prompt.startsWith(BOOKING_CONFIRMATION_RULE)) {
      next.conversation_config.agent.prompt.prompt =
        BOOKING_CONFIRMATION_RULE + prompt;
    }
  }

  if (stage === "booking-temperature") {
    if (agent !== "pelayo") {
      throw new Error("The booking temperature correction only applies to Pelayo.");
    }
    next.conversation_config.agent.prompt.temperature = 0.2;
  }

  if (stage === "booking-llm") {
    if (agent !== "pelayo") {
      throw new Error("The booking LLM correction only applies to Pelayo.");
    }
    next.conversation_config.agent.prompt.llm = "gemini-2.5-flash";
  }

  if (stage === "llm-v35") {
    next.conversation_config.agent.prompt.llm = "gemini-3.5-flash";
  }

  if (stage === "llm-gpt4o-mini") {
    next.conversation_config.agent.prompt.llm = "gpt-4o-mini";
  }

  if (stage === "focus") {
    next.platform_settings.guardrails.focus.is_enabled = true;
  }

  if (stage === "focus-off") {
    next.platform_settings.guardrails.focus.is_enabled = false;
  }

  if (stage === "prompt-injection") {
    next.platform_settings.guardrails.prompt_injection.is_enabled = true;
  }

  if (stage === "native-voices") {
    if (agent !== "pelayo") {
      throw new Error("Language-specific voices only apply to Pelayo Visitor.");
    }
    const presets = next.conversation_config.language_presets;
    next.conversation_config.language_presets = {
      en: {
        ...presets.en,
        overrides: {
          ...presets.en.overrides,
          tts: { voice_id: "7EzWGsX10sAS4c9m9cPf" },
        },
      },
      fr: {
        ...presets.fr,
        overrides: {
          ...presets.fr.overrides,
          tts: { voice_id: "YxrwjAKoUKULGd0g8K9Y" },
        },
      },
      "pt-br": {
        ...presets["pt-br"],
        overrides: {
          ...presets["pt-br"].overrides,
          tts: { voice_id: "oJebhZNaPllxk6W0LSBA" },
        },
      },
    };
  }

  if (stage === "v3") {
    next.conversation_config.tts.model_id = "eleven_v3_conversational";
    next.conversation_config.tts.expressive_mode = true;
  }

  return next;
}

function main(): void {
  const [agentArg, stageArg] = process.argv.slice(2);
  if (!(agentArg in BRANCH_CONFIGS)) {
    throw new Error(`Unknown Paisaxe agent: ${agentArg ?? "(missing)"}`);
  }
  const allowedStages: ModernizationStage[] = [
    "booking-confirmation",
    "booking-temperature",
    "booking-llm",
    "llm-v35",
    "llm-gpt4o-mini",
    "focus",
    "focus-off",
    "prompt-injection",
    "native-voices",
    "v3",
  ];
  if (!allowedStages.includes(stageArg as ModernizationStage)) {
    throw new Error(`Unknown modernization stage: ${stageArg ?? "(missing)"}`);
  }

  const repositoryRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
  );
  const agent = agentArg as PaisaxeAgent;
  const stage = stageArg as ModernizationStage;
  const configPath = path.join(repositoryRoot, BRANCH_CONFIGS[agent]);
  const config = JSON.parse(
    fs.readFileSync(configPath, "utf8"),
  ) as PaisaxeConfig;
  const updated = modernizeConfig(config, agent, stage);
  fs.writeFileSync(configPath, `${JSON.stringify(updated, null, 4)}\n`);
  process.stdout.write(`Updated ${agent} modernization branch for ${stage}.\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
