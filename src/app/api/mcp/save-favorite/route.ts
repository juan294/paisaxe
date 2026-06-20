import { NextResponse } from "next/server";
import { validateMcpSecret } from "@/lib/mcp-auth";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";

/**
 * MCP-compatible Save Favorite endpoint for the Pelayo voice agent (#34).
 *
 * Lets a visitor ask Pelayo to bookmark a place mid-conversation. The visitor
 * voice agent has no authenticated web session, so bookmarks are keyed by the
 * ElevenLabs conversation id (passed as a system-provided variable) rather than
 * a user id. Persists into voice_saved_places (see migration 095).
 *
 * POST /api/mcp/save-favorite
 * Body: { place_name, place_address?, place_id?, notes?, conversation_id? }
 */

interface SaveFavoriteRequest {
  place_name?: unknown;
  place_address?: unknown;
  place_id?: unknown;
  notes?: unknown;
  conversation_id?: unknown;
}

interface SaveFavoriteResponse {
  success: boolean;
  message: string;
}

/** Coerce an unknown field to a trimmed non-empty string, or null. */
function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function POST(request: Request): Promise<NextResponse<SaveFavoriteResponse>> {
  if (!validateMcpSecret(request)) {
    return NextResponse.json<SaveFavoriteResponse>(
      { success: false, message: "Unauthorized" },
      { status: 401 }
    );
  }

  let body: SaveFavoriteRequest;
  try {
    body = (await request.json()) as SaveFavoriteRequest;
  } catch {
    return NextResponse.json<SaveFavoriteResponse>(
      { success: false, message: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const placeName = asString(body.place_name);
  if (!placeName) {
    return NextResponse.json<SaveFavoriteResponse>(
      {
        success: false,
        message: "place_name is required to save a place.",
      },
      { status: 400 }
    );
  }

  // conversation_id is system-provided by ElevenLabs; tolerate its absence so a
  // bookmark is still recorded rather than lost.
  const conversationId = asString(body.conversation_id) ?? "unknown";

  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("voice_saved_places")
      .upsert(
        {
          conversation_id: conversationId,
          place_name: placeName,
          place_address: asString(body.place_address),
          place_id: asString(body.place_id),
          notes: asString(body.notes),
        },
        { onConflict: "conversation_id,place_name" }
      );

    if (error) {
      logger.error("[SAVE_FAVORITE_INSERT_FAILED]", { error: error.message });
      return NextResponse.json<SaveFavoriteResponse>(
        {
          success: false,
          message: "Could not save the place right now. Please try again.",
        },
        { status: 500 }
      );
    }
  } catch (err) {
    logger.error("[SAVE_FAVORITE_DB_ERROR]", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json<SaveFavoriteResponse>(
      {
        success: false,
        message: "Could not save the place right now. Please try again.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json<SaveFavoriteResponse>({
    success: true,
    message: `Saved ${placeName} to the visitor's bookmarks. Confirm to the user that it's saved.`,
  });
}

// GET endpoint for health checks and documentation.
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    endpoint: "/api/mcp/save-favorite",
    description:
      "Save (bookmark) a place to the visitor's saved places during a Pelayo voice conversation.",
    required_fields: ["place_name"],
    optional_fields: ["place_address", "place_id", "notes", "conversation_id"],
    required_headers: ["x-mcp-secret"],
    example_request: {
      place_name: "Casa Marcial",
      place_address: "La Salgar, Arriondas",
      place_id: "ChIJ...",
      conversation_id: "conv_abc123",
    },
  });
}
