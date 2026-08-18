import type { z } from "zod";

/**
 * Extract the field names implicated by a Zod parse failure, for use in
 * `[WEBHOOK_UNKNOWN_SHAPE]` observability logging (BE-H3, #778).
 *
 * Two issue shapes are handled:
 *   - `unrecognized_keys` issues (from a `.strict()` schema) carry the
 *     extra/unknown field names in `issue.keys`.
 *   - Other issues (e.g. `invalid_type`) carry the dotted field path in
 *     `issue.path`.
 *
 * Shared by the webhook routes that follow the enforced-passthrough +
 * strict-observability-probe pattern (src/app/api/webhooks/elevenlabs,
 * src/app/api/webhooks/supabase). src/app/api/webhooks/translate/route.ts
 * predates this extraction and keeps its own inline copy.
 */
export function getUnknownFields(error: z.ZodError): string[] {
  return error.issues.flatMap((issue) =>
    "keys" in issue && Array.isArray(issue.keys)
      ? (issue.keys as string[])
      : issue.path.length > 0
      ? [issue.path.join(".")]
      : []
  );
}
