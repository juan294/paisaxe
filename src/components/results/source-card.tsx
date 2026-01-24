"use client";

import { FileText } from "lucide-react";
import type { Source } from "@/types";

interface SourceCardProps {
  source: Source;
}

export function SourceCard({ source }: SourceCardProps) {
  const displayName = source.sourcePdf
    .replace(".pdf", "")
    .replace(/-/g, " ")
    .replace(/ES$/, "");

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-full text-xs text-muted-foreground hover:bg-muted transition-colors cursor-default">
      <FileText className="h-3 w-3" />
      <span className="truncate max-w-[150px]">{displayName}</span>
      {source.pageNumber && (
        <span className="text-muted-foreground/70">p.{source.pageNumber}</span>
      )}
    </div>
  );
}
