"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, MessageCircle, RefreshCw, RotateCcw, WifiOff } from "lucide-react";
import { describeError, type ErrorDescription } from "@/lib/api/errors";
import { ROUTES, WHATSAPP_SUPPORT_URL } from "@/lib/constants/routes";
import { Spinner } from "./Spinner";
import styles from "./ErrorState.module.css";

type ErrorStateProps = {
  /** Anything thrown: `AppError`, `Error`, axios error... mapped to Arabic copy. */
  error?: unknown;
  /** Override the mapped description entirely. */
  description?: Partial<ErrorDescription>;
  onRetry?: () => void;
  /** Shows a spinner on the retry button while the retry is in flight. */
  retrying?: boolean;
  /** `inline` for sections, `page` for full-height route errors, `banner` for compact notices. */
  variant?: "inline" | "page" | "banner";
  className?: string;
};

/**
 * Customer-facing error block. Never renders technical details — everything goes through
 * `describeError`, which only knows Arabic copy.
 */
export function ErrorState({ error, description, onRetry, retrying = false, variant = "inline", className }: ErrorStateProps) {
  const router = useRouter();
  const mapped = { ...describeError(error), ...description };
  const offline = typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "NETWORK_OFFLINE";
  const Icon = offline ? WifiOff : AlertCircle;

  const primary = (() => {
    switch (mapped.action) {
      case "retry":
        return onRetry ? (
          <button type="button" className="button" onClick={onRetry} disabled={retrying}>
            {retrying ? <Spinner size={16} tone="inverse" /> : <RotateCcw size={16} />} إعادة المحاولة
          </button>
        ) : (
          <button type="button" className="button" onClick={() => router.refresh()}>
            <RefreshCw size={16} /> تحديث الصفحة
          </button>
        );
      case "refresh":
        return (
          <button type="button" className="button" onClick={() => router.refresh()}>
            <RefreshCw size={16} /> تحديث الصفحة
          </button>
        );
      case "back":
        return (
          <button type="button" className="button" onClick={() => router.back()}>
            <ArrowRight size={16} /> الرجوع
          </button>
        );
      case "login":
        return <Link className="button" href={ROUTES.adminLogin}>تسجيل الدخول</Link>;
      case "support":
        return (
          <a className="button" href={WHATSAPP_SUPPORT_URL} target="_blank" rel="noreferrer">
            <MessageCircle size={16} /> تواصلي معنا
          </a>
        );
      default:
        return null;
    }
  })();

  if (variant === "banner") {
    return (
      <div className={[styles.banner, className].filter(Boolean).join(" ")} role="alert">
        <Icon size={18} />
        <div>
          <strong>{mapped.title}</strong>
          <span>{mapped.message}</span>
        </div>
        {onRetry && mapped.isRetryable && (
          <button type="button" className={styles.bannerAction} onClick={onRetry} disabled={retrying}>
            {retrying ? <Spinner size={14} /> : <RotateCcw size={14} />} إعادة المحاولة
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={[styles.state, variant === "page" ? styles.page : "", className].filter(Boolean).join(" ")} role="alert">
      <span className={styles.icon}><Icon size={34} strokeWidth={1.4} /></span>
      <h2 className={styles.title}>{mapped.title}</h2>
      <p className={styles.message}>{mapped.message}</p>
      <div className={styles.actions}>
        {primary}
        {mapped.action !== "back" && variant === "page" && (
          <Link className="button secondary" href={ROUTES.home}>الرئيسية</Link>
        )}
        {mapped.action === "back" && (
          <Link className="button secondary" href={ROUTES.products}>تصفّحي المتجر</Link>
        )}
        {mapped.action !== "support" && variant === "page" && (
          <a className={styles.support} href={WHATSAPP_SUPPORT_URL} target="_blank" rel="noreferrer">
            <MessageCircle size={14} /> تحتاجين مساعدة؟
          </a>
        )}
      </div>
    </div>
  );
}
