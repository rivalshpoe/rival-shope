"use client";

import { ChevronLeft, ChevronRight, ImageOff, Search, X } from "lucide-react";
import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { SmartImage } from "@/components/ui/SmartImage";
import type { Pagination as PaginationInfo } from "@/types/api.types";
import { Spinner } from "./AdminFeedback";
import { cx, formatNumber, type Tone } from "./admin-utils";

export const panelClass =
  "rounded-[1.75rem] border border-black/5 bg-white shadow-[0_18px_50px_rgba(30,24,18,0.06)]";
export const inputClass =
  "w-full rounded-2xl border border-black/10 bg-[#fbf8f2] px-4 py-3 text-sm text-[#17130f] outline-none transition placeholder:text-[#9b9185] focus:border-[#b68a55] focus:ring-4 focus:ring-[#c7a478]/10 disabled:cursor-not-allowed disabled:opacity-60";
export const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-2xl bg-[#141210] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#2b251f] disabled:cursor-not-allowed disabled:opacity-50";
export const secondaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-2xl border border-black/10 bg-white px-5 py-3 text-sm font-bold text-[#211c17] transition hover:border-[#c7a478] hover:bg-[#faf7f1] disabled:cursor-not-allowed disabled:opacity-50";
export const dangerButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-2xl bg-red-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50";
export const ghostIconClass =
  "rounded-xl p-2 text-[#81766c] transition hover:bg-black/5 hover:text-[#17130f] disabled:cursor-not-allowed disabled:opacity-40";

// ---------------------------------------------------------------------------
export function PageTitle({
  title,
  eyebrow,
  description,
  action,
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="mb-2 text-xs font-bold tracking-[0.2em] text-[#a47c4c]">{eyebrow}</p>}
        <h1 className="font-display text-3xl font-semibold text-[#17130f] lg:text-4xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm leading-7 text-[#786f66]">{description}</p>}
      </div>
      {action && <div className="flex flex-wrap gap-2">{action}</div>}
    </div>
  );
}

export function Badge({ children, tone = "slate", className, title }: { children: ReactNode; tone?: Tone; className?: string; title?: string }) {
  const tones: Record<Tone, string> = {
    green: "bg-emerald-50 text-emerald-700 ring-emerald-600/10",
    amber: "bg-amber-50 text-amber-700 ring-amber-600/10",
    red: "bg-red-50 text-red-700 ring-red-600/10",
    slate: "bg-slate-50 text-slate-600 ring-slate-500/10",
    blue: "bg-blue-50 text-blue-700 ring-blue-600/10",
    gold: "bg-[#f5ebdb] text-[#8a5f33] ring-[#c7a478]/30",
  };
  return <span title={title} className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset", tones[tone], className)}>{children}</span>;
}

export function StatCard({
  title,
  value,
  note,
  icon,
  accent = false,
  tone,
}: {
  title: string;
  value: string;
  note?: string;
  icon: ReactNode;
  accent?: boolean;
  tone?: "red" | "amber" | "green";
}) {
  const noteColor = accent ? "text-[#dec39e]" : tone === "red" ? "text-red-600" : tone === "amber" ? "text-amber-700" : "text-emerald-700";
  return (
    <article className={cx(panelClass, "relative overflow-hidden p-5", accent && "bg-[#17130f] text-white")}>
      <div className={cx("absolute -left-8 -top-8 h-28 w-28 rounded-full", accent ? "bg-[#c7a478]/15" : "bg-[#f4eadc]")} />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={cx("text-sm", accent ? "text-white/60" : "text-[#857b70]")}>{title}</p>
          <p className="mt-3 truncate text-2xl font-black">{value}</p>
          {note && <p className={cx("mt-2 text-xs", noteColor)}>{note}</p>}
        </div>
        <span className={cx("shrink-0 rounded-2xl p-3", accent ? "bg-white/10 text-[#e1c49d]" : "bg-[#f5eee4] text-[#9b7244]")}>{icon}</span>
      </div>
    </article>
  );
}

export function Field({
  label,
  required,
  error,
  hint,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-2 block text-sm font-bold text-[#332c25]">
        {label} {required && <span className="text-red-600" aria-hidden>*</span>}
      </span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-[#9b9185]">{hint}</span>}
      {error && <span role="alert" className="mt-1 block text-xs font-bold text-red-600">{error}</span>}
    </label>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-2xl bg-[#faf7f1] p-4 text-right text-sm font-bold transition hover:bg-[#f5efe5] disabled:opacity-60"
    >
      <span>
        <span className="block">{label}</span>
        {description && <span className="mt-0.5 block text-xs font-normal text-[#8b8178]">{description}</span>}
      </span>
      <span className={cx("relative h-6 w-11 shrink-0 rounded-full transition", checked ? "bg-[#9d7447]" : "bg-[#d9d1c5]")}>
        <span className={cx("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", checked ? "left-0.5" : "left-[1.375rem]")} />
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
export function PendingButton({
  isPending,
  children,
  className = buttonClass,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { isPending?: boolean }) {
  return (
    <button {...rest} className={className} disabled={rest.disabled || isPending} aria-busy={isPending}>
      {isPending && <Spinner />}
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
export function AdminImage({
  src,
  alt,
  className,
  size = 96,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  size?: number;
}) {
  if (!src) {
    return (
      <span className={cx("flex items-center justify-center bg-[#f0e6d9] text-[#b39a7a]", className)} aria-label={alt} role="img">
        <ImageOff className="h-4 w-4" />
      </span>
    );
  }
  return (
    <SmartImage
      src={src}
      alt={alt}
      width={size}
      height={size}
      sizes={`${size}px`}
      unoptimized
      className={cx("object-cover", className)}
    />
  );
}

// ---------------------------------------------------------------------------
export function SearchInput({
  value,
  onChange,
  placeholder = "ابحث...",
  className,
  delay = 350,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  delay?: number;
}) {
  const [draft, setDraft] = useState(value);
  // Re-sync the draft when the controlled value changes externally (e.g. filters reset).
  const [lastValue, setLastValue] = useState(value);
  if (lastValue !== value) {
    setLastValue(value);
    setDraft(value);
  }
  useEffect(() => {
    if (draft === value) return;
    const timer = window.setTimeout(() => onChange(draft), delay);
    return () => window.clearTimeout(timer);
  }, [draft, value, onChange, delay]);

  return (
    <label className={cx("relative block", className)}>
      <Search className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8c8176]" />
      <input
        type="search"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        className={cx(inputClass, "pr-11 pl-10")}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      {draft && (
        <button type="button" aria-label="مسح البحث" onClick={() => { setDraft(""); onChange(""); }} className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full p-1 hover:bg-black/5">
          <X className="h-4 w-4" />
        </button>
      )}
    </label>
  );
}

export function Pagination({
  pagination,
  onPageChange,
  isFetching = false,
}: {
  pagination: PaginationInfo | undefined;
  onPageChange: (page: number) => void;
  isFetching?: boolean;
}) {
  if (!pagination || pagination.totalPages <= 1) {
    return pagination ? <p className="px-5 py-4 text-xs text-[#8c8176]">{formatNumber(pagination.totalItems)} عنصر</p> : null;
  }
  const { page, totalPages, totalItems } = pagination;
  return (
    <div className="flex items-center justify-between gap-3 border-t border-black/5 px-5 py-4">
      <p className="text-xs text-[#8c8176]">
        صفحة {formatNumber(page)} من {formatNumber(totalPages)} • {formatNumber(totalItems)} عنصر
        {isFetching && <Spinner className="mr-2 inline-block h-3 w-3" />}
      </p>
      <div className="flex gap-2">
        <button type="button" aria-label="الصفحة السابقة" disabled={page <= 1} onClick={() => onPageChange(page - 1)} className="rounded-xl border border-black/10 p-2 transition hover:bg-[#faf7f1] disabled:opacity-30">
          <ChevronRight className="h-4 w-4" />
        </button>
        <button type="button" aria-label="الصفحة التالية" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} className="rounded-xl border border-black/10 p-2 transition hover:bg-[#faf7f1] disabled:opacity-30">
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
export interface Column<T> {
  key: string;
  label: string;
  render: (item: T) => ReactNode;
  className?: string;
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  minWidth = "min-w-[760px]",
  emptyState,
  isFetching = false,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (item: T) => string;
  minWidth?: string;
  emptyState?: ReactNode;
  isFetching?: boolean;
}) {
  return (
    <div className={cx("overflow-x-auto transition", isFetching && "opacity-60")}>
      <table className={cx("w-full text-right", minWidth)}>
        <thead className="bg-[#faf7f1] text-xs text-[#756a5f]">
          <tr>{columns.map((column) => <th key={column.key} scope="col" className={cx("px-5 py-4 font-bold", column.className)}>{column.label}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-black/5">
          {rows.map((row) => (
            <tr key={rowKey(row)} className="text-sm text-[#322b25] transition hover:bg-[#fcfaf6]">
              {columns.map((column) => <td key={column.key} className={cx("px-5 py-4 align-middle", column.className)}>{column.render(row)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && (emptyState ?? <p className="p-12 text-center text-sm text-[#8c8176]">لا توجد نتائج مطابقة</p>)}
    </div>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  ariaLabel,
}: {
  tabs: Array<{ value: T; label: string; count?: number }>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="flex flex-wrap gap-1 rounded-2xl bg-[#efe8dd] p-1">
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={cx(
              "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition",
              active ? "bg-white text-[#17130f] shadow-sm" : "text-[#756a5f] hover:text-[#17130f]",
            )}
          >
            {tab.label}
            {typeof tab.count === "number" && <span className={cx("rounded-full px-1.5 py-0.5 text-[10px]", active ? "bg-[#f3ebdf] text-[#8a5f33]" : "bg-black/5")}>{formatNumber(tab.count)}</span>}
          </button>
        );
      })}
    </div>
  );
}

const STAR_PATH = "M12 2.5l2.9 6.2 6.7.8-5 4.6 1.3 6.7L12 17.5l-5.9 3.3 1.3-6.7-5-4.6 6.7-.8z";

/** Read-only star rating, or an interactive radio-group when `onChange` is provided. */
export function Stars({ value, onChange, size = "sm" }: { value: number; onChange?: (value: number) => void; size?: "sm" | "lg" }) {
  const sizeClass = size === "lg" ? "h-8 w-8" : "h-4 w-4";
  if (!onChange) {
    return (
      <span dir="ltr" className="inline-flex" role="img" aria-label={`${value} من 5`}>
        {Array.from({ length: 5 }).map((_, index) => (
          <svg key={index} viewBox="0 0 24 24" className={cx(sizeClass, index < value ? "fill-[#bf8f52]" : "fill-[#e5ddd2]")} aria-hidden>
            <path d={STAR_PATH} />
          </svg>
        ))}
      </span>
    );
  }
  return (
    <div dir="ltr" role="radiogroup" aria-label="التقييم" className="inline-flex gap-1">
      {Array.from({ length: 5 }).map((_, index) => {
        const star = index + 1;
        return (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} من 5`}
            onClick={() => onChange(star)}
            className="rounded-lg p-0.5 transition hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c7a478]"
          >
            <svg viewBox="0 0 24 24" className={cx(sizeClass, star <= value ? "fill-[#bf8f52]" : "fill-[#e5ddd2]")} aria-hidden>
              <path d={STAR_PATH} />
            </svg>
          </button>
        );
      })}
    </div>
  );
}
