import { describe, it, expect } from "vitest";
import { detectUpsellMarker, type UpsellReason } from "./chat-upsell-detection";

describe("chat-upsell-detection", () => {
  describe("detectUpsellMarker", () => {
    it("detects weather upsell marker", () => {
      const content = "I don't have access to real-time weather data. [[VOICE_UPSELL:weather]]";
      const result = detectUpsellMarker(content);

      expect(result.hasUpsell).toBe(true);
      expect(result.reason).toBe("weather");
      expect(result.cleanContent).toBe("I don't have access to real-time weather data.");
    });

    it("detects booking upsell marker", () => {
      const content = "I can't make reservations directly. [[VOICE_UPSELL:booking]]";
      const result = detectUpsellMarker(content);

      expect(result.hasUpsell).toBe(true);
      expect(result.reason).toBe("booking");
      expect(result.cleanContent).toBe("I can't make reservations directly.");
    });

    it("detects realtime upsell marker", () => {
      const content = "I don't have current opening hours. [[VOICE_UPSELL:realtime]]";
      const result = detectUpsellMarker(content);

      expect(result.hasUpsell).toBe(true);
      expect(result.reason).toBe("realtime");
      expect(result.cleanContent).toBe("I don't have current opening hours.");
    });

    it("detects slow_typing upsell marker", () => {
      const content = "Voice chat would be faster for this! [[VOICE_UPSELL:slow_typing]]";
      const result = detectUpsellMarker(content);

      expect(result.hasUpsell).toBe(true);
      expect(result.reason).toBe("slow_typing");
      expect(result.cleanContent).toBe("Voice chat would be faster for this!");
    });

    it("returns no upsell when marker is missing", () => {
      const content = "The Lakes of Covadonga are beautiful in any season.";
      const result = detectUpsellMarker(content);

      expect(result.hasUpsell).toBe(false);
      expect(result.reason).toBeNull();
      expect(result.cleanContent).toBe(content);
    });

    it("ignores invalid upsell reasons", () => {
      const content = "Some text. [[VOICE_UPSELL:invalid_reason]]";
      const result = detectUpsellMarker(content);

      expect(result.hasUpsell).toBe(false);
      expect(result.reason).toBeNull();
      expect(result.cleanContent).toBe(content);
    });

    it("only detects marker at end of content", () => {
      const content = "[[VOICE_UPSELL:weather]] This marker is at the start.";
      const result = detectUpsellMarker(content);

      expect(result.hasUpsell).toBe(false);
      expect(result.reason).toBeNull();
      expect(result.cleanContent).toBe(content);
    });

    it("handles marker with trailing whitespace", () => {
      const content = "Check the weather before hiking. [[VOICE_UPSELL:weather]]  \n";
      const result = detectUpsellMarker(content);

      expect(result.hasUpsell).toBe(true);
      expect(result.reason).toBe("weather");
      expect(result.cleanContent).toBe("Check the weather before hiking.");
    });

    it("handles marker with leading whitespace", () => {
      const content = "I recommend calling ahead.   [[VOICE_UPSELL:booking]]";
      const result = detectUpsellMarker(content);

      expect(result.hasUpsell).toBe(true);
      expect(result.reason).toBe("booking");
      expect(result.cleanContent).toBe("I recommend calling ahead.");
    });

    it("handles empty content", () => {
      const result = detectUpsellMarker("");

      expect(result.hasUpsell).toBe(false);
      expect(result.reason).toBeNull();
      expect(result.cleanContent).toBe("");
    });

    it("handles content that is only the marker", () => {
      const content = "[[VOICE_UPSELL:weather]]";
      const result = detectUpsellMarker(content);

      expect(result.hasUpsell).toBe(true);
      expect(result.reason).toBe("weather");
      expect(result.cleanContent).toBe("");
    });

    it("preserves multiline content when stripping marker", () => {
      const content = `Here are some tips:
1. Check the weather
2. Bring warm clothes

Mountain weather can change quickly. [[VOICE_UPSELL:weather]]`;
      const result = detectUpsellMarker(content);

      expect(result.hasUpsell).toBe(true);
      expect(result.reason).toBe("weather");
      expect(result.cleanContent).toContain("Here are some tips:");
      expect(result.cleanContent).toContain("Mountain weather can change quickly.");
      expect(result.cleanContent).not.toContain("VOICE_UPSELL");
    });

    it("handles markdown content with marker", () => {
      const content = "**Casa Gerardo** is an excellent choice! Call ahead to reserve. [[VOICE_UPSELL:booking]]";
      const result = detectUpsellMarker(content);

      expect(result.hasUpsell).toBe(true);
      expect(result.reason).toBe("booking");
      expect(result.cleanContent).toBe("**Casa Gerardo** is an excellent choice! Call ahead to reserve.");
    });

    it("validates reason type correctness", () => {
      const validReasons: UpsellReason[] = ["weather", "booking", "realtime", "slow_typing"];

      for (const reason of validReasons) {
        const content = `Test content [[VOICE_UPSELL:${reason}]]`;
        const result = detectUpsellMarker(content);

        expect(result.hasUpsell).toBe(true);
        expect(result.reason).toBe(reason);
      }
    });
  });
});
