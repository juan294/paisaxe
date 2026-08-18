import { ImageResponse } from "next/og";
import { getStoryBySlugFromDB } from "@/lib/stories-data";
import { CATEGORY_LABELS } from "@/types/immersive";
import {
  OG_IMAGE_SIZE,
  OG_IMAGE_CONTENT_TYPE,
  OG_COLORS,
  getCategoryColor,
} from "@/lib/og-image-helpers";

export const alt = "Paisaxe story";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function Image({ params }: Props) {
  const { slug } = await params;
  const story = await getStoryBySlugFromDB(slug);

  if (!story) {
    return renderFallback();
  }

  const categoryLabel =
    CATEGORY_LABELS[story.category as keyof typeof CATEGORY_LABELS] ??
    story.category;
  const categoryColor = getCategoryColor(story.category);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "60px 80px",
          background: `linear-gradient(135deg, ${OG_COLORS.background} 0%, ${OG_COLORS.backgroundGradient} 50%, ${OG_COLORS.background} 100%)`,
          position: "relative",
        }}
      >
        {/* Category badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: categoryColor,
              marginRight: 12,
              display: "flex",
            }}
          />
          <div
            style={{
              fontSize: 20,
              color: categoryColor,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              display: "flex",
            }}
          >
            {categoryLabel}
          </div>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 56,
            fontWeight: 700,
            color: OG_COLORS.text,
            lineHeight: 1.15,
            letterSpacing: "-0.02em",
            display: "flex",
            maxWidth: "90%",
          }}
        >
          {story.title}
        </div>

        {/* Subtitle */}
        {story.subtitle ? (
          <div
            style={{
              fontSize: 26,
              color: OG_COLORS.textMuted,
              marginTop: 16,
              display: "flex",
            }}
          >
            {story.subtitle}
          </div>
        ) : null}

        {/* Branding */}
        <div
          style={{
            position: "absolute",
            bottom: 40,
            right: 60,
            fontSize: 22,
            color: OG_COLORS.textMuted,
            fontWeight: 600,
            letterSpacing: "0.04em",
            display: "flex",
          }}
        >
          Paisaxe
        </div>
      </div>
    ),
    { ...size }
  );
}

function renderFallback() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: `linear-gradient(135deg, ${OG_COLORS.background} 0%, ${OG_COLORS.backgroundGradient} 50%, ${OG_COLORS.background} 100%)`,
        }}
      >
        <div
          style={{
            width: 80,
            height: 4,
            backgroundColor: OG_COLORS.accent,
            borderRadius: 2,
            marginBottom: 32,
            display: "flex",
          }}
        />
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            color: OG_COLORS.text,
            letterSpacing: "-0.02em",
            display: "flex",
          }}
        >
          Paisaxe
        </div>
        <div
          style={{
            fontSize: 28,
            color: OG_COLORS.textMuted,
            marginTop: 16,
            letterSpacing: "0.05em",
            display: "flex",
          }}
        >
          Descubre Asturias
        </div>
      </div>
    ),
    { ...size }
  );
}
