import { NextRequest, NextResponse } from "next/server";
import { validateAdminAuth } from "@/lib/admin-auth";
import {
  getStoryTranslations,
  updateStoryTranslation,
  translateStory,
  TRANSLATION_LOCALES,
} from "@/lib/translate-story";
import type { StoryLocale, StoryTranslation } from "@/types/immersive";
import type {
  GenerateTranslationsRequest,
  GenerateTranslationsResponse,
  StoryTranslationsResponse,
  UpdateTranslationRequest,
} from "@/types/admin";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/stories/[id]/translations
 * Fetch translations and status for a story.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const auth = await validateAdminAuth();
  if (!auth.valid) {
    return auth.error;
  }

  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "Story ID is required" }, { status: 400 });
  }

  const result = await getStoryTranslations(id);

  if (!result.success || !result.data) {
    return NextResponse.json(
      { error: result.error || "Story not found" },
      { status: 404 }
    );
  }

  const response: StoryTranslationsResponse = {
    storyId: id,
    original: result.data.original,
    translations: result.data.translations,
    status: result.data.status,
    lastTranslatedAt: result.data.lastTranslatedAt,
  };

  return NextResponse.json({ data: response });
}

/**
 * PATCH /api/admin/stories/[id]/translations
 * Update a single locale translation (admin edit).
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await validateAdminAuth();
  if (!auth.valid) {
    return auth.error;
  }

  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "Story ID is required" }, { status: 400 });
  }

  let body: UpdateTranslationRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { locale, translation } = body;

  // Validate locale
  if (!locale || !TRANSLATION_LOCALES.includes(locale as StoryLocale)) {
    return NextResponse.json(
      { error: `Invalid locale. Must be one of: ${TRANSLATION_LOCALES.join(", ")}` },
      { status: 400 }
    );
  }

  // Validate translation fields
  if (
    !translation ||
    typeof translation.title !== "string" ||
    typeof translation.subtitle !== "string" ||
    typeof translation.description !== "string"
  ) {
    return NextResponse.json(
      { error: "Translation object is required with title, subtitle, and description fields" },
      { status: 400 }
    );
  }

  const result = await updateStoryTranslation(
    id,
    locale as StoryLocale,
    translation as StoryTranslation
  );

  if (!result.success) {
    return NextResponse.json(
      { error: result.error || "Failed to update translation" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    data: { success: true, locale, storyId: id },
  });
}

/**
 * POST /api/admin/stories/[id]/translations
 * Generate translations using Claude API.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await validateAdminAuth();
  if (!auth.valid) {
    return auth.error;
  }

  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "Story ID is required" }, { status: 400 });
  }

  let body: GenerateTranslationsRequest = {};
  try {
    const text = await request.text();
    if (text) {
      body = JSON.parse(text);
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { locales, forceRetranslate } = body;

  // Validate locales if provided
  if (locales) {
    if (!Array.isArray(locales)) {
      return NextResponse.json({ error: "locales must be an array" }, { status: 400 });
    }
    for (const locale of locales) {
      if (!TRANSLATION_LOCALES.includes(locale as StoryLocale)) {
        return NextResponse.json(
          { error: `Invalid locale '${locale}'. Must be one of: ${TRANSLATION_LOCALES.join(", ")}` },
          { status: 400 }
        );
      }
    }
  }

  const result = await translateStory(id, {
    locales: locales as StoryLocale[] | undefined,
    forceRetranslate,
  });

  const response: GenerateTranslationsResponse = {
    storyId: id,
    results: result.results as Record<StoryLocale, { success: boolean; error?: string }>,
    successCount: result.successCount || 0,
    failedCount: result.failedCount || 0,
  };

  // Return 200 even for partial failures - client can check failedCount
  return NextResponse.json({ data: response });
}
