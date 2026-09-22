import styles from "./Spinner.module.css";

type SpinnerProps = {
  size?: number;
  /** Accessible label; omit when the surrounding element already describes the state. */
  label?: string;
  className?: string;
  /** `inverse` for use on dark backgrounds (e.g. inside primary buttons). */
  tone?: "ink" | "inverse" | "champagne";
};

/** Elegant two-ring spinner used inline in buttons and as a section loader. */
export function Spinner({ size = 20, label, className, tone = "ink" }: SpinnerProps) {
  return (
    <span
      className={[styles.spinner, styles[tone], className].filter(Boolean).join(" ")}
      style={{ width: size, height: size }}
      role={label ? "status" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <span className={styles.ring} />
      <span className={styles.core} />
    </span>
  );
}

/** Centered block loader for whole sections. */
export function SectionLoader({ label = "جارٍ التحميل..." }: { label?: string }) {
  return (
    <div className={styles.block} role="status" aria-live="polite">
      <Spinner size={30} tone="champagne" />
      <span>{label}</span>
    </div>
  );
}
