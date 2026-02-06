import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { translateStory, parseTranslationResponse, buildTranslationPrompt, updateStoryTranslation, getStoryTranslations } from "./translate-story";
import type { StoryTranslation } from "@/types/immersive";

// Mock the claude module
vi.mock("./claude", () => ({
  callAnthropicAPI: vi.fn(),
}));

// Mock Supabase client
vi.mock("./supabase", () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(),
          })),
        })),
      })),
    })),
  })),
}));

describe("translate-story", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("buildTranslationPrompt", () => {
    it("should build a prompt with story content for all 5 locales", () => {
      const story = {
        title: "Lagos de Covadonga",
        subtitle: "Paraíso glaciar en los Picos de Europa",
        description: "Dos lagos de origen glaciar rodeados de montañas.",
      };

      const prompt = buildTranslationPrompt(story);

      // Should contain the Spanish content
      expect(prompt).toContain("Lagos de Covadonga");
      expect(prompt).toContain("Paraíso glaciar en los Picos de Europa");
      expect(prompt).toContain("Dos lagos de origen glaciar");

      // Should request all 5 locales
      expect(prompt).toContain('"en"');
      expect(prompt).toContain('"fr"');
      expect(prompt).toContain('"de"');
      expect(prompt).toContain('"pt"');
      expect(prompt).toContain('"ast"');

      // Should request JSON format
      expect(prompt).toContain("JSON");
    });

    it("should handle empty subtitle and description", () => {
      const story = {
        title: "Test Title",
        subtitle: "",
        description: "",
      };

      const prompt = buildTranslationPrompt(story);
      expect(prompt).toContain("Test Title");
    });
  });

  describe("parseTranslationResponse", () => {
    it("should parse valid JSON response with all locales", () => {
      const responseText = JSON.stringify({
        en: {
          title: "Lakes of Covadonga",
          subtitle: "Glacial paradise in the Picos de Europa",
          description: "Two glacial lakes surrounded by mountains.",
        },
        fr: {
          title: "Lacs de Covadonga",
          subtitle: "Paradis glaciaire dans les Picos de Europa",
          description: "Deux lacs glaciaires entourés de montagnes.",
        },
        de: {
          title: "Seen von Covadonga",
          subtitle: "Gletscherparadies in den Picos de Europa",
          description: "Zwei Gletscherseen umgeben von Bergen.",
        },
        pt: {
          title: "Lagos de Covadonga",
          subtitle: "Paraíso glacial nos Picos da Europa",
          description: "Dois lagos de origem glacial rodeados de montanhas.",
        },
        ast: {
          title: "Llagos de Cuadonga",
          subtitle: "Paraísu glaciar nos Picos d'Europa",
          description: "Dos llagos d'orixe glaciar arrodiaos de montes.",
        },
      });

      const result = parseTranslationResponse(responseText);

      expect(result.success).toBe(true);
      expect(result.translations).toBeDefined();
      expect(result.translations?.en?.title).toBe("Lakes of Covadonga");
      expect(result.translations?.fr?.title).toBe("Lacs de Covadonga");
      expect(result.translations?.de?.title).toBe("Seen von Covadonga");
      expect(result.translations?.pt?.title).toBe("Lagos de Covadonga");
      expect(result.translations?.ast?.title).toBe("Llagos de Cuadonga");
    });

    it("should handle JSON wrapped in markdown code block", () => {
      const responseText = `\`\`\`json
{
  "en": {
    "title": "Lakes of Covadonga",
    "subtitle": "Glacial paradise",
    "description": "Two glacial lakes."
  }
}
\`\`\``;

      const result = parseTranslationResponse(responseText);

      expect(result.success).toBe(true);
      expect(result.translations?.en?.title).toBe("Lakes of Covadonga");
    });

    it("should return error for invalid JSON", () => {
      const responseText = "This is not valid JSON";

      const result = parseTranslationResponse(responseText);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to parse");
    });

    it("should validate required fields for each translation", () => {
      const responseText = JSON.stringify({
        en: {
          title: "Valid Title",
          // Missing subtitle and description
        },
      });

      const result = parseTranslationResponse(responseText);

      // Should succeed but mark the translation as incomplete/invalid
      expect(result.success).toBe(true);
      // The EN translation should be present but potentially flagged
      expect(result.translations?.en).toBeDefined();
    });

    it("should handle partial translations gracefully", () => {
      const responseText = JSON.stringify({
        en: {
          title: "Lakes of Covadonga",
          subtitle: "Glacial paradise",
          description: "Two glacial lakes.",
        },
        fr: {
          title: "Lacs de Covadonga",
          subtitle: "Paradis glaciaire",
          description: "Deux lacs glaciaires.",
        },
        // Missing de, pt, ast
      });

      const result = parseTranslationResponse(responseText);

      expect(result.success).toBe(true);
      expect(result.translations?.en).toBeDefined();
      expect(result.translations?.fr).toBeDefined();
      expect(result.translations?.de).toBeUndefined();
    });
  });

  describe("translateStory", () => {
    it("should return error when story is not found", async () => {
      const { createAdminClient } = await import("./supabase");
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({ data: null, error: { message: "Not found" } }),
            })),
          })),
        })),
      };
      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as never);

      const result = await translateStory("non-existent-id");

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("should call Claude API with translation prompt", async () => {
      const { createAdminClient } = await import("./supabase");
      const { callAnthropicAPI } = await import("./claude");

      const mockStory = {
        id: "test-story-id",
        title: "Lagos de Covadonga",
        subtitle: "Paraíso glaciar",
        description: "Dos lagos de origen glaciar.",
        metadata: {},
      };

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "stories") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue({ data: mockStory, error: null }),
                })),
              })),
              update: vi.fn(() => ({
                eq: vi.fn(() => ({
                  select: vi.fn(() => ({
                    single: vi.fn().mockResolvedValue({ data: mockStory, error: null }),
                  })),
                })),
              })),
            };
          }
          return {};
        }),
      };
      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as never);

      const mockTranslations = {
        en: { title: "Lakes", subtitle: "Paradise", description: "Two lakes." },
        fr: { title: "Lacs", subtitle: "Paradis", description: "Deux lacs." },
        de: { title: "Seen", subtitle: "Paradies", description: "Zwei Seen." },
        pt: { title: "Lagos", subtitle: "Paraíso", description: "Dois lagos." },
        ast: { title: "Llagos", subtitle: "Paraísu", description: "Dos llagos." },
      };

      vi.mocked(callAnthropicAPI).mockResolvedValue({
        content: [{ type: "text", text: JSON.stringify(mockTranslations) }],
        id: "test",
        type: "message",
        role: "assistant",
        model: "claude-sonnet-4-20250514",
        stop_reason: "end_turn",
        stop_sequence: null,
        usage: { input_tokens: 100, output_tokens: 200 },
      } as never);

      const result = await translateStory("test-story-id");

      expect(callAnthropicAPI).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.results?.en?.success).toBe(true);
    });

    it("should only translate specified locales when provided", async () => {
      const { createAdminClient } = await import("./supabase");
      const { callAnthropicAPI } = await import("./claude");

      const mockStory = {
        id: "test-story-id",
        title: "Test Story",
        subtitle: "Test Subtitle",
        description: "Test Description",
        metadata: {},
      };

      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({ data: mockStory, error: null }),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({ data: mockStory, error: null }),
              })),
            })),
          })),
        })),
      };
      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as never);

      const mockTranslations = {
        en: { title: "Test", subtitle: "Sub", description: "Desc." },
      };

      vi.mocked(callAnthropicAPI).mockResolvedValue({
        content: [{ type: "text", text: JSON.stringify(mockTranslations) }],
        id: "test",
        type: "message",
        role: "assistant",
        model: "claude-sonnet-4-20250514",
        stop_reason: "end_turn",
        stop_sequence: null,
        usage: { input_tokens: 100, output_tokens: 200 },
      } as never);

      const result = await translateStory("test-story-id", { locales: ["en"] });

      expect(result.success).toBe(true);
      // Should only have requested EN translation
      const callArgs = vi.mocked(callAnthropicAPI).mock.calls[0];
      expect(callArgs[1][0].content).toContain('"en"');
    });

    it("should skip existing translations unless forceRetranslate is true", async () => {
      const { createAdminClient } = await import("./supabase");
      const { callAnthropicAPI } = await import("./claude");

      const existingTranslation: StoryTranslation = {
        title: "Existing Title",
        subtitle: "Existing Subtitle",
        description: "Existing Description",
      };

      const mockStory = {
        id: "test-story-id",
        title: "Test Story",
        subtitle: "Test Subtitle",
        description: "Test Description",
        metadata: {
          translations: {
            en: existingTranslation,
          },
          translation_status: {
            en: { status: "complete", updatedAt: new Date().toISOString() },
          },
        },
      };

      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({ data: mockStory, error: null }),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({ data: mockStory, error: null }),
              })),
            })),
          })),
        })),
      };
      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as never);

      // Request EN translation without forceRetranslate
      const result = await translateStory("test-story-id", { locales: ["en"] });

      // Should not call Claude API since translation exists
      expect(callAnthropicAPI).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.results?.en?.success).toBe(true);
    });

    it("should retranslate when forceRetranslate is true", async () => {
      const { createAdminClient } = await import("./supabase");
      const { callAnthropicAPI } = await import("./claude");

      const mockStory = {
        id: "test-story-id",
        title: "Test Story",
        subtitle: "Test Subtitle",
        description: "Test Description",
        metadata: {
          translations: {
            en: { title: "Old", subtitle: "Old", description: "Old" },
          },
          translation_status: {
            en: { status: "complete", updatedAt: new Date().toISOString() },
          },
        },
      };

      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({ data: mockStory, error: null }),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({ data: mockStory, error: null }),
              })),
            })),
          })),
        })),
      };
      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as never);

      const mockTranslations = {
        en: { title: "New", subtitle: "New", description: "New" },
      };

      vi.mocked(callAnthropicAPI).mockResolvedValue({
        content: [{ type: "text", text: JSON.stringify(mockTranslations) }],
        id: "test",
        type: "message",
        role: "assistant",
        model: "claude-sonnet-4-20250514",
        stop_reason: "end_turn",
        stop_sequence: null,
        usage: { input_tokens: 100, output_tokens: 200 },
      } as never);

      const result = await translateStory("test-story-id", {
        locales: ["en"],
        forceRetranslate: true,
      });

      expect(callAnthropicAPI).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });
  });

  describe("updateStoryTranslation", () => {
    it("should return error when story is not found", async () => {
      const { createAdminClient } = await import("./supabase");
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({ data: null, error: { message: "Not found" } }),
            })),
          })),
        })),
      };
      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as never);

      const translation: StoryTranslation = {
        title: "Test Title",
        subtitle: "Test Subtitle",
        description: "Test Description",
      };

      const result = await updateStoryTranslation("non-existent", "en", translation);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Story not found");
    });

    it("should update translation successfully", async () => {
      const { createAdminClient } = await import("./supabase");
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: { metadata: { translations: {}, translation_status: {} } },
                error: null,
              }),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ error: null }),
          })),
        })),
      };
      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as never);

      const translation: StoryTranslation = {
        title: "Lakes of Covadonga",
        subtitle: "Glacial paradise",
        description: "Two glacial lakes.",
      };

      const result = await updateStoryTranslation("story-1", "en", translation);

      expect(result.success).toBe(true);
    });

    it("should return error when update fails", async () => {
      const { createAdminClient } = await import("./supabase");
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: { metadata: {} },
                error: null,
              }),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ error: { message: "Update failed" } }),
          })),
        })),
      };
      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as never);

      const translation: StoryTranslation = {
        title: "Test",
        subtitle: "Test",
        description: "Test",
      };

      const result = await updateStoryTranslation("story-1", "en", translation);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to update translation");
    });

    it("should handle story with no existing metadata", async () => {
      const { createAdminClient } = await import("./supabase");
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: { metadata: null },
                error: null,
              }),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ error: null }),
          })),
        })),
      };
      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as never);

      const translation: StoryTranslation = {
        title: "Test",
        subtitle: "Test",
        description: "Test",
      };

      const result = await updateStoryTranslation("story-1", "fr", translation);
      expect(result.success).toBe(true);
    });
  });

  describe("getStoryTranslations", () => {
    it("should return error when story is not found", async () => {
      const { createAdminClient } = await import("./supabase");
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({ data: null, error: { message: "Not found" } }),
            })),
          })),
        })),
      };
      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as never);

      const result = await getStoryTranslations("non-existent");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Story not found");
    });

    it("should return translations for a story", async () => {
      const { createAdminClient } = await import("./supabase");
      const enTranslation: StoryTranslation = {
        title: "Lakes of Covadonga",
        subtitle: "Glacial paradise",
        description: "Two glacial lakes.",
      };

      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: {
                  title: "Lagos de Covadonga",
                  subtitle: "Paraíso glaciar",
                  description: "Dos lagos de origen glaciar.",
                  metadata: {
                    translations: { en: enTranslation },
                    translation_status: { en: { status: "complete", updatedAt: "2024-01-01" } },
                    last_translated_at: "2024-01-01T00:00:00Z",
                  },
                },
                error: null,
              }),
            })),
          })),
        })),
      };
      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as never);

      const result = await getStoryTranslations("story-1");

      expect(result.success).toBe(true);
      expect(result.data?.original.title).toBe("Lagos de Covadonga");
      expect(result.data?.translations.en?.title).toBe("Lakes of Covadonga");
      expect(result.data?.status.en?.status).toBe("complete");
      expect(result.data?.lastTranslatedAt).toBe("2024-01-01T00:00:00Z");
    });

    it("should handle story with empty metadata", async () => {
      const { createAdminClient } = await import("./supabase");
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: {
                  title: "Test",
                  subtitle: null,
                  description: null,
                  metadata: null,
                },
                error: null,
              }),
            })),
          })),
        })),
      };
      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as never);

      const result = await getStoryTranslations("story-1");

      expect(result.success).toBe(true);
      expect(result.data?.original.title).toBe("Test");
      expect(result.data?.original.subtitle).toBe("");
      expect(result.data?.original.description).toBe("");
      expect(result.data?.translations).toEqual({});
      expect(result.data?.status).toEqual({});
    });
  });
});
