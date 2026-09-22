"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CirclePercent, Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import {
  useAdminDiscountCodes,
  useCreateAdminDiscountCode,
  useDeleteAdminDiscountCode,
  useUpdateAdminDiscountCode,
} from "@/lib/hooks/queries/admin/useAdminDiscountCodes";
import type { AdminDiscountCode, AdminDiscountCodeInput } from "@/types/admin.types";
import { AdminEmpty, AdminError, AdminModal, AdminSkeleton, ConfirmDialog, useToast } from "./AdminFeedback";
import { Badge, buttonClass, DataTable, Field, ghostIconClass, inputClass, PageTitle, panelClass, PendingButton, secondaryButtonClass, Toggle } from "./AdminUI";
import { cx, fieldErrorsOf, formatDateTime, formatNumber, friendlyError, fromDatetimeLocal, toDatetimeLocal, type Tone } from "./admin-utils";

const schema = z
  .object({
    code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,20}$/, "الكود من 3 إلى 20 حرفًا/رقمًا لاتينيًا بدون مسافات"),
    percentageOff: z.number({ error: "أدخل نسبة" }).int("أدخل عددًا صحيحًا").min(1, "النسبة بين 1 و100").max(100, "النسبة بين 1 و100"),
    startAt: z.string().min(1, "حدد تاريخ البداية"),
    endAt: z.string().min(1, "حدد تاريخ النهاية"),
    isActive: z.boolean(),
  })
  .refine((values) => !values.startAt || !values.endAt || values.startAt < values.endAt, { path: ["endAt"], message: "تاريخ النهاية يجب أن يكون بعد البداية" });
type FormValues = z.infer<typeof schema>;

function validityOf(code: AdminDiscountCode): { label: string; tone: Tone } {
  if (!code.isActive) return { label: "متوقف", tone: "slate" };
  if (code.isCurrentlyValid) return { label: "ساري الآن", tone: "green" };
  const now = Date.now();
  if (new Date(code.startAt).getTime() > now) return { label: "لم يبدأ بعد", tone: "blue" };
  return { label: "منتهي", tone: "red" };
}

/** New codes default to a 30-day window starting now. */
function buildDefaults(code: AdminDiscountCode | null): FormValues {
  const now = Date.now();
  return {
    code: code?.code ?? "",
    percentageOff: code?.percentageOff ?? 10,
    startAt: toDatetimeLocal(code?.startAt ?? new Date(now).toISOString()),
    endAt: toDatetimeLocal(code?.endAt ?? new Date(now + 30 * 86_400_000).toISOString()),
    isActive: code?.isActive ?? true,
  };
}

function DiscountForm({ code, onClose }: { code: AdminDiscountCode | null; onClose: () => void }) {
  const toast = useToast();
  const create = useCreateAdminDiscountCode();
  const update = useUpdateAdminDiscountCode();
  const mutation = code ? update : create;
  const [serverError, setServerError] = useState("");
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: buildDefaults(code),
  });
  const errors = form.formState.errors;

  const submit = form.handleSubmit((values) => {
    setServerError("");
    const input: AdminDiscountCodeInput = {
      code: values.code,
      percentageOff: values.percentageOff,
      startAt: fromDatetimeLocal(values.startAt) ?? new Date().toISOString(),
      endAt: fromDatetimeLocal(values.endAt) ?? new Date().toISOString(),
      isActive: values.isActive,
    };
    const options = {
      onSuccess: () => {
        toast.success(code ? "تم حفظ كود الخصم" : "تم إنشاء كود الخصم");
        onClose();
      },
      onError: (error: unknown) => {
        Object.entries(fieldErrorsOf(error)).forEach(([field, message]) => form.setError(field as keyof FormValues, { message }));
        setServerError(friendlyError(error, "تعذّر حفظ الكود. حاول مجددًا."));
      },
    };
    if (code) update.mutate({ id: code.id, input }, options);
    else create.mutate(input, options);
  });

  return (
    <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
      <Field label="الكود" required error={errors.code?.message}>
        <input {...form.register("code")} dir="ltr" className={cx(inputClass, "text-left font-mono uppercase")} placeholder="RIVAL20" autoFocus />
      </Field>
      <Field label="نسبة الخصم (%)" required error={errors.percentageOff?.message}>
        <input {...form.register("percentageOff", { setValueAs: (value: string) => (value === "" ? Number.NaN : Number(value)) })} type="number" min={1} max={100} className={inputClass} />
      </Field>
      <Field label="يبدأ في" required error={errors.startAt?.message}>
        <input {...form.register("startAt")} type="datetime-local" dir="ltr" className={cx(inputClass, "text-left")} />
      </Field>
      <Field label="ينتهي في" required error={errors.endAt?.message}>
        <input {...form.register("endAt")} type="datetime-local" dir="ltr" className={cx(inputClass, "text-left")} />
      </Field>
      <div className="sm:col-span-2">
        <Controller control={form.control} name="isActive" render={({ field }) => <Toggle checked={field.value} onChange={field.onChange} label="فعّال" description="يمكن إيقاف الكود مؤقتًا دون حذفه" />} />
      </div>
      {serverError && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700 sm:col-span-2">{serverError}</p>}
      <div className="flex flex-col-reverse gap-2 sm:col-span-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} disabled={mutation.isPending} className={secondaryButtonClass}>إلغاء</button>
        <PendingButton type="submit" isPending={mutation.isPending}>{code ? "حفظ التعديلات" : "إنشاء الكود"}</PendingButton>
      </div>
    </form>
  );
}

export function DiscountCodesPage() {
  const toast = useToast();
  const query = useAdminDiscountCodes();
  const remove = useDeleteAdminDiscountCode();
  const [editing, setEditing] = useState<AdminDiscountCode | null | "new">(null);
  const [deleting, setDeleting] = useState<AdminDiscountCode | null>(null);
  const closeForm = useCallback(() => setEditing(null), []);

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("تم نسخ الكود");
    } catch {
      toast.error("تعذّر النسخ إلى الحافظة.");
    }
  };

  return (
    <>
      <PageTitle
        eyebrow="التسويق"
        title="أكواد الخصم"
        description="أنشئ عروضًا محدودة بنسبة مئوية وتابع استخدامها وصلاحيتها."
        action={<button type="button" onClick={() => setEditing("new")} className={buttonClass}><Plus className="h-4 w-4" /> كود جديد</button>}
      />
      {query.isPending && <AdminSkeleton rows={5} />}
      {query.isError && <AdminError onRetry={() => query.refetch()} isRetrying={query.isFetching} />}
      {query.data && (
        <section className={cx(panelClass, "overflow-hidden")}>
          <div className="flex items-center justify-between border-b border-black/5 p-5">
            <div><h2 className="font-bold">الأكواد الحالية</h2><p className="mt-1 text-xs text-[#8b8178]">{formatNumber(query.data.filter((code) => code.isCurrentlyValid).length)} كود ساري من {formatNumber(query.data.length)}</p></div>
            <CirclePercent className="h-5 w-5 text-[#a77d4e]" />
          </div>
          <DataTable
            rows={query.data}
            rowKey={(item) => item.id}
            minWidth="min-w-[820px]"
            emptyState={<AdminEmpty title="لا توجد أكواد خصم" description="أنشئ أول كود لعروض المتجر." />}
            columns={[
              {
                key: "code",
                label: "الكود",
                render: (item) => (
                  <button type="button" onClick={() => copy(item.code)} className="inline-flex items-center gap-2 rounded-xl border border-dashed border-[#c9b494] bg-[#faf6ef] px-3 py-2 font-mono text-sm font-black text-[#765532] transition hover:border-[#9d7447]" aria-label={`نسخ الكود ${item.code}`}>
                    <span dir="ltr">{item.code}</span><Copy className="h-3.5 w-3.5" />
                  </button>
                ),
              },
              { key: "value", label: "الخصم", render: (item) => <strong>{formatNumber(item.percentageOff)}%</strong> },
              { key: "range", label: "الفترة", render: (item) => <span className="text-xs text-[#6f665d]"><span className="block">من {formatDateTime(item.startAt)}</span><span className="block">إلى {formatDateTime(item.endAt)}</span></span> },
              { key: "usage", label: "الاستخدام", render: (item) => `${formatNumber(item.usageCount)} مرة` },
              {
                key: "validity",
                label: "الصلاحية",
                render: (item) => {
                  const validity = validityOf(item);
                  return <span className="flex flex-wrap gap-1"><Badge tone={validity.tone}>{validity.label}</Badge>{!item.isActive && <Badge tone="slate">غير فعّال</Badge>}</span>;
                },
              },
              {
                key: "actions",
                label: "",
                className: "text-left",
                render: (item) => (
                  <div className="flex justify-end gap-1">
                    <button type="button" aria-label={`تعديل ${item.code}`} onClick={() => setEditing(item)} className={ghostIconClass}><Pencil className="h-4 w-4" /></button>
                    <button type="button" aria-label={`حذف ${item.code}`} onClick={() => setDeleting(item)} className={cx(ghostIconClass, "text-red-500 hover:bg-red-50 hover:text-red-600")}><Trash2 className="h-4 w-4" /></button>
                  </div>
                ),
              },
            ]}
          />
        </section>
      )}

      <AdminModal open={editing !== null} onClose={closeForm} title={editing === "new" || !editing ? "كود خصم جديد" : `تعديل ${editing.code}`} size="md">
        {editing !== null && <DiscountForm key={editing === "new" ? "new" : editing.id} code={editing === "new" ? null : editing} onClose={closeForm} />}
      </AdminModal>
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        isPending={remove.isPending}
        title="حذف كود الخصم"
        description={deleting ? `سيتم حذف «${deleting.code}» نهائيًا ولن يعمل للعملاء.` : undefined}
        confirmLabel="حذف"
        onConfirm={() => deleting && remove.mutate(deleting.id, {
          onSuccess: () => { toast.success("تم حذف الكود"); setDeleting(null); },
          onError: (error) => toast.error(friendlyError(error, "تعذّر حذف الكود.")),
        })}
      />
    </>
  );
}
