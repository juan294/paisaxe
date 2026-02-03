import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function main() {
  const { data: story } = await supabase
    .from("stories")
    .select("id, title, metadata")
    .eq("curation_status", "approved")
    .limit(1)
    .single();

  console.log("Story:", story?.title);
  console.log("\nmetadata.translations keys:", Object.keys(story?.metadata?.translations || {}));
  console.log("metadata.translation_status keys:", Object.keys(story?.metadata?.translation_status || {}));

  const status = story?.metadata?.translation_status;
  const trans = story?.metadata?.translations;

  console.log("\nEN status:", JSON.stringify(status?.en));
  console.log("EN translation exists:", !!trans?.en);
  console.log("EN title:", trans?.en?.title?.substring(0, 50));
}

main();
