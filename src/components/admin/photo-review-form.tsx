"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { parseImageProvenance } from "@/lib/image-provenance";
import { buildPhotoReview, preparePhoto, type PhotoReviewFields, type PreparedPhoto } from "./photo-review";

interface Props { title: string; description: string; storyId: string; asset: File | string | null; source: string; onChange: (source: string) => void }
const emptyFields = (source: string): PhotoReviewFields => {
  const existing = parseImageProvenance(source);
  return { sourcePage: existing?.sourcePage ?? "", photographer: existing?.photographer ?? "", license: existing?.license ?? "",
    permission: existing?.permission ?? "", date: existing?.date ?? "", credit: existing?.credit ?? (existing ? "" : source),
    context: existing?.context ?? "", alt: existing?.alt ?? "", reviewer: "", mobile: "", desktop: "", receipt: "", confirmed: false };
};

/** No permission is inferred; preparation and confirmation stay local until the dialog's Save. */
export function PhotoReviewForm({ title, description, storyId, asset, source, onChange }: Props) {
  const [fields, setFields] = useState(() => emptyFields(source));
  const [prepared, setPrepared] = useState<PreparedPhoto | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const editing = useRef(false);
  const generation = useRef(0);
  const reviewVersion = useRef(0);
  const sourceRef = useRef(source);
  sourceRef.current = source;
  useEffect(() => {
    generation.current += 1;
    editing.current = false;
    setPrepared(null); setBusy(false); setError(""); setFields(emptyFields(sourceRef.current));
    return () => { generation.current += 1; };
  }, [storyId, asset]);

  useEffect(() => {
    if (!editing.current) setFields(emptyFields(source));
  }, [source]);

  const edit = (key: keyof PhotoReviewFields, value: string | boolean) => {
    editing.current = true;
    reviewVersion.current += 1;
    setFields(current => ({ ...current, [key]: value, ...(key !== "confirmed" ? { confirmed: false } : {}) }));
    onChange(""); setError("");
  };
  const prepare = async () => {
    if (!asset) return;
    editing.current = true;
    const current = ++generation.current;
    setBusy(true); setError(""); setPrepared(null); onChange("");
    setFields(previous => ({ ...previous, confirmed: false }));
    try {
      const photo = await preparePhoto(storyId, asset);
      if (current === generation.current) setPrepared(photo);
    } catch (failure) {
      if (current === generation.current) setError(failure instanceof Error ? failure.message : "No se pudo preparar la foto");
    } finally { if (current === generation.current) setBusy(false); }
  };
  const confirm = async () => {
    if (!prepared) return;
    const current = generation.current;
    const version = reviewVersion.current;
    try {
      const proof = await buildPhotoReview(prepared, fields);
      if (current === generation.current && version === reviewVersion.current) { onChange(proof); setError(""); }
    } catch (failure) {
      if (current === generation.current && version === reviewVersion.current) setError(failure instanceof Error ? failure.message : "Completa la revisión de la foto");
    }
  };
  const input = (key: Exclude<keyof PhotoReviewFields, "confirmed" | "license" | "context">, label: string, type = "text") => (
    <label className="block space-y-1 text-xs" key={key}>
      <span>{label}</span>
      <input type={type} value={fields[key]} onChange={event => edit(key, event.target.value)} className="w-full rounded-lg border border-admin-line bg-admin-paper px-3 py-2 dark:border-admin-depth dark:bg-admin-ink" />
    </label>
  );
  return <section aria-label="Permisos y encuadres de la foto" className="space-y-3 rounded-xl border border-admin-line p-3 text-admin-ink dark:border-admin-depth dark:text-admin-paper">
    <p className="text-xs">Revisa los permisos de esta foto y sus encuadres en móvil y escritorio. Preparar o confirmar la revisión no guarda cambios; pulsa Save cuando termines.</p>
    <button type="button" disabled={busy || !asset} onClick={prepare} className="rounded-lg border px-3 py-2 text-xs disabled:opacity-50">{busy ? "Preparando foto…" : "Preparar revisión de la foto"}</button>
    {prepared && <div className="space-y-2">
      <p className="text-xs">Imagen preparada: {prepared.width} × {prepared.height}px. Revisa los encuadres centrados y la legibilidad del texto.</p>
      <div className="grid grid-cols-2 items-start gap-3">
        <div><p className="text-xs">Escritorio</p><div className="relative aspect-video overflow-hidden rounded-lg"><Image src={prepared.preview} alt="Encuadre de revisión en escritorio" fill unoptimized className="object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" /><span className="absolute bottom-2 left-2 text-sm text-white">{title}<span className="block text-xs">{description}</span></span></div></div>
        <div><p className="text-xs">Móvil</p><div className="relative mx-auto aspect-[9/16] max-w-40 overflow-hidden rounded-lg"><Image src={prepared.preview} alt="Encuadre de revisión en móvil" fill unoptimized className="object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" /><span className="absolute bottom-2 left-2 text-sm text-white">{title}<span className="block text-xs">{description}</span></span></div></div>
      </div>
    </div>}
    <div className="grid gap-3 sm:grid-cols-2">
      {input("sourcePage", "Página de origen (HTTPS)", "url")}{input("photographer", "Fotógrafo/a")}
      <label className="block text-xs">Licencia<select value={fields.license} onChange={event => edit("license", event.target.value)} className="block w-full rounded-lg border bg-admin-paper p-2 dark:bg-admin-ink"><option value="">Elige la licencia verificada</option><option value="owner-permission">Permiso del titular</option><option value="CC0-1.0">CC0 1.0</option><option value="CC-BY-4.0">CC BY 4.0</option><option value="Unsplash-manual">Descarga manual de Unsplash</option></select></label>
      {input("permission", "Prueba de permiso / registro conservado")}{input("date", "Fecha de revisión", "date")}{input("credit", "Crédito mostrado")}
      <label className="block text-xs">Contexto de la imagen<select value={fields.context} onChange={event => edit("context", event.target.value)} className="block w-full rounded-lg border bg-admin-paper p-2 dark:bg-admin-ink"><option value="">Elige el contexto verificado</option><option value="named-place">Muestra el lugar indicado</option><option value="thematic">Ilustración temática del contenido</option></select></label>
      {input("alt", "Descripción precisa de la imagen")}{input("reviewer", "Nombre de quien revisa")}{input("mobile", "Notas del encuadre en móvil")}{input("desktop", "Notas del encuadre en escritorio")}{input("receipt", "Registro o pruebas de permiso y revisión visual")}
    </div>
    <label className="flex gap-2 text-xs"><input type="checkbox" checked={fields.confirmed} onChange={event => edit("confirmed", event.target.checked)} />He comprobado los permisos, la precisión del contexto, ambos encuadres centrados, la legibilidad del texto, la resolución y la ausencia de marcas de agua.</label>
    <button type="button" disabled={!prepared || !fields.confirmed || busy} onClick={confirm} className="rounded-lg border px-3 py-2 text-xs disabled:opacity-50">Confirmar revisión de la foto</button>
    {parseImageProvenance(source) && <p role="status" className="text-xs">Revisión de la foto completada. Pulsa Save para aplicarla.</p>}
    {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
  </section>;
}
