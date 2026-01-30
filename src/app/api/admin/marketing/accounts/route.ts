import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { validateAdminAuth } from "@/lib/admin-auth";
import {
  rowToMarketingAccountPublic,
  type MarketingAccountRow,
  type UpdateAccountCredentialsRequest,
  type MarketingPlatform,
} from "@/types/marketing";

const VALID_PLATFORMS: MarketingPlatform[] = ["x", "instagram", "pinterest"];

/**
 * GET /api/admin/marketing/accounts
 * Returns all marketing accounts (without credentials)
 */
export async function GET() {
  const auth = await validateAdminAuth();
  if (!auth.valid) {
    return auth.error;
  }

  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("marketing_accounts")
      .select("*")
      .order("platform");

    if (error) {
      console.error("Error fetching marketing accounts:", error);
      return NextResponse.json(
        { error: "Failed to fetch accounts" },
        { status: 500 }
      );
    }

    // Convert to public format (no credentials)
    const accounts = (data as MarketingAccountRow[]).map(
      rowToMarketingAccountPublic
    );

    return NextResponse.json({ data: accounts });
  } catch (error) {
    console.error("Marketing accounts API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/marketing/accounts
 * Create or update a marketing account with credentials
 */
export async function POST(request: NextRequest) {
  const auth = await validateAdminAuth();
  if (!auth.valid) {
    return auth.error;
  }

  try {
    const body: UpdateAccountCredentialsRequest = await request.json();

    // Validate required fields
    if (!body.platform || !body.accountName || !body.credentials) {
      return NextResponse.json(
        { error: "Missing required fields: platform, accountName, credentials" },
        { status: 400 }
      );
    }

    // Validate platform
    if (!VALID_PLATFORMS.includes(body.platform)) {
      return NextResponse.json(
        { error: `Invalid platform. Must be one of: ${VALID_PLATFORMS.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate credentials have at least accessToken
    if (!body.credentials.accessToken) {
      return NextResponse.json(
        { error: "Credentials must include accessToken" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Upsert account (unique constraint on platform)
    const { data, error } = await supabase
      .from("marketing_accounts")
      .upsert(
        {
          platform: body.platform,
          account_name: body.accountName,
          account_handle: body.accountHandle || null,
          credentials: body.credentials,
          is_active: true,
          last_sync_at: new Date().toISOString(),
        },
        { onConflict: "platform" }
      )
      .select()
      .single();

    if (error) {
      console.error("Error saving marketing account:", error);
      return NextResponse.json(
        { error: "Failed to save account" },
        { status: 500 }
      );
    }

    // Return public version (no credentials in response)
    const account = rowToMarketingAccountPublic(data as MarketingAccountRow);

    return NextResponse.json({ data: account }, { status: 201 });
  } catch (error) {
    console.error("Marketing accounts POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/marketing/accounts?platform=x
 * Deactivate a marketing account
 */
export async function DELETE(request: NextRequest) {
  const auth = await validateAdminAuth();
  if (!auth.valid) {
    return auth.error;
  }

  try {
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get("platform") as MarketingPlatform | null;

    if (!platform || !VALID_PLATFORMS.includes(platform)) {
      return NextResponse.json(
        { error: "Valid platform query parameter required" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Soft delete - just deactivate
    const { error } = await supabase
      .from("marketing_accounts")
      .update({
        is_active: false,
        credentials: null, // Clear credentials on deactivation
      })
      .eq("platform", platform);

    if (error) {
      console.error("Error deactivating marketing account:", error);
      return NextResponse.json(
        { error: "Failed to deactivate account" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Marketing accounts DELETE error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
