import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async () => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { count, error } = await supabase
      .from("stories")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true);

    if (error) throw error;

    console.log(`Keep-alive: ${count} active stories at ${new Date().toISOString()}`);

    return new Response(
      JSON.stringify({
        ok: true,
        active_stories: count,
        timestamp: new Date().toISOString(),
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Keep-alive error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
