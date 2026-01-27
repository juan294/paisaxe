import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Default: 90 days retention, configurable via query param
    const url = new URL(req.url);
    const retentionDays = parseInt(url.searchParams.get("days") ?? "90", 10);

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    const { count, error } = await supabase
      .from("analytics_events")
      .delete()
      .lt("created_at", cutoff.toISOString())
      .select("*", { count: "exact", head: true });

    if (error) throw error;

    console.log(`Cleanup: deleted ${count ?? 0} analytics events older than ${retentionDays} days`);

    return new Response(
      JSON.stringify({
        ok: true,
        deleted_count: count ?? 0,
        retention_days: retentionDays,
        cutoff_date: cutoff.toISOString(),
        timestamp: new Date().toISOString(),
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Cleanup error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
