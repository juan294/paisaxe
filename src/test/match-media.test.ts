import { describe, expect, it, vi } from "vitest";
import { createMatchMedia } from "./match-media";

describe("createMatchMedia", () => {
  it("keeps query state independent and only emits actual changes", () => {
    const media = createMatchMedia({ "(pointer: fine)": true });
    const pointer = media.matchMedia("(pointer: fine)");
    const motion = media.matchMedia("(prefers-reduced-motion: reduce)");
    const listener = vi.fn();
    pointer.addEventListener("change", listener);
    expect(media.matchMedia(pointer.media)).toBe(pointer);
    expect(pointer.matches).toBe(true);
    expect(motion.matches).toBe(false);

    media.setMatches(motion.media, true);
    media.setMatches(pointer.media, true);
    expect(listener).not.toHaveBeenCalled();
    media.setMatches(pointer.media, false);
    expect(listener).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ matches: false, media: pointer.media })
    );
    pointer.removeEventListener("change", listener);
    media.setMatches(pointer.media, true);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("supports the legacy listener and onchange browser contracts", () => {
    const media = createMatchMedia();
    const query = media.matchMedia("(pointer: coarse)");
    const legacy = vi.fn();
    const onChange = vi.fn();
    query.addListener(legacy);
    query.onchange = onChange;
    media.setMatches(query.media, true);
    expect(legacy).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ matches: true, media: query.media })
    );
    expect(onChange).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ matches: true, media: query.media })
    );
    expect(onChange.mock.contexts[0]).toBe(query);
    query.removeListener(legacy);
    query.onchange = null;
    media.setMatches(query.media, false);
    expect(legacy).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
