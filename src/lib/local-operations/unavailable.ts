import { NextResponse } from "next/server";

/** Production capability: deliberately has no local-operation dependencies. */
function unavailable() {
  return NextResponse.json(
    { error: "Solo disponible en desarrollo local. Inicia la aplicación con npm run dev.", localOnly: true },
    { status: 403, headers: { "Cache-Control": "private, no-store" } },
  );
}

export { unavailable as GET, unavailable as POST, unavailable as DELETE };
