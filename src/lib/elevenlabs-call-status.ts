/**
 * Normalize the call_successful field from ElevenLabs webhook analysis.
 *
 * ElevenLabs has delivered this field in multiple formats across API versions:
 * - Boolean: true / false
 * - String enum: "success" / "failure" / "unknown"
 * - String boolean: "true" / "false"
 * - Missing / null / undefined -> treat as unknown
 */
export function isCallSuccessful(value: unknown): "success" | "failure" | "unknown" {
  if (value === true || value === "success" || value === "true") return "success";
  if (value === false || value === "failure" || value === "false") return "failure";
  return "unknown";
}
