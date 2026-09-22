"use client";

import { AlertTriangle, CheckCircle2, Inbox, LoaderCircle, RotateCcw, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cx } from "./admin-utils";

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------
export function AdminError({
  title,
  message = "تعذّر تحميل البيانات. تحقق من اتصالك وحاول مجددًا.",
  onRetry,
  isRetrying = false,
  compact = false,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  isRetrying?: boolean;
  compact?: boolean;
}) {
  return (
    <div
      role="alert"
      className={cx(
        "flex flex-col items-center justify-center gap-4 rounded-[1.75rem] border border-red-100 bg-red-50/60 text-center",
        compact ? "p-6" : "p-12",
      )}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-red-600 shadow-sm">
        <AlertTriangle className="h-6 w-6" />
      </span>
      {title && <p className="text-base font-black text-red-900">{title}</p>}
      <p className="max-w-md text-sm font-bold leading-6 text-red-800">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          disabled={isRetrying}
          className="inline-flex items-center gap-2 rounded-2xl bg-[#17130f] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#2b251f] disabled:opacity-50"
        >
          {isRetrying ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
          إعادة المحاولة
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------
const shimmer = "relative overflow-hidden bg-[#ece5da] before:absolute before:inset-0 before:translate-x-full before:animate-shimmer before:bg-gradient-to-r before:from-transparent before:via-white/70 before:to-transparent";

function Bar({ w = "w-full", h = "h-4" }: { w?: string; h?: string }) {
  return <div className={cx("rounded-lg", shimmer, w, h)} />;
}

export function AdminSkeleton({
  variant = "table",
  rows = 5,
  className,
}: {
  variant?: "table" | "cards" | "form" | "lines" | "detail";
  rows?: number;
  className?: string;
}) {
  const items = Array.from({ length: rows });

  if (variant === "cards") {
    return (
      <div aria-busy="true" aria-label="جارٍ التحميل" className={cx("grid gap-4 sm:grid-cols-2 xl:grid-cols-4", className)}>
        {items.map((_, index) => (
          <div key={index} className="rounded-[1.75rem] border border-black/5 bg-white p-5">
            <Bar w="w-24" h="h-3" />
            <div className="mt-4"><Bar w="w-32" h="h-7" /></div>
            <div className="mt-3"><Bar w="w-20" h="h-3" /></div>
          </div>
        ))}
      </div>
    );
  }
  if (variant === "form") {
    return (
      <div aria-busy="true" aria-label="جارٍ التحميل" className={cx("rounded-[1.75rem] border border-black/5 bg-white p-6", className)}>
        <div className="grid gap-5 sm:grid-cols-2">
          {items.map((_, index) => (
            <div key={index} className={index % 3 === 2 ? "sm:col-span-2" : ""}>
              <Bar w="w-24" h="h-3" />
              <div className="mt-2"><Bar h="h-11" /></div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (variant === "lines") {
    return (
      <div aria-busy="true" aria-label="جارٍ التحميل" className={cx("space-y-3", className)}>
        {items.map((_, index) => <Bar key={index} w={index % 2 ? "w-3/4" : "w-full"} />)}
      </div>
    );
  }
  if (variant === "detail") {
    return (
      <div aria-busy="true" aria-label="جارٍ التحميل" className={cx("grid gap-5 xl:grid-cols-[1.55fr_1fr]", className)}>
        <div className="rounded-[1.75rem] border border-black/5 bg-white p-6">
          {items.map((_, index) => (
            <div key={index} className="flex items-center gap-4 border-b border-black/5 py-4 last:border-0">
              <div className={cx("h-14 w-14 rounded-2xl", shimmer)} />
              <div className="flex-1 space-y-2"><Bar w="w-1/2" /><Bar w="w-1/3" h="h-3" /></div>
              <Bar w="w-16" />
            </div>
          ))}
        </div>
        <div className="space-y-5">
          <div className="rounded-[1.75rem] border border-black/5 bg-white p-6 space-y-3"><Bar w="w-1/3" /><Bar h="h-11" /><Bar h="h-11" /></div>
          <div className="rounded-[1.75rem] border border-black/5 bg-white p-6 space-y-3"><Bar w="w-1/3" /><Bar /><Bar w="w-2/3" /></div>
        </div>
      </div>
    );
  }
  return (
    <div aria-busy="true" aria-label="جارٍ التحميل" className={cx("overflow-hidden rounded-[1.75rem] border border-black/5 bg-white", className)}>
      <div className="border-b border-black/5 bg-[#faf7f1] p-4"><Bar w="w-64" h="h-10" /></div>
      {items.map((_, index) => (
        <div key={index} className="flex items-center gap-4 border-b border-black/5 px-5 py-4 last:border-0">
          <div className={cx("h-11 w-11 shrink-0 rounded-xl", shimmer)} />
          <Bar w="w-1/4" />
          <Bar w="w-1/6" />
          <Bar w="w-1/6" />
          <div className="mr-auto"><Bar w="w-20" h="h-6" /></div>
        </div>
      ))}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle aria-hidden className={cx("h-4 w-4 animate-spin", className)} />;
}

// ---------------------------------------------------------------------------
// Empty
// ---------------------------------------------------------------------------
export function AdminEmpty({
  title = "لا توجد بيانات",
  description,
  action,
  icon,
  compact = false,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={cx("flex flex-col items-center justify-center gap-3 text-center", compact ? "p-8" : "p-14")}>
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f3ebdf] text-[#9c7447]">{icon ?? <Inbox className="h-6 w-6" />}</span>
      <p className="text-sm font-bold text-[#2b241e]">{title}</p>
      {description && <p className="max-w-sm text-xs leading-5 text-[#8b8178]">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal (focus trap + Escape)
// ---------------------------------------------------------------------------
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function AdminModal({
  open,
  onClose,
  title,
  description,
  children,
  size = "md",
  closeOnBackdrop = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  closeOnBackdrop?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const focusables = () => Array.from(panel?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter((el) => el.offsetParent !== null || el === document.activeElement);
    const timer = window.setTimeout(() => {
      const first = focusables().find((el) => !el.hasAttribute("data-autofocus-skip")) ?? panel;
      first?.focus();
    }, 20);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const list = focusables();
      if (!list.length) {
        event.preventDefault();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      if (event.shiftKey && (document.activeElement === first || !panel?.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !panel?.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  const widths = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl", xl: "max-w-5xl" };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-6" dir="rtl">
      <button
        type="button"
        aria-label="إغلاق النافذة"
        tabIndex={-1}
        onClick={closeOnBackdrop ? onClose : undefined}
        className="absolute inset-0 bg-[#17130f]/55 backdrop-blur-sm"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cx(
          "relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[2rem] bg-white shadow-2xl outline-none sm:rounded-[2rem]",
          widths[size],
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-black/5 px-6 py-5">
          <div>
            <h2 id={titleId} className="text-lg font-black text-[#17130f]">{title}</h2>
            {description && <p id={descriptionId} className="mt-1 text-xs leading-5 text-[#8b8178]">{description}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="إغلاق" className="rounded-xl p-2 text-[#8b8178] transition hover:bg-black/5 hover:text-[#17130f]">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Confirm dialog
// ---------------------------------------------------------------------------
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "تأكيد",
  cancelLabel = "إلغاء",
  tone = "danger",
  isPending = false,
  error,
  onConfirm,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "primary" | "warning";
  isPending?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
  children?: ReactNode;
}) {
  const handleClose = useCallback(() => {
    if (!isPending) onClose();
  }, [isPending, onClose]);
  const toneClass = {
    danger: "bg-red-600 hover:bg-red-700 text-white",
    warning: "bg-amber-600 hover:bg-amber-700 text-white",
    primary: "bg-[#17130f] hover:bg-[#2b251f] text-white",
  }[tone];

  return (
    <AdminModal open={open} onClose={handleClose} title={title} description={description} size="sm" closeOnBackdrop={!isPending}>
      {children}
      {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700">{error}</p>}
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={handleClose}
          disabled={isPending}
          className="rounded-2xl border border-black/10 px-5 py-3 text-sm font-bold text-[#211c17] transition hover:bg-[#faf7f1] disabled:opacity-50"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isPending}
          data-autofocus-skip
          className={cx("inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60", toneClass)}
        >
          {isPending && <Spinner />}
          {confirmLabel}
        </button>
      </div>
    </AdminModal>
  );
}

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------
type ToastTone = "success" | "error" | "info";
interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  show: (message: string, tone?: ToastTone) => void;
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function Toast({ message, tone = "success", onClose }: { message: string; tone?: ToastTone; onClose: () => void }) {
  const Icon = tone === "error" ? AlertTriangle : CheckCircle2;
  return (
    <div
      role="status"
      aria-live="polite"
      className={cx(
        "pointer-events-auto flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-white shadow-2xl",
        tone === "error" ? "bg-red-700" : tone === "info" ? "bg-[#4a3b2c]" : "bg-[#17130f]",
      )}
    >
      <Icon className={cx("h-4 w-4 shrink-0", tone === "error" ? "text-red-200" : "text-[#d5b07f]")} />
      <span className="leading-5">{message}</span>
      <button type="button" onClick={onClose} aria-label="إغلاق التنبيه" className="mr-1 rounded-lg p-1 text-white/60 hover:bg-white/10 hover:text-white">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => setToasts((current) => current.filter((toast) => toast.id !== id)), []);
  const show = useCallback(
    (message: string, tone: ToastTone = "success") => {
      const id = ++counter.current;
      setToasts((current) => [...current.slice(-3), { id, message, tone }]);
      window.setTimeout(() => dismiss(id), tone === "error" ? 6000 : 3800);
    },
    [dismiss],
  );
  const value = useMemo<ToastContextValue>(
    () => ({ show, success: (message) => show(message, "success"), error: (message) => show(message, "error") }),
    [show],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-5 left-5 z-[90] flex max-w-[calc(100vw-2.5rem)] flex-col gap-2 sm:max-w-sm" dir="rtl">
        {toasts.map((toast) => <Toast key={toast.id} message={toast.message} tone={toast.tone} onClose={() => dismiss(toast.id)} />)}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    return { show: () => undefined, success: () => undefined, error: () => undefined };
  }
  return context;
}
