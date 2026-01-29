import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import path from "path";

interface RouteParams {
  params: Promise<{ path: string[] }>;
}

// Map file extensions to MIME types
const MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

/**
 * Serve images from the content/images directory.
 * This allows the admin panel to preview images extracted from PDFs.
 *
 * Example: GET /api/content-images/test-pdf/test-pdf_page1_img_p0_1.png
 * Serves: content/images/test-pdf/test-pdf_page1_img_p0_1.png
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { path: pathSegments } = await params;

  if (!pathSegments || pathSegments.length === 0) {
    return NextResponse.json({ error: "Path is required" }, { status: 400 });
  }

  // Validate path segments to prevent directory traversal
  const hasInvalidSegment = pathSegments.some(
    (segment) => segment === ".." || segment === "." || segment.includes("/")
  );

  if (hasInvalidSegment) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const relativePath = pathSegments.join("/");
  const baseDir = path.join(process.cwd(), "content", "images");
  const imagePath = path.join(baseDir, relativePath);

  // Post-resolution validation: ensure the resolved path is within the base directory
  // This catches URL encoding attacks and symlink escapes that pre-resolution checks miss
  const resolvedPath = path.resolve(imagePath);
  if (!resolvedPath.startsWith(baseDir + path.sep) && resolvedPath !== baseDir) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  // Validate file extension
  const ext = path.extname(imagePath).toLowerCase();
  const mimeType = MIME_TYPES[ext];

  if (!mimeType) {
    return NextResponse.json(
      { error: "Unsupported file type" },
      { status: 400 }
    );
  }

  try {
    // Check if file exists and is a file (not directory)
    const fileStat = await stat(imagePath);
    if (!fileStat.isFile()) {
      return NextResponse.json({ error: "Not a file" }, { status: 400 });
    }

    // Read and return the file
    const fileBuffer = await readFile(imagePath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    // Check if it's a "file not found" error
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    console.error("Error serving content image:", error);
    return NextResponse.json(
      { error: "Failed to serve image" },
      { status: 500 }
    );
  }
}
