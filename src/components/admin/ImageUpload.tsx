"use client";

import { ArrowLeft, ArrowRight, GripVertical, ImagePlus, Trash2, UploadCloud } from "lucide-react";
import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { MAX_UPLOAD_BYTES } from "@/lib/api/endpoints/adminUploads";
import { useUploadAdminImage } from "@/lib/hooks/queries/admin/useAdminUploads";
import { Spinner } from "./AdminFeedback";
import { AdminImage } from "./AdminUI";
import { cx, friendlyError } from "./admin-utils";

function validateFile(file: File): string | null {
  if (!file.type.startsWith("image/")) return "يرجى اختيار ملف صورة صالح (PNG أو JPG أو WebP).";
  if (file.size > MAX_UPLOAD_BYTES) return "حجم الصورة يتجاوز 5MB.";
  return null;
}

// ---------------------------------------------------------------------------
// Single image
// ---------------------------------------------------------------------------
export function SingleImageUpload({
  value,
  onChange,
  label = "اختر صورة",
  aspect = "aspect-[4/3]",
  error,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  label?: string;
  aspect?: string;
  error?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState("");
  const upload = useUploadAdminImage();

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    const problem = validateFile(file);
    if (problem) {
      setLocalError(problem);
      return;
    }
    setLocalError("");
    upload.mutate(file, {
      onSuccess: (result) => onChange(result.url),
      onError: (uploadError) => setLocalError(friendlyError(uploadError, "تعذّر رفع الصورة. حاول مجددًا.")),
    });
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    handleFile(event.dataTransfer.files?.[0]);
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        aria-label={label}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          handleFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={onDrop}
        className={cx(
          "relative w-full overflow-hidden rounded-3xl border border-dashed bg-[#fbf8f2] transition",
          error || localError ? "border-red-300" : "border-[#cdb99f] hover:border-[#9e7548]",
          aspect,
        )}
      >
        {value ? (
          <>
            <AdminImage src={value} alt="معاينة الصورة" size={800} className="h-full w-full" />
            <div className="absolute inset-x-3 bottom-3 flex justify-between gap-2">
              <button type="button" onClick={() => inputRef.current?.click()} disabled={upload.isPending} className="rounded-xl bg-white/90 px-3 py-2 text-xs font-bold text-[#17130f] shadow backdrop-blur hover:bg-white disabled:opacity-60">
                تغيير الصورة
              </button>
              <button type="button" onClick={() => onChange(null)} disabled={upload.isPending} aria-label="إزالة الصورة" className="rounded-xl bg-white/90 p-2 text-red-600 shadow backdrop-blur hover:bg-white disabled:opacity-60">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={upload.isPending}
            className="flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-sm font-bold text-[#806f5e]"
          >
            <span className="rounded-2xl bg-white p-4 shadow-sm"><ImagePlus className="h-6 w-6 text-[#a27b4d]" /></span>
            {label}
            <small className="font-normal text-[#a39990]">اسحب صورة هنا أو اضغط للاختيار — حتى 5MB</small>
          </button>
        )}
        {upload.isPending && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/80 text-xs font-bold text-[#6f5a43] backdrop-blur-sm" aria-live="polite">
            <Spinner className="h-6 w-6" /> جارٍ رفع الصورة…
          </div>
        )}
      </div>
      {(error || localError) && <p role="alert" className="mt-2 text-xs font-bold text-red-600">{error || localError}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Multi image with drag-to-reorder (first = primary)
// ---------------------------------------------------------------------------
export function MultiImageUpload({
  value,
  onChange,
  error,
  max = 10,
}: {
  value: string[];
  onChange: (urls: string[]) => void;
  error?: string;
  max?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState("");
  const [uploading, setUploading] = useState(0);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const upload = useUploadAdminImage();

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files).slice(0, Math.max(0, max - value.length));
    if (!list.length) {
      setLocalError(`يمكن إضافة ${max} صور كحد أقصى.`);
      return;
    }
    const invalid = list.map(validateFile).find(Boolean);
    if (invalid) {
      setLocalError(invalid);
      return;
    }
    setLocalError("");
    setUploading(list.length);
    const uploaded: string[] = [];
    for (const file of list) {
      try {
        const result = await upload.mutateAsync(file);
        uploaded.push(result.url);
      } catch (uploadError) {
        setLocalError(friendlyError(uploadError, "تعذّر رفع إحدى الصور. حاول مجددًا."));
      } finally {
        setUploading((count) => count - 1);
      }
    }
    if (uploaded.length) onChange([...value, ...uploaded]);
  };

  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= value.length) return;
    const next = [...value];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  const remove = (index: number) => onChange(value.filter((_, candidate) => candidate !== index));

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        aria-label="إضافة صور المنتج"
        onChange={(event) => {
          void handleFiles(event.target.files);
          event.target.value = "";
        }}
      />
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="صور المنتج — الصورة الأولى هي الرئيسية">
        {value.map((url, index) => (
          <li
            key={url}
            draggable
            onDragStart={() => setDragIndex(index)}
            onDragOver={(event) => {
              event.preventDefault();
              if (overIndex !== index) setOverIndex(index);
            }}
            onDragLeave={() => setOverIndex(null)}
            onDrop={(event) => {
              event.preventDefault();
              if (dragIndex !== null) move(dragIndex, index);
              setDragIndex(null);
              setOverIndex(null);
            }}
            onDragEnd={() => {
              setDragIndex(null);
              setOverIndex(null);
            }}
            className={cx(
              "group relative aspect-square overflow-hidden rounded-2xl border bg-[#faf7f1] transition",
              index === 0 ? "border-[#c7a478] ring-2 ring-[#c7a478]/40" : "border-black/5",
              overIndex === index && dragIndex !== index && "scale-[0.97] border-[#9d7447]",
              dragIndex === index && "opacity-50",
            )}
          >
            <AdminImage src={url} alt={`صورة المنتج ${index + 1}`} size={400} className="h-full w-full" />
            {index === 0 && <span className="absolute right-2 top-2 rounded-full bg-[#17130f] px-2.5 py-1 text-[10px] font-black text-[#e3c79f]">الصورة الرئيسية</span>}
            <span className="absolute left-2 top-2 cursor-grab rounded-lg bg-white/85 p-1 text-[#8b8178] shadow" aria-hidden><GripVertical className="h-4 w-4" /></span>
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
              <button type="button" onClick={() => move(index, index - 1)} disabled={index === 0} aria-label="تحريك الصورة إلى الأمام" className="rounded-lg bg-white/90 p-1.5 text-[#17130f] disabled:opacity-30"><ArrowRight className="h-3.5 w-3.5" /></button>
              <button type="button" onClick={() => remove(index)} aria-label="إزالة الصورة" className="rounded-lg bg-white/90 p-1.5 text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
              <button type="button" onClick={() => move(index, index + 1)} disabled={index === value.length - 1} aria-label="تحريك الصورة إلى الخلف" className="rounded-lg bg-white/90 p-1.5 text-[#17130f] disabled:opacity-30"><ArrowLeft className="h-3.5 w-3.5" /></button>
            </div>
          </li>
        ))}
        {Array.from({ length: uploading }).map((_, index) => (
          <li key={`uploading-${index}`} className="flex aspect-square items-center justify-center rounded-2xl border border-dashed border-[#cdb99f] bg-[#fbf8f2] text-[#8b6a45]" aria-live="polite">
            <Spinner className="h-5 w-5" />
          </li>
        ))}
        {value.length + uploading < max && (
          <li>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                void handleFiles(event.dataTransfer.files);
              }}
              className={cx(
                "flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed bg-[#fbf8f2] text-xs font-bold text-[#806f5e] transition hover:border-[#9e7548]",
                error || localError ? "border-red-300" : "border-[#cdb99f]",
              )}
            >
              <UploadCloud className="h-6 w-6 text-[#a27b4d]" />
              إضافة صور
              <small className="font-normal text-[#a39990]">حتى 5MB لكل صورة</small>
            </button>
          </li>
        )}
      </ul>
      <p className="mt-2 text-xs text-[#9b9185]">اسحب الصور لإعادة ترتيبها — الصورة الأولى تظهر كصورة رئيسية في المتجر.</p>
      {(error || localError) && <p role="alert" className="mt-1 text-xs font-bold text-red-600">{error || localError}</p>}
    </div>
  );
}
