"use client";

import { useState } from "react";
import Image, { type ImageProps } from "next/image";
import { NEUTRAL_CREDIT, NEUTRAL_IMAGE, parseImageProvenance, resolvePermittedImage } from "@/lib/image-provenance";

/** Public attribution excludes internal permission/review evidence. */
export function ImageAttribution({ source, className, link = true }: { source?: string; className?: string; link?: boolean }) {
  const provenance = parseImageProvenance(source);
  const credit = provenance?.credit ?? (source === NEUTRAL_CREDIT ? source : undefined);
  if (!credit) return null;
  return <span className={className}>{provenance ? <>{link ? <a href={provenance.sourcePage} target="_blank" rel="noopener noreferrer" className="underline">{credit}</a> : credit} · {provenance.license}{provenance.context === "thematic" ? " · Imagen temática, no representa el lugar" : ""}</> : credit}</span>;
}

type Props = Omit<ImageProps, "src" | "alt" | "blurDataURL"> & {
  image: string;
  imageSource?: string;
  blurDataUrl?: string;
  showCredit?: boolean;
  linkCredit?: boolean;
};

/** Recheck at the rendering boundary, including cached/optimistic story inputs. */
export function PermittedStoryImage({ image, imageSource, blurDataUrl, showCredit = true, linkCredit = true, onError, ...props }: Props) {
  const [failed, setFailed] = useState<string>();
  const permitted = resolvePermittedImage(image, imageSource, blurDataUrl);
  const identity = `${permitted.image}\0${permitted.imageSource}`;
  const fallback = failed === identity;
  const src = fallback ? NEUTRAL_IMAGE : permitted.image;
  const source = fallback ? NEUTRAL_CREDIT : permitted.imageSource;
  const provenance = parseImageProvenance(source);
  return <>
    <Image {...props} placeholder={props.placeholder === "blur" && (!permitted.blurDataUrl || fallback) ? "empty" : props.placeholder} src={src} alt={provenance?.alt ?? NEUTRAL_CREDIT}
      {...(permitted.blurDataUrl && !fallback ? { blurDataURL: permitted.blurDataUrl } : {})}
      onError={event => { setFailed(identity); onError?.(event); }} />
    {(showCredit || fallback) && <ImageAttribution source={source} link={linkCredit} className="absolute bottom-2 left-2 right-2 z-10 w-fit max-w-[calc(100%-1rem)] rounded bg-black/80 px-2 py-1 text-[10px] leading-snug text-white" />}
  </>;
}
