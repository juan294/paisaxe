/** Guide extraction/authoring/live seeding is retired from operational entry points. */
export function rejectLegacyContentOperation(operation: string, _retiredOperation?: unknown): never {
  throw new Error(`${operation} is disabled: guide-derived content/images cannot be authored or published through the legacy pipeline. Use reviewed authored manifests with scripts/corpus.ts. Existing restricted references are read-only overlap inputs; retention/deletion requires separate authorization.`);
}
