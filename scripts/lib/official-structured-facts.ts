import { createHash } from "node:crypto";
import { z } from "zod";
import { canonicalJson, contentHash } from "./corpus-provenance";

export const officialDatasets = ["asturias-restaurants", "asturias-beaches", "asturias-viewpoints"] as const;
export type OfficialDataset = typeof officialDatasets[number];
export const officialDatasetDetails = {
  "asturias-restaurants": { title: "Restaurantes y sidrerías", url: "https://www.turismoasturiasprofesional.es/open-data/turismoasturias" },
  "asturias-beaches": { title: "Turismo — Playas (capa 2)", url: "https://sig.asturias.es/servicios/rest/services/Visor/Turismo/MapServer/2" },
  "asturias-viewpoints": { title: "Turismo — Miradores (capa 6)", url: "https://sig.asturias.es/servicios/rest/services/Visor/Turismo/MapServer/6" },
} satisfies Record<OfficialDataset, { title: string; url: string }>;

// Do not trim source fields: normalized identity matching is a separate review.
const text = z.string().refine(value => value.trim().length > 0);
const field = z.object({ content: text });
const restaurants = z.object({ articles: z.object({ article: z.array(z.object({
  Nombre: field, CodigoDGT: field, Contacto: z.object({ Concejo: field }),
})).min(1) }) });
const geography = z.object({ features: z.array(z.object({ attributes: z.object({
  objectid: z.number().int().positive(), nombre: text, concejo: text,
}) })).min(1), exceededTransferLimit: z.boolean().optional() });
const sha = z.string().regex(/^[a-f0-9]{64}$/);
export const officialSourceSchema = z.object({
  dataset: z.enum(officialDatasets), snapshotSha256: sha, recordId: text, rowIndex: z.number().int().nonnegative(),
  fields: z.record(z.string(), z.union([z.string(), z.number()])), projectionSha256: sha,
  termsEvidenceSha256: sha, termsDispositionSha256: sha,
  // These reviewed captures supply none of these publisher fields. Extending
  // their scope needs a new source review, not a fabricated acquisition date.
  publisherUpdatedAt: z.null(), publisherRevision: z.null(), productYear: z.null(),
}).strict();
export type OfficialSource = z.infer<typeof officialSourceSchema>;

export function officialAttribution(source: OfficialSource, retrievedAt: string): string {
  return `Administración del Principado de Asturias · ${officialDatasetDetails[source.dataset].title} · ${source.recordId} · actualización no facilitada · año del producto no facilitado · consulta ${retrievedAt.slice(0, 10)} · campos sin modificar; selección y redacción propia; sin respaldo del editor`;
}

/** Validate the reviewed, unchanged identity-only field contract. Evidence and
 * disposition hashes refer to separately recorded review, never self-approval. */
export function validateOfficialSource(source: OfficialSource): void {
  const fields = source.fields;
  const expected = source.dataset === "asturias-restaurants"
    ? ["Nombre.content", "CodigoDGT.content", "Contacto.Concejo.content"]
    : ["objectid", "nombre", "concejo"];
  if (canonicalJson(Object.keys(fields).sort()) !== canonicalJson(expected.sort()) ||
      contentHash(fields) !== source.projectionSha256 ||
      Object.entries(fields).some(([key, value]) => key === "objectid" ? !Number.isSafeInteger(value) || Number(value) <= 0 : typeof value !== "string" || !value.trim()) ||
      String(fields[source.dataset === "asturias-restaurants" ? "CodigoDGT.content" : "objectid"]) !== source.recordId) {
    throw new Error("Official source has altered, unreviewed or mismatched fields");
  }
}

export interface OfficialRecord {
  recordId: string;
  rowIndex: number;
  fields: Record<string, string | number>;
}

/** Private evidence projection only. It does not approve identity, rights or facts,
 * author prose, infer freshness, connect to a provider or import a corpus. */
export function projectOfficialSnapshot(dataset: OfficialDataset, raw: string) {
  if (!officialDatasets.includes(dataset)) throw new Error("Unsupported official dataset");
  const input: unknown = JSON.parse(raw);
  let records: OfficialRecord[];
  if (dataset === "asturias-restaurants") {
    records = restaurants.parse(input).articles.article.map((record, rowIndex) => ({
      recordId: record.CodigoDGT.content, rowIndex,
      fields: { "Nombre.content": record.Nombre.content, "CodigoDGT.content": record.CodigoDGT.content, "Contacto.Concejo.content": record.Contacto.Concejo.content },
    }));
  } else {
    const snapshot = geography.parse(input);
    if (snapshot.exceededTransferLimit === true) throw new Error("Truncated official GIS snapshot");
    records = snapshot.features.map(({ attributes }, rowIndex) => ({
      recordId: String(attributes.objectid), rowIndex,
      fields: { objectid: attributes.objectid, nombre: attributes.nombre, concejo: attributes.concejo },
    }));
  }
  if (new Set(records.map(record => record.recordId)).size !== records.length) throw new Error("Duplicate official record identity");
  return { dataset, snapshotSha256: createHash("sha256").update(raw).digest("hex"), publisherUpdatedAt: null,
    // Neither a missing transfer flag nor a single successful page proves that
    // every source record was captured. Restaurant export scope is unmeasured too.
    completeness: "unmeasured" as const, records };
}

/** Resolve structural source claims against the retained acquisition itself.
 * This verifies membership, not network authenticity, permission or approval. */
export function verifyOfficialSnapshot(input: OfficialSource, raw: string): void {
  const source = officialSourceSchema.parse(input);
  validateOfficialSource(source);
  const snapshot = projectOfficialSnapshot(source.dataset, raw);
  const row = snapshot.records[source.rowIndex];
  if (snapshot.snapshotSha256 !== source.snapshotSha256 || !row ||
      row.recordId !== source.recordId || canonicalJson(row.fields) !== canonicalJson(source.fields)) {
    throw new Error("Official source record differs from the retained snapshot");
  }
}
