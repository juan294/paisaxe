import type { AuthoredCitation } from "@/types";

export function isAuthoredCitation(value: unknown): value is AuthoredCitation {
  if (!value || typeof value !== "object") return false;
  const citation = value as Record<string, unknown>;
  if (![citation.title, citation.url, citation.license, citation.revision, citation.attribution].every(v => typeof v === "string" && v.trim())) return false;
  try { const url = new URL(citation.url as string); return url.protocol === "https:" && !url.username && !url.password; } catch { return false; }
}
