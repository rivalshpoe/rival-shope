"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";

const PLACEHOLDER = "/brand/image-placeholder.svg";

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
