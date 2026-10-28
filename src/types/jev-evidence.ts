import type { JevMetadata } from "../lib/jev/contracts";
export interface EvidencePassage {
  id: string;
  body: string;
  citation: { title: string; url: string };
  contentHash: string;
  sourceDate: string | null;
}
export interface EvidenceClaim {
  id: string;
  start: number;
  end: number;
  citedPassageIds: string[];
  temporalScope: "general" | "current_availability";
  quotation?: string;
}
export interface EvidenceSnapshot {
  schemaVersion: 1;
  query: string;
  answer: string;
  claims: EvidenceClaim[];
  passages: EvidencePassage[];
  corpus: { version: string; hash: string };
  generatorIdentity: string;
  capturedAt: string;
}
export type EvidenceLabel =
  | "supported"
  | "contradicted"
  | "not_established"
  | "unavailable";
export interface EvidenceClaimResult {
  id: string;
  label: EvidenceLabel;
  evidencePassageIds: string[];
  reason: string;
  repair: string | null;
  unavailableKind: "structural" | "semantic" | "provider" | null;
  decisionMetadata: JevMetadata | null;
}
export interface EvidenceReport {
  coverage: "provided_claims_only";
  complete: boolean;
  suppliedClaimCount: number;
  checkedClaimCount: number;
  unavailableClaimCount: number;
  claims: EvidenceClaimResult[];
  errors: string[];
  snapshotHash: string;
  provenance: {
    model: string;
    questionVersion: string;
    corpus: { version: string; hash: string } | null;
    generatorIdentity: string | null;
    capturedAt: string | null;
    passageHashes: Record<string, string>;
  };
}
