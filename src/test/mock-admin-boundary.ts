import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";

type Auth = {valid: true; userId?: string} | {valid: false; error: Response};
/** Handler-focused tests retain their auth fixtures. The real wrapper/SDK
 * boundary is separately exercised by authorization-matrix.test.ts. */
export function mockAdminBoundary(validateAdminAuth: (options?: {skipCache: boolean}) => Promise<Auth>) {
  return {
    validateAdminAuth,
    withAdminDeferred: async <T>(handler: (getClient: () => SupabaseClient, auth: {userId: string}) => Promise<T>, request?: Pick<Request, "headers" | "method">): Promise<T | NextResponse> => {
      const auth = await validateAdminAuth({skipCache: Boolean(request && ["POST", "PUT", "PATCH", "DELETE"].includes(request.method.toUpperCase()))});
      if (!auth.valid) return auth.error as NextResponse;
      return handler(createAdminClient, {userId: auth.userId ?? "test-admin"});
    },
    withAdminSession: async <T>(handler: (auth: {userId: string}) => Promise<T>, request?: Pick<Request, "headers" | "method">): Promise<T | NextResponse> => {
      const auth = await validateAdminAuth({skipCache: Boolean(request && ["POST", "PUT", "PATCH", "DELETE"].includes(request.method.toUpperCase()))});
      if (!auth.valid) return auth.error as NextResponse;
      return handler({userId: auth.userId ?? "test-admin"});
    },
    withAdmin: async <T>(
      handler: (client: SupabaseClient, auth: {userId: string}) => Promise<T>,
      request?: Pick<Request, "headers" | "method">,
    ): Promise<T | NextResponse> => {
      const auth = await validateAdminAuth({skipCache: Boolean(request && ["POST", "PUT", "PATCH", "DELETE"].includes(request.method.toUpperCase()))});
      if (!auth.valid) return auth.error as NextResponse;
      return handler(createAdminClient(), {userId: auth.userId ?? "test-admin"});
    },
  };
}
