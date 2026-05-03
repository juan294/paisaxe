declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(
    handler: (request: Request) => Response | Promise<Response>
  ): void;
};

declare module "https://esm.sh/@supabase/supabase-js@2" {
  export { createClient } from "@supabase/supabase-js";
}
