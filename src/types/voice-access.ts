/**
 * Shared type for the /api/voice-access response.
 *
 * Lives here (not in the API route) so client-side hooks can import it
 * without creating a server→client layering violation.
 */
export interface VoiceAccessResponse {
  hasAccess: boolean;
  status?: "active" | "suspended" | "revoked" | "expired" | "none";
  expiresAt: string | null;
  purchaseType: string | null;
}
