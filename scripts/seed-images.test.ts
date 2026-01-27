import { describe, it, expect } from "vitest";
import {
  scoreImage,
  selectImages,
  buildImageRefsMap,
  deriveCaption,
} from "./seed-images";
import type { ManifestImage, ProcessedChunk, SelectedImage } from "./seed-images";

describe("scoreImage", () => {
  const baseImage: ManifestImage = {
    filename: "test.png",
    sourcePdf: "test.pdf",
    pageNumber: 10,
    width: 500,
    height: 500,
    path: "test/test.png",
    type: "rendered",
  };

  it("gives +100 for extracted type over rendered", () => {
    const extracted = { ...baseImage, type: "extracted" as const };
    const rendered = { ...baseImage, type: "rendered" as const };
    expect(scoreImage(extracted) - scoreImage(rendered)).toBe(100);
  });

  it("gives +50 for page 1", () => {
    const page1 = { ...baseImage, pageNumber: 1 };
    const page10 = { ...baseImage, pageNumber: 10 };
    expect(scoreImage(page1) - scoreImage(page10)).toBe(50);
  });

  it("gives +30 for pages 2-3", () => {
    const page2 = { ...baseImage, pageNumber: 2 };
    const page10 = { ...baseImage, pageNumber: 10 };
    expect(scoreImage(page2) - scoreImage(page10)).toBe(30);
  });

  it("gives +10 for pages 4-5", () => {
    const page4 = { ...baseImage, pageNumber: 4 };
    const page10 = { ...baseImage, pageNumber: 10 };
    expect(scoreImage(page4) - scoreImage(page10)).toBe(10);
  });

  it("gives +20 for landscape orientation", () => {
    const landscape = { ...baseImage, width: 800, height: 400 };
    const portrait = { ...baseImage, width: 400, height: 800 };
    // Both have same area so size bonus is the same, difference is landscape bonus
    expect(scoreImage(landscape) - scoreImage(portrait)).toBe(20);
  });

  it("caps size bonus at 50", () => {
    const huge = { ...baseImage, width: 5000, height: 5000 };
    const small = { ...baseImage, width: 100, height: 100 };
    const hugeScore = scoreImage(huge);
    const smallScore = scoreImage(small);
    // huge area: 25000000/10000 = 2500 → capped at 50
    // small area: 10000/10000 = 1
    expect(hugeScore - smallScore).toBe(49); // 50 - 1
  });

  it("gives higher score to extracted landscape on early page", () => {
    const ideal: ManifestImage = {
      ...baseImage,
      type: "extracted",
      pageNumber: 1,
      width: 1200,
      height: 800,
    };
    const poor: ManifestImage = {
      ...baseImage,
      type: "rendered",
      pageNumber: 20,
      width: 300,
      height: 500,
    };
    expect(scoreImage(ideal)).toBeGreaterThan(scoreImage(poor));
  });
});

describe("selectImages", () => {
  const chunks: ProcessedChunk[] = [
    { content: "About nature", sourcePdf: "guide.pdf", pageNumber: 4, sectionTitle: "Nature" },
    { content: "About food", sourcePdf: "guide.pdf", pageNumber: 8, sectionTitle: "Food" },
    { content: "About cities", sourcePdf: "other.pdf", pageNumber: 2, sectionTitle: "Cities" },
  ];

  const images: ManifestImage[] = [
    // Page 4 of guide.pdf — two images, the extracted one should win
    {
      filename: "guide_p4_1.png", sourcePdf: "guide.pdf", pageNumber: 4,
      width: 800, height: 600, path: "guide/guide_p4_1.png", type: "extracted",
    },
    {
      filename: "guide_p4_2.png", sourcePdf: "guide.pdf", pageNumber: 4,
      width: 900, height: 500, path: "guide/guide_p4_2.png", type: "rendered",
    },
    // Page 8 of guide.pdf — one image
    {
      filename: "guide_p8_1.png", sourcePdf: "guide.pdf", pageNumber: 8,
      width: 600, height: 400, path: "guide/guide_p8_1.png", type: "extracted",
    },
    // Page 2 of other.pdf — one image
    {
      filename: "other_p2_1.png", sourcePdf: "other.pdf", pageNumber: 2,
      width: 500, height: 400, path: "other/other_p2_1.png", type: "extracted",
    },
    // Page 10 of guide.pdf — no chunks on this page, should be excluded
    {
      filename: "guide_p10_1.png", sourcePdf: "guide.pdf", pageNumber: 10,
      width: 1000, height: 800, path: "guide/guide_p10_1.png", type: "extracted",
    },
    // Too small — should be excluded
    {
      filename: "tiny.png", sourcePdf: "guide.pdf", pageNumber: 4,
      width: 100, height: 100, path: "guide/tiny.png", type: "extracted",
    },
  ];

  it("only includes images on pages that have chunks", () => {
    const selected = selectImages(images, chunks, 400);
    const paths = selected.map((s) => s.image.path);
    expect(paths).not.toContain("guide/guide_p10_1.png");
  });

  it("filters images below minimum width", () => {
    const selected = selectImages(images, chunks, 400);
    const paths = selected.map((s) => s.image.path);
    expect(paths).not.toContain("guide/tiny.png");
  });

  it("picks top 1 per (sourcePdf, pageNumber) group", () => {
    const selected = selectImages(images, chunks, 400);
    // Page 4 of guide.pdf has 2 candidates (after filtering tiny), should pick only 1
    const page4 = selected.filter(
      (s) => s.image.sourcePdf === "guide.pdf" && s.image.pageNumber === 4
    );
    expect(page4).toHaveLength(1);
  });

  it("picks the highest-scored image per group", () => {
    const selected = selectImages(images, chunks, 400);
    const page4 = selected.find(
      (s) => s.image.sourcePdf === "guide.pdf" && s.image.pageNumber === 4
    );
    // extracted type gets +100, so guide_p4_1 should win over rendered guide_p4_2
    expect(page4?.image.path).toBe("guide/guide_p4_1.png");
  });

  it("returns all unique (sourcePdf, pageNumber) groups", () => {
    const selected = selectImages(images, chunks, 400);
    // 3 groups: (guide.pdf, 4), (guide.pdf, 8), (other.pdf, 2)
    expect(selected).toHaveLength(3);
  });
});

describe("buildImageRefsMap", () => {
  it("maps sourcePdf:pageNumber to array of public URLs", () => {
    const selected: SelectedImage[] = [
      {
        image: {
          filename: "a.png", sourcePdf: "guide.pdf", pageNumber: 4,
          width: 800, height: 600, path: "guide/a.png", type: "extracted",
        },
        publicUrl: "https://storage.example.com/guide/a.png",
      },
      {
        image: {
          filename: "b.png", sourcePdf: "guide.pdf", pageNumber: 8,
          width: 600, height: 400, path: "guide/b.png", type: "extracted",
        },
        publicUrl: "https://storage.example.com/guide/b.png",
      },
    ];

    const map = buildImageRefsMap(selected);
    expect(map["guide.pdf:4"]).toEqual(["https://storage.example.com/guide/a.png"]);
    expect(map["guide.pdf:8"]).toEqual(["https://storage.example.com/guide/b.png"]);
  });

  it("groups multiple images on the same page", () => {
    const selected: SelectedImage[] = [
      {
        image: {
          filename: "a.png", sourcePdf: "guide.pdf", pageNumber: 4,
          width: 800, height: 600, path: "guide/a.png", type: "extracted",
        },
        publicUrl: "https://storage.example.com/guide/a.png",
      },
      {
        image: {
          filename: "b.png", sourcePdf: "guide.pdf", pageNumber: 4,
          width: 900, height: 500, path: "guide/b.png", type: "extracted",
        },
        publicUrl: "https://storage.example.com/guide/b.png",
      },
    ];

    const map = buildImageRefsMap(selected);
    expect(map["guide.pdf:4"]).toHaveLength(2);
    expect(map["guide.pdf:4"]).toContain("https://storage.example.com/guide/a.png");
    expect(map["guide.pdf:4"]).toContain("https://storage.example.com/guide/b.png");
  });

  it("returns empty object for empty input", () => {
    expect(buildImageRefsMap([])).toEqual({});
  });
});

describe("deriveCaption", () => {
  const chunks: ProcessedChunk[] = [
    { content: "Text", sourcePdf: "guide.pdf", pageNumber: 4, sectionTitle: "Nature Walks" },
    { content: "Text", sourcePdf: "guide.pdf", pageNumber: 8, sectionTitle: "Local Food" },
    { content: "Text", sourcePdf: "guide.pdf", pageNumber: 8 }, // no sectionTitle
    { content: "Text", sourcePdf: "other.pdf", pageNumber: 2, sectionTitle: "City Tour" },
  ];

  it("returns sectionTitle from chunk on the same page", () => {
    expect(deriveCaption(chunks, "guide.pdf", 4)).toBe("Nature Walks");
  });

  it("returns first non-empty sectionTitle when multiple chunks on same page", () => {
    expect(deriveCaption(chunks, "guide.pdf", 8)).toBe("Local Food");
  });

  it("returns null when no chunk exists for the page", () => {
    expect(deriveCaption(chunks, "guide.pdf", 99)).toBeNull();
  });

  it("returns null when chunk exists but has no sectionTitle", () => {
    const noTitleChunks: ProcessedChunk[] = [
      { content: "Text", sourcePdf: "guide.pdf", pageNumber: 4 },
    ];
    expect(deriveCaption(noTitleChunks, "guide.pdf", 4)).toBeNull();
  });

  it("matches sourcePdf exactly", () => {
    expect(deriveCaption(chunks, "other.pdf", 2)).toBe("City Tour");
    expect(deriveCaption(chunks, "wrong.pdf", 2)).toBeNull();
  });
});
