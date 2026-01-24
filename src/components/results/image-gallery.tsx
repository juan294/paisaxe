"use client";

import Image from "next/image";
import type { ImageResult } from "@/types";

interface ImageGalleryProps {
  images: ImageResult[];
}

export function ImageGallery({ images }: ImageGalleryProps) {
  if (images.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 mt-2">
      {images.slice(0, 4).map((image) => (
        <div
          key={image.id}
          className="relative flex-shrink-0 w-32 h-24 rounded-lg overflow-hidden bg-muted"
        >
          <Image
            src={image.path}
            alt={image.caption || "Imagen de Asturias"}
            fill
            className="object-cover"
            sizes="128px"
          />
          {image.caption && (
            <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1">
              <p className="text-white text-xs truncate">{image.caption}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
