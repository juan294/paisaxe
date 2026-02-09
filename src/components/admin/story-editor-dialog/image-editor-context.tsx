"use client";

import { createContext, useContext } from "react";
import type { ImageEditorState } from "./use-image-editor";

const ImageEditorContext = createContext<ImageEditorState | null>(null);

export function ImageEditorProvider({
  value,
  children,
}: {
  value: ImageEditorState;
  children: React.ReactNode;
}) {
  return (
    <ImageEditorContext.Provider value={value}>
      {children}
    </ImageEditorContext.Provider>
  );
}

/**
 * Consume the image editor context.
 * Must be called within an ImageEditorProvider.
 */
export function useImageEditorContext(): ImageEditorState {
  const ctx = useContext(ImageEditorContext);
  if (!ctx) {
    throw new Error("useImageEditorContext must be used within an ImageEditorProvider");
  }
  return ctx;
}
