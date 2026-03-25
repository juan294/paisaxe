import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { JsonLd, StoryJsonLd, BreadcrumbJsonLd, FAQJsonLd } from "./json-ld";
import type { Story } from "@/types/immersive";

describe("JsonLd", () => {
  // Ensure env var is cleared for default tests
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  it("renders website structured data", () => {
    const { container } = render(<JsonLd type="website" />);
    const script = container.querySelector(
      'script[type="application/ld+json"]'
    );

    expect(script).toBeInTheDocument();
    const data = JSON.parse(script!.textContent!);
    expect(data["@context"]).toBe("https://schema.org");
    expect(data["@type"]).toBe("WebSite");
    expect(data.name).toBe("Paisaxe");
    expect(data.url).toBe("https://paisaxe.es");
    expect(data.description).toBeTruthy();
    expect(data.inLanguage).toBeDefined();
  });

  it("renders tourist destination structured data", () => {
    const { container } = render(<JsonLd type="tourist-destination" />);
    const script = container.querySelector(
      'script[type="application/ld+json"]'
    );

    expect(script).toBeInTheDocument();
    const data = JSON.parse(script!.textContent!);
    expect(data["@context"]).toBe("https://schema.org");
    expect(data["@type"]).toBe("TouristDestination");
    expect(data.name).toBe("Asturias");
    expect(data.geo.latitude).toBe(43.3614);
    expect(data.geo.longitude).toBe(-5.8593);
  });

  it("includes geo coordinates for tourist destination", () => {
    const { container } = render(<JsonLd type="tourist-destination" />);
    const script = container.querySelector(
      'script[type="application/ld+json"]'
    );
    const data = JSON.parse(script!.textContent!);

    expect(data.geo).toBeDefined();
    expect(data.geo["@type"]).toBe("GeoCoordinates");
  });

  it("includes containedInPlace for tourist destination", () => {
    const { container } = render(<JsonLd type="tourist-destination" />);
    const script = container.querySelector(
      'script[type="application/ld+json"]'
    );
    const data = JSON.parse(script!.textContent!);

    expect(data.containedInPlace).toBeDefined();
    expect(data.containedInPlace["@type"]).toBe("Country");
    expect(data.containedInPlace.name).toContain("Espa");
  });

  it("includes touristType array for tourist destination", () => {
    const { container } = render(<JsonLd type="tourist-destination" />);
    const script = container.querySelector(
      'script[type="application/ld+json"]'
    );
    const data = JSON.parse(script!.textContent!);

    expect(data.touristType).toBeDefined();
    expect(Array.isArray(data.touristType)).toBe(true);
    expect(data.touristType.length).toBeGreaterThan(0);
  });

  it("includes search action for website", () => {
    const { container } = render(<JsonLd type="website" />);
    const script = container.querySelector(
      'script[type="application/ld+json"]'
    );
    const data = JSON.parse(script!.textContent!);

    expect(data.potentialAction).toBeDefined();
    expect(data.potentialAction["@type"]).toBe("SearchAction");
  });

  describe("uses NEXT_PUBLIC_SITE_URL env var", () => {
    const CUSTOM_URL = "https://custom.example.com";

    beforeEach(() => {
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", CUSTOM_URL);
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("uses env var URL for website type", () => {
      const { container } = render(<JsonLd type="website" />);
      const script = container.querySelector(
        'script[type="application/ld+json"]'
      );
      const data = JSON.parse(script!.textContent!);
      expect(data.url).toBe(CUSTOM_URL);
    });

    it("uses env var URL for tourist destination type", () => {
      const { container } = render(<JsonLd type="tourist-destination" />);
      const script = container.querySelector(
        'script[type="application/ld+json"]'
      );
      const data = JSON.parse(script!.textContent!);
      expect(data.url).toBe(`${CUSTOM_URL}/immersive`);
    });

    it("uses env var URL in search action target", () => {
      const { container } = render(<JsonLd type="website" />);
      const script = container.querySelector(
        'script[type="application/ld+json"]'
      );
      const data = JSON.parse(script!.textContent!);
      expect(data.potentialAction.target).toContain(CUSTOM_URL);
    });
  });
});

describe("StoryJsonLd", () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  const mockNatureStory: Story = {
    id: "test-123",
    slug: "lagos-covadonga",
    title: "Lagos de Covadonga",
    subtitle: "Los lagos glaciares más famosos de Asturias",
    description:
      "Descubre la belleza de los lagos Enol y Ercina en los Picos de Europa.",
    image: "/images/stories/lagos-covadonga.webp",
    category: "nature",
    sourcePdf: "picos-europa.pdf",
    location: "eastern",
    metadata: {
      question_prompts: [
        "¿Cómo llegar a los Lagos de Covadonga?",
        "¿Cuál es la mejor época para visitar?",
      ],
    },
  };

  const mockFoodStory: Story = {
    id: "test-456",
    slug: "fabada-asturiana",
    title: "Fabada Asturiana",
    subtitle: "El plato más emblemático de la gastronomía asturiana",
    description:
      "La fabada es un guiso tradicional hecho con fabes de la granja.",
    image: "/images/stories/fabada.webp",
    category: "food",
    sourcePdf: "gastronomia.pdf",
    location: "central",
  };

  it("renders TouristAttraction schema for nature stories", () => {
    const { container } = render(<StoryJsonLd story={mockNatureStory} />);
    const script = container.querySelector(
      'script[type="application/ld+json"]'
    );

    expect(script).toBeInTheDocument();
    const data = JSON.parse(script!.textContent!);
    expect(data["@context"]).toBe("https://schema.org");
    expect(data["@type"]).toBe("TouristAttraction");
    expect(data.name).toBe("Lagos de Covadonga");
    expect(data.description).toBe(mockNatureStory.description);
  });

  it("renders TouristAttraction schema for activities stories", () => {
    const activityStory: Story = {
      ...mockNatureStory,
      category: "activities",
      title: "Ruta del Cares",
    };
    const { container } = render(<StoryJsonLd story={activityStory} />);
    const script = container.querySelector(
      'script[type="application/ld+json"]'
    );
    const data = JSON.parse(script!.textContent!);
    expect(data["@type"]).toBe("TouristAttraction");
  });

  it("renders TouristAttraction schema for culture stories", () => {
    const cultureStory: Story = {
      ...mockNatureStory,
      category: "culture",
      title: "Prerrománico Asturiano",
    };
    const { container } = render(<StoryJsonLd story={cultureStory} />);
    const script = container.querySelector(
      'script[type="application/ld+json"]'
    );
    const data = JSON.parse(script!.textContent!);
    expect(data["@type"]).toBe("TouristAttraction");
  });

  it("renders Restaurant schema for food stories", () => {
    const { container } = render(<StoryJsonLd story={mockFoodStory} />);
    const script = container.querySelector(
      'script[type="application/ld+json"]'
    );

    expect(script).toBeInTheDocument();
    const data = JSON.parse(script!.textContent!);
    expect(data["@context"]).toBe("https://schema.org");
    expect(data["@type"]).toBe("Restaurant");
    expect(data.name).toBe("Fabada Asturiana");
    expect(data.servesCuisine).toBe("Asturian");
  });

  it("includes geo coordinates for location-based stories", () => {
    const { container } = render(<StoryJsonLd story={mockNatureStory} />);
    const script = container.querySelector(
      'script[type="application/ld+json"]'
    );
    const data = JSON.parse(script!.textContent!);

    expect(data.geo).toBeDefined();
    expect(data.geo["@type"]).toBe("GeoCoordinates");
    expect(data.geo.latitude).toBeDefined();
    expect(data.geo.longitude).toBeDefined();
  });

  it("includes image URL in schema", () => {
    const { container } = render(<StoryJsonLd story={mockNatureStory} />);
    const script = container.querySelector(
      'script[type="application/ld+json"]'
    );
    const data = JSON.parse(script!.textContent!);

    expect(data.image).toContain("lagos-covadonga.webp");
  });

  it("includes isPartOf reference to Paisaxe", () => {
    const { container } = render(<StoryJsonLd story={mockNatureStory} />);
    const script = container.querySelector(
      'script[type="application/ld+json"]'
    );
    const data = JSON.parse(script!.textContent!);

    expect(data.isPartOf).toBeDefined();
    expect(data.isPartOf.name).toBe("Paisaxe");
  });

  it("renders TouristAttraction for cities stories", () => {
    const citiesStory: Story = {
      ...mockNatureStory,
      category: "cities",
      title: "Oviedo",
    };
    const { container } = render(<StoryJsonLd story={citiesStory} />);
    const script = container.querySelector(
      'script[type="application/ld+json"]'
    );
    const data = JSON.parse(script!.textContent!);
    expect(data["@type"]).toBe("TouristAttraction");
  });

  it("uses correct geo coordinates for eastern location", () => {
    const { container } = render(<StoryJsonLd story={mockNatureStory} />);
    const script = container.querySelector(
      'script[type="application/ld+json"]'
    );
    const data = JSON.parse(script!.textContent!);

    // Eastern Asturias coordinates (Cangas de Onís area)
    expect(data.geo.latitude).toBe(43.35);
    expect(data.geo.longitude).toBe(-4.85);
  });

  it("uses correct geo coordinates for central location", () => {
    const { container } = render(<StoryJsonLd story={mockFoodStory} />);
    const script = container.querySelector(
      'script[type="application/ld+json"]'
    );
    const data = JSON.parse(script!.textContent!);

    // Central Asturias coordinates (Oviedo/Gijón area)
    expect(data.geo.latitude).toBe(43.36);
    expect(data.geo.longitude).toBe(-5.85);
  });

  it("returns default touristType for unmapped category", () => {
    const unknownCategoryStory: Story = {
      ...mockNatureStory,
      category: "unknown-category" as Story["category"],
      title: "Unknown Category Story",
    };
    const { container } = render(<StoryJsonLd story={unknownCategoryStory} />);
    const script = container.querySelector(
      'script[type="application/ld+json"]'
    );
    const data = JSON.parse(script!.textContent!);
    expect(data["@type"]).toBe("TouristAttraction");
    expect(data.touristType).toEqual(["Tourists"]);
  });

  it("defaults to central coordinates when no location specified", () => {
    const storyNoLocation: Story = {
      ...mockNatureStory,
      location: undefined,
    };
    const { container } = render(<StoryJsonLd story={storyNoLocation} />);
    const script = container.querySelector(
      'script[type="application/ld+json"]'
    );
    const data = JSON.parse(script!.textContent!);

    expect(data.geo.latitude).toBe(43.36);
    expect(data.geo.longitude).toBe(-5.85);
  });

  it("uses absolute image URL as-is when it starts with http", () => {
    const storyWithAbsoluteImage: Story = {
      ...mockNatureStory,
      image: "https://cdn.example.com/photos/lagos.webp",
    };
    const { container } = render(<StoryJsonLd story={storyWithAbsoluteImage} />);
    const script = container.querySelector(
      'script[type="application/ld+json"]'
    );
    const data = JSON.parse(script!.textContent!);

    expect(data.image).toBe("https://cdn.example.com/photos/lagos.webp");
  });

  it("falls back to story.id in URL when slug is undefined", () => {
    const storyNoSlug: Story = {
      ...mockNatureStory,
      slug: undefined,
    };
    const { container } = render(<StoryJsonLd story={storyNoSlug} />);
    const script = container.querySelector(
      'script[type="application/ld+json"]'
    );
    const data = JSON.parse(script!.textContent!);

    expect(data.url).toContain(`story=${storyNoSlug.id}`);
  });

  describe("uses NEXT_PUBLIC_SITE_URL env var", () => {
    const CUSTOM_URL = "https://custom.example.com";

    beforeEach(() => {
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", CUSTOM_URL);
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("uses env var URL for story URL", () => {
      const { container } = render(<StoryJsonLd story={mockNatureStory} />);
      const script = container.querySelector(
        'script[type="application/ld+json"]'
      );
      const data = JSON.parse(script!.textContent!);
      expect(data.url).toContain(CUSTOM_URL);
    });
  });
});

describe("BreadcrumbJsonLd", () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  it("renders BreadcrumbList schema", () => {
    const { container } = render(
      <BreadcrumbJsonLd
        items={[
          { name: "Inicio", url: "/" },
          { name: "Explorar", url: "/immersive" },
          {
            name: "Lagos de Covadonga",
            url: "/immersive?story=lagos-covadonga",
          },
        ]}
      />
    );
    const script = container.querySelector(
      'script[type="application/ld+json"]'
    );

    expect(script).toBeInTheDocument();
    const data = JSON.parse(script!.textContent!);
    expect(data["@context"]).toBe("https://schema.org");
    expect(data["@type"]).toBe("BreadcrumbList");
  });

  it("renders correct number of items", () => {
    const { container } = render(
      <BreadcrumbJsonLd
        items={[
          { name: "Inicio", url: "/" },
          { name: "Explorar", url: "/immersive" },
        ]}
      />
    );
    const script = container.querySelector(
      'script[type="application/ld+json"]'
    );
    const data = JSON.parse(script!.textContent!);

    expect(data.itemListElement).toHaveLength(2);
  });

  it("includes position for each item", () => {
    const { container } = render(
      <BreadcrumbJsonLd
        items={[
          { name: "Inicio", url: "/" },
          { name: "Explorar", url: "/immersive" },
        ]}
      />
    );
    const script = container.querySelector(
      'script[type="application/ld+json"]'
    );
    const data = JSON.parse(script!.textContent!);

    expect(data.itemListElement[0].position).toBe(1);
    expect(data.itemListElement[1].position).toBe(2);
  });

  it("includes ListItem type for each item", () => {
    const { container } = render(
      <BreadcrumbJsonLd items={[{ name: "Inicio", url: "/" }]} />
    );
    const script = container.querySelector(
      'script[type="application/ld+json"]'
    );
    const data = JSON.parse(script!.textContent!);

    expect(data.itemListElement[0]["@type"]).toBe("ListItem");
    expect(data.itemListElement[0].item["@type"]).toBe("WebPage");
  });

  it("prepends site URL to relative paths", () => {
    const { container } = render(
      <BreadcrumbJsonLd items={[{ name: "Explorar", url: "/immersive" }]} />
    );
    const script = container.querySelector(
      'script[type="application/ld+json"]'
    );
    const data = JSON.parse(script!.textContent!);

    expect(data.itemListElement[0].item["@id"]).toBe(
      "https://paisaxe.es/immersive"
    );
  });

  it("uses absolute URL as-is when it starts with http", () => {
    const { container } = render(
      <BreadcrumbJsonLd
        items={[
          { name: "External", url: "https://external.example.com/page" },
        ]}
      />
    );
    const script = container.querySelector(
      'script[type="application/ld+json"]'
    );
    const data = JSON.parse(script!.textContent!);

    expect(data.itemListElement[0].item["@id"]).toBe(
      "https://external.example.com/page"
    );
  });

  describe("uses NEXT_PUBLIC_SITE_URL env var", () => {
    const CUSTOM_URL = "https://custom.example.com";

    beforeEach(() => {
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", CUSTOM_URL);
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("uses env var URL for breadcrumb paths", () => {
      const { container } = render(
        <BreadcrumbJsonLd items={[{ name: "Explorar", url: "/immersive" }]} />
      );
      const script = container.querySelector(
        'script[type="application/ld+json"]'
      );
      const data = JSON.parse(script!.textContent!);
      expect(data.itemListElement[0].item["@id"]).toBe(
        `${CUSTOM_URL}/immersive`
      );
    });
  });
});

describe("FAQJsonLd", () => {
  const questions = [
    {
      question: "¿Cómo llegar a los Lagos de Covadonga?",
      answer: "Puedes llegar en coche o en autobús desde Cangas de Onís.",
    },
    {
      question: "¿Cuál es la mejor época para visitar?",
      answer:
        "La mejor época es entre mayo y octubre, evitando agosto por las restricciones.",
    },
  ];

  it("renders FAQPage schema", () => {
    const { container } = render(<FAQJsonLd questions={questions} />);
    const script = container.querySelector(
      'script[type="application/ld+json"]'
    );

    expect(script).toBeInTheDocument();
    const data = JSON.parse(script!.textContent!);
    expect(data["@context"]).toBe("https://schema.org");
    expect(data["@type"]).toBe("FAQPage");
  });

  it("includes correct number of questions", () => {
    const { container } = render(<FAQJsonLd questions={questions} />);
    const script = container.querySelector(
      'script[type="application/ld+json"]'
    );
    const data = JSON.parse(script!.textContent!);

    expect(data.mainEntity).toHaveLength(2);
  });

  it("includes Question type for each item", () => {
    const { container } = render(<FAQJsonLd questions={questions} />);
    const script = container.querySelector(
      'script[type="application/ld+json"]'
    );
    const data = JSON.parse(script!.textContent!);

    expect(data.mainEntity[0]["@type"]).toBe("Question");
    expect(data.mainEntity[0].name).toBe(questions[0].question);
  });

  it("includes Answer type for each answer", () => {
    const { container } = render(<FAQJsonLd questions={questions} />);
    const script = container.querySelector(
      'script[type="application/ld+json"]'
    );
    const data = JSON.parse(script!.textContent!);

    expect(data.mainEntity[0].acceptedAnswer["@type"]).toBe("Answer");
    expect(data.mainEntity[0].acceptedAnswer.text).toBe(questions[0].answer);
  });

  it("returns null for empty questions array", () => {
    const { container } = render(<FAQJsonLd questions={[]} />);
    const script = container.querySelector(
      'script[type="application/ld+json"]'
    );

    expect(script).not.toBeInTheDocument();
  });
});
