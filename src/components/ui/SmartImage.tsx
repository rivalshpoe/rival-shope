"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";

const PLACEHOLDER = "/brand/image-placeholder.svg";

/** Files saved by the API live at `/uploads`, outside the Next.js public folder. */
function isStoredUpload(src: string): boolean {
  try {
    const path = src.startsWith("/") ? src : new URL(src, "http://rival.local").pathname;
    return path === "/uploads" || path.startsWith("/uploads/");
  } catch {
    return src.includes("/uploads/");
  }
}

type SmartImageProps = Omit<ImageProps, "src" | "width" | "height" | "priority" | "preload" | "loading" | "fetchPriority" | "fill"> & {
  src: string;
  width?: number;
  height?: number;
  /** Fills the parent (parent must be `position: relative`). */
  fill?: boolean;
  /**
   * Marks the LCP / above-the-fold image (hero, first product image).
   * Everything else is lazy-loaded by default.
   */
  priority?: boolean;
};

/**
 * `next/image` wrapper with lazy loading by default, a graceful fallback when a remote
 * image fails, and a `priority` flag for LCP images (eager + high fetch priority).
 */
export function SmartImage({
  src,
  alt,
  width = 900,
  height = 1100,
  fill = false,
  priority = false,
  sizes = "(max-width: 768px) 100vw, 50vw",
  ...props
}: SmartImageProps) {
  // Track the failed src so a new `src` prop clears the fallback without an effect.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const source = !src || failedSrc === src ? PLACEHOLDER : src;

  const dimensionProps = fill ? { fill: true as const } : { width, height };
  // Next 16 deprecates `priority`; the docs recommend eager loading + high fetch priority for LCP images.
  const loadingProps = priority
    ? { loading: "eager" as const, fetchPriority: "high" as const }
    : { loading: "lazy" as const };

  // next/image treats a root-relative src as a file in `public/`. Uploaded images are served
  // by the API, so a plain img is required or the missing file is swapped for the placeholder.
  if (isStoredUpload(source)) {
    return (
      <img
        src={source}
        alt={alt}
        width={fill ? undefined : width}
        height={fill ? undefined : height}
        className={props.className}
        style={fill ? { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" } : undefined}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        onError={() => setFailedSrc(src)}
      />
    );
  }

  return (
    <Image
      {...props}
      {...dimensionProps}
      {...loadingProps}
      src={source}
      alt={alt}
      sizes={sizes}
      onError={() => setFailedSrc(src)}
    />
  );
}
