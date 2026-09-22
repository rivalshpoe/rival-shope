import type { ReactNode } from "react";

type SectionHeadProps = {
  title: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  /** Use `h1` on page-level headings. */
  as?: "h1" | "h2";
  /** `light` on dark backgrounds, `compact` for nested sections, `start` for start-aligned. */
  tone?: "default" | "light";
  size?: "default" | "compact";
  align?: "center" | "start";
  id?: string;
  className?: string;
  /** Optional trailing content rendered under the heading (links, controls). */
  children?: ReactNode;
};

/** The single section heading used across the storefront (see `.section-head` in globals.css). */
export function SectionHead({
  title,
  eyebrow,
  description,
  as: Tag = "h2",
  tone = "default",
  size = "default",
  align = "center",
  id,
  className,
  children,
}: SectionHeadProps) {
  const classes = [
    "section-head",
    tone === "light" ? "light" : "",
    size === "compact" ? "compact" : "",
    align === "start" ? "start" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <header className={classes}>
      {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
      <Tag id={id}>{title}</Tag>
      {description ? <p>{description}</p> : null}
      {children}
    </header>
  );
}
