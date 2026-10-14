// @vitest-environment node
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { projectOfficialSnapshot, verifyOfficialSnapshot, type OfficialSource } from "../lib/official-structured-facts";
import { contentHash } from "../lib/corpus-provenance";

const restaurant = (code = "R9999") => ({
  Nombre: { content: "  Restaurante sintético  " }, CodigoDGT: { content: code },
  Contacto: { Concejo: { content: "Concejo sintético" }, Email: { content: "private@example.test" } },
  Informacion: { Descripcion: { content: "Excluded source prose" }, FechasCierre: { content: "Excluded operations" } },
  Visualizador: { content: "https://example.test/excluded-photo.jpg" },
});
const gis = (id = 7) => ({ attributes: { objectid: id, nombre: "Playa sintética", cod: "99-07", concejo: "Concejo sintético", accesos: "Excluded safety advice", servicios: "Excluded operations" }, geometry: { x: 1, y: 2 } });

describe("official structured snapshot projection (synthetic data only)", () => {
  it.each(["asturias-restaurants", "asturias-beaches", "asturias-viewpoints"] as const)("verifies actual raw membership for %s rather than trusting recomputed field hashes", dataset => {
    const raw = dataset === "asturias-restaurants"
      ? JSON.stringify({ articles: { article: [restaurant(), restaurant("R8888")] } })
      : JSON.stringify({ features: [gis(), gis(8)] });
    const projected = projectOfficialSnapshot(dataset, raw);
    const row = projected.records[0];
    if (!row) throw new Error("Synthetic snapshot row missing");
    const source: OfficialSource = { dataset, ...row, snapshotSha256: projected.snapshotSha256, projectionSha256: contentHash(row.fields), termsEvidenceSha256: "a".repeat(64), termsDispositionSha256: "b".repeat(64), publisherUpdatedAt: null, publisherRevision: null, productYear: null };
    expect(() => verifyOfficialSnapshot(source, raw)).not.toThrow();
    const property = dataset === "asturias-restaurants" ? "Nombre.content" : "nombre";
    const altered = { ...source.fields, [property]: "Fabricated source name" };
    expect(() => verifyOfficialSnapshot({ ...source, fields: altered, projectionSha256: contentHash(altered) }, raw)).toThrow(/snapshot|record/i);
    expect(() => verifyOfficialSnapshot({ ...source, rowIndex: 1 }, raw)).toThrow(/snapshot|record/i);
    expect(() => verifyOfficialSnapshot({ ...source, rowIndex: 999 }, raw)).toThrow(/snapshot|record/i);
    expect(() => verifyOfficialSnapshot(source, raw + "\n")).toThrow(/snapshot/i);
  });

  it("binds exact acquisition bytes and preserves unchanged business identity fields only", () => {
    const raw = JSON.stringify({ articles: { article: [restaurant()] } }, null, 2);
    const result = projectOfficialSnapshot("asturias-restaurants", raw);
    expect(result.snapshotSha256).toBe(createHash("sha256").update(raw).digest("hex"));
    expect(result).toMatchObject({ dataset: "asturias-restaurants", publisherUpdatedAt: null, completeness: "unmeasured", records: [{ recordId: "R9999", rowIndex: 0, fields: { "Nombre.content": "  Restaurante sintético  ", "CodigoDGT.content": "R9999", "Contacto.Concejo.content": "Concejo sintético" } }] });
    expect(JSON.stringify(result)).not.toMatch(/private@|Excluded|example.test/);
    expect(result).not.toHaveProperty("approved");
    expect(projectOfficialSnapshot("asturias-restaurants", JSON.stringify(JSON.parse(raw))).snapshotSha256).not.toBe(result.snapshotSha256);
  });

  it.each(["asturias-beaches", "asturias-viewpoints"] as const)("retains identity and municipality from %s without geometry or operational claims", dataset => {
    const raw = JSON.stringify({ features: [gis()], exceededTransferLimit: false });
    const result = projectOfficialSnapshot(dataset, raw);
    expect(result.records).toEqual([{ recordId: "7", rowIndex: 0, fields: { objectid: 7, nombre: "Playa sintética", concejo: "Concejo sintético" } }]);
    expect(result.completeness).toBe("unmeasured");
    expect(JSON.stringify(result)).not.toMatch(/Excluded|geometry|accesos|servicios/);
  });

  it("never presents a truncated GIS response as a usable snapshot", () => {
    expect(() => projectOfficialSnapshot("asturias-beaches", JSON.stringify({ features: [gis()], exceededTransferLimit: true }))).toThrow(/truncated/i);
  });

  it.each([
    { articles: { article: [restaurant(), restaurant()] } },
    { articles: { article: [restaurant("")] } },
    { articles: { article: [{ ...restaurant(), Nombre: { content: " " } }] } },
    { articles: { article: [{ ...restaurant(), Contacto: {} }] } },
    { articles: { article: [] } },
    { articles: [] },
    { error: "upstream failure" },
  ])("[case %#] rejects duplicate, empty or malformed restaurant identities", input => {
    expect(() => projectOfficialSnapshot("asturias-restaurants", JSON.stringify(input))).toThrow();
  });

  it.each([
    { features: [gis(), gis()] }, { features: [gis(0)] }, { features: [gis(1.5)] },
    { features: [{ attributes: { objectid: 7, nombre: "Name" } }] },
    { features: [] }, { error: { code: 500 } },
  ])("[case %#] rejects malformed or duplicated GIS records and upstream errors", input => {
    expect(() => projectOfficialSnapshot("asturias-beaches", JSON.stringify(input))).toThrow();
  });

  it("rejects malformed JSON and unsupported datasets", () => {
    expect(() => projectOfficialSnapshot("asturias-restaurants", "{" )).toThrow();
    expect(() => projectOfficialSnapshot("unreviewed-dataset" as never, "{}")).toThrow(/unsupported/i);
  });
});
