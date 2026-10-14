import { createHash } from "node:crypto";
import sharp from "sharp";
import { NextRequest, NextResponse } from "next/server";
import { withAdminRead } from "@/lib/admin-auth";
import { optimizeSingleImage, validateImageBuffer } from "@/lib/image-optimization";
import { fetchRemoteImage, RemoteImageError } from "@/lib/remote-image";
import { logger } from "@/lib/logger";

const MAX_SIZE = 10 * 1024 * 1024;
const TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);
const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

/** Authenticated, no-write preparation: review these exact bytes before image PUT. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAdminRead(async (supabase) => {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Falta el identificador de la historia" }, { status: 400 });
    try {
      const current = await supabase.from("stories").select("id").eq("id", id).maybeSingle();
      if (current.error) return NextResponse.json({ error: "No se pudo leer la historia" }, { status: 500 });
      if (!current.data) return NextResponse.json({ error: "No se encontró la historia" }, { status: 404 });
      let original: Buffer;
      let replacement: Buffer;
      let assetUrl: string;
      let format: string;
      if (request.headers.get("content-type")?.includes("multipart/form-data")) {
        const form = await request.formData();
        const file = form.get("file");
        if (!file || typeof file === "string") return NextResponse.json({ error: "Selecciona un archivo" }, { status: 400 });
        if (!TYPES.has(file.type) || file.size > MAX_SIZE) return NextResponse.json({ error: "Usa JPEG, PNG, WebP, GIF o AVIF de hasta 10 MB" }, { status: 400 });
        original = Buffer.from(await file.arrayBuffer());
        const validation = await validateImageBuffer(original);
        if (!validation.valid) return NextResponse.json({ error: "El archivo no contiene una imagen válida" }, { status: 400 });
        replacement = (await optimizeSingleImage(original, 2048)).buffer;
        format = "avif";
        assetUrl = supabase.storage.from("story-images").getPublicUrl(`${id}-${hash(replacement)}.avif`).data.publicUrl;
      } else {
        const body: unknown = await request.json();
        const url = body && typeof body === "object" && "imageUrl" in body ? body.imageUrl : undefined;
        if (typeof url !== "string") return NextResponse.json({ error: "Falta la URL de la imagen" }, { status: 400 });
        let parsed: URL;
        try { parsed = new URL(url); } catch { return NextResponse.json({ error: "La URL de la imagen no es válida" }, { status: 400 }); }
        original = await fetchRemoteImage(parsed);
        const validation = await validateImageBuffer(original);
        if (!validation.valid) return NextResponse.json({ error: "El archivo no contiene una imagen válida" }, { status: 400 });
        replacement = original;
        format = validation.format!;
        assetUrl = url;
      }
      const { width, height } = await sharp(replacement).metadata();
      return NextResponse.json({ data: { assetUrl, originalSha256: hash(original), replacementSha256: hash(replacement),
        preview: `data:image/${format};base64,${replacement.toString("base64")}`, width, height } }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      if (error instanceof RemoteImageError || error instanceof SyntaxError) return NextResponse.json({ error: error instanceof RemoteImageError ? error.message : "La solicitud no es válida" }, { status: 400 });
      logger.error("[ADMIN_PHOTO_PREPARATION_FAILED]", { error: error instanceof Error ? error.message : String(error) });
      return NextResponse.json({ error: "No se pudo preparar la foto" }, { status: 500 });
    }
  }, request);
}
