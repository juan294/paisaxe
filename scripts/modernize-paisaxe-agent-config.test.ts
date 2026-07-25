import { describe, expect, it } from "vitest";

import {
  modernizeConfig,
  type PaisaxeConfig,
} from "./modernize-paisaxe-agent-config";

function config(): PaisaxeConfig {
  return {
    conversation_config: {
      agent: { prompt: { prompt: "# Role\n\nBe helpful." } },
      tts: {
        model_id: "eleven_multilingual_v2",
        expressive_mode: false,
      },
      language_presets: {
        de: { overrides: { agent: { first_message: "Hallo" } } },
        en: { overrides: { agent: { first_message: "Hello" } } },
        fr: { overrides: { agent: { first_message: "Bonjour" } } },
        it: { overrides: { agent: { first_message: "Ciao" } } },
        pt: { overrides: { agent: { first_message: "Olá" } } },
        "pt-br": { overrides: { agent: { first_message: "Oi" } } },
      },
    },
    platform_settings: {
      guardrails: {
        focus: { is_enabled: false },
        prompt_injection: { is_enabled: false },
      },
    },
  };
}

describe("modernizeConfig", () => {
  it("keeps focus and prompt-injection as isolated revisions", () => {
    const focused = modernizeConfig(config(), "booking", "focus");
    expect(focused.platform_settings.guardrails.focus.is_enabled).toBe(true);
    expect(
      focused.platform_settings.guardrails.prompt_injection.is_enabled,
    ).toBe(false);

    const reverted = modernizeConfig(focused, "pelayo", "focus-off");
    expect(reverted.platform_settings.guardrails.focus.is_enabled).toBe(false);

    const protectedConfig = modernizeConfig(
      focused,
      "booking",
      "prompt-injection",
    );
    expect(protectedConfig.platform_settings.guardrails.focus.is_enabled).toBe(
      true,
    );
    expect(
      protectedConfig.platform_settings.guardrails.prompt_injection.is_enabled,
    ).toBe(true);
  });

  it("retains only workspace-resolvable language voices", () => {
    const updated = modernizeConfig(config(), "pelayo", "native-voices");
    expect(Object.keys(updated.conversation_config.language_presets)).toEqual([
      "en",
      "fr",
      "pt-br",
    ]);
    expect(
      updated.conversation_config.language_presets.en.overrides.tts?.voice_id,
    ).toBe("7EzWGsX10sAS4c9m9cPf");
    expect(
      updated.conversation_config.language_presets.fr.overrides.tts?.voice_id,
    ).toBe("YxrwjAKoUKULGd0g8K9Y");
    expect(
      updated.conversation_config.language_presets["pt-br"].overrides.tts
        ?.voice_id,
    ).toBe("oJebhZNaPllxk6W0LSBA");
  });

  it("enables the conversational v3 model without changing pacing", () => {
    const original = config();
    const updated = modernizeConfig(original, "penny", "v3");
    expect(updated.conversation_config.tts.model_id).toBe(
      "eleven_v3_conversational",
    );
    expect(updated.conversation_config.tts.expressive_mode).toBe(true);
    expect(original.conversation_config.tts.model_id).toBe(
      "eleven_multilingual_v2",
    );
  });

  it("adds the booking state machine once", () => {
    const first = modernizeConfig(config(), "pelayo", "booking-confirmation");
    const second = modernizeConfig(
      first,
      "pelayo",
      "booking-confirmation",
    );
    expect(second.conversation_config.agent.prompt.prompt).toMatch(
      /^# Critical booking confirmation/,
    );
    expect(
      second.conversation_config.agent.prompt.prompt.match(
        /# Critical booking confirmation/g,
      ),
    ).toHaveLength(1);
  });

  it("reduces Pelayo variance without changing the LLM", () => {
    const original = config();
    original.conversation_config.agent.prompt = {
      ...original.conversation_config.agent.prompt,
      llm: "gemini-2.5-flash-lite",
      temperature: 0.65,
    };
    const updated = modernizeConfig(
      original,
      "pelayo",
      "booking-temperature",
    );
    expect(updated.conversation_config.agent.prompt.temperature).toBe(0.2);
    expect(updated.conversation_config.agent.prompt.llm).toBe(
      "gemini-2.5-flash-lite",
    );
  });

  it("upgrades only Pelayo's LLM after the lite model fails the hard gate", () => {
    const original = config();
    original.conversation_config.agent.prompt = {
      ...original.conversation_config.agent.prompt,
      llm: "gemini-2.5-flash-lite",
      temperature: 0.2,
    };
    const updated = modernizeConfig(original, "pelayo", "booking-llm");
    expect(updated.conversation_config.agent.prompt.llm).toBe(
      "gemini-2.5-flash",
    );
    expect(updated.conversation_config.agent.prompt.temperature).toBe(0.2);
  });

  it("can trial the current Gemini Flash model on a branch", () => {
    const updated = modernizeConfig(config(), "pelayo", "llm-v35");
    expect(updated.conversation_config.agent.prompt.llm).toBe(
      "gemini-3.5-flash",
    );
  });

  it("can isolate a cross-provider reliability trial", () => {
    const updated = modernizeConfig(config(), "pelayo", "llm-gpt4o-mini");
    expect(updated.conversation_config.agent.prompt.llm).toBe("gpt-4o-mini");
  });
});
