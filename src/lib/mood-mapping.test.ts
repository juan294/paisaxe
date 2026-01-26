import { describe, it, expect } from "vitest";
import { filterByMood } from "./mood-mapping";
import type { Story } from "@/types/immersive";

function makeStory(
  overrides: Partial<Story> & { id: string; category: Story["category"] }
): Story {
  return {
    title: "Test Story",
    subtitle: "Subtitle",
    description: "Description",
    image: "/img.jpg",
    sourcePdf: "/pdf.pdf",
    ...overrides,
  };
}

describe("filterByMood", () => {
  const stories: Story[] = [
    makeStory({ id: "n1", category: "nature", title: "Picos de Europa" }),
    makeStory({ id: "n2", category: "nature", title: "Senda del Oso" }),
    makeStory({ id: "c1", category: "cities", title: "Oviedo" }),
    makeStory({ id: "c2", category: "culture", title: "Prerromanico" }),
    makeStory({ id: "f1", category: "food", title: "Fabada" }),
    makeStory({ id: "f2", category: "food", title: "Sidra" }),
    makeStory({
      id: "a1",
      category: "activities",
      title: "Descenso del Sella",
    }),
  ];

  it("'relajante' returns nature stories", () => {
    const result = filterByMood(stories, "relajante");
    expect(result.map((s) => s.id)).toEqual(["n1", "n2"]);
    expect(result.every((s) => s.category === "nature")).toBe(true);
  });

  it("'aventurero' returns activities and nature stories", () => {
    const result = filterByMood(stories, "aventurero");
    const ids = result.map((s) => s.id);
    expect(ids).toContain("n1");
    expect(ids).toContain("n2");
    expect(ids).toContain("a1");
    expect(
      result.every(
        (s) => s.category === "nature" || s.category === "activities"
      )
    ).toBe(true);
  });

  it("'cultural' returns culture and cities stories", () => {
    const result = filterByMood(stories, "cultural");
    const ids = result.map((s) => s.id);
    expect(ids).toContain("c1");
    expect(ids).toContain("c2");
    expect(
      result.every(
        (s) => s.category === "culture" || s.category === "cities"
      )
    ).toBe(true);
  });

  it("'delicioso' returns food stories", () => {
    const result = filterByMood(stories, "delicioso");
    expect(result.map((s) => s.id)).toEqual(["f1", "f2"]);
    expect(result.every((s) => s.category === "food")).toBe(true);
  });

  it("returns empty array when no stories match", () => {
    const onlyCities: Story[] = [
      makeStory({ id: "c1", category: "cities", title: "Gijon" }),
    ];
    const result = filterByMood(onlyCities, "delicioso");
    expect(result).toEqual([]);
  });

  it("matches stories via metadata mood_tags", () => {
    const storiesWithTags: Story[] = [
      makeStory({
        id: "tagged",
        category: "cities",
        title: "Tagged City",
        metadata: { mood_tags: ["relajante"] },
      }),
      makeStory({ id: "untagged", category: "cities", title: "Untagged City" }),
    ];

    const result = filterByMood(storiesWithTags, "relajante");
    expect(result.map((s) => s.id)).toContain("tagged");
  });
});
