"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { MapPin, Pencil, Plus, Trash2, Truck } from "lucide-react";
import { useCallback, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import {
  useAdminDeliveryZones,
  useCreateAdminDeliveryZone,
  useDeleteAdminDeliveryZone,
  useUpdateAdminDeliveryZone,
} from "@/lib/hooks/queries/admin/useAdminDeliveryZones";
import type { AdminDeliveryZone, AdminDeliveryZoneInput } from "@/types/admin.types";
import { AdminEmpty, AdminError, AdminModal, AdminSkeleton, ConfirmDialog, useToast } from "./AdminFeedback";
import { Badge, buttonClass, Field, ghostIconClass, inputClass, PageTitle, panelClass, PendingButton, secondaryButtonClass, Toggle } from "./AdminUI";
import { cx, fieldErrorsOf, formatMoney, formatNumber, friendlyError } from "./admin-utils";

const schema = z.object({
  name: z.string().trim().min(2, "أدخل اسمًا من حرفين على الأقل").max(60, "الاسم طويل جدًا"),
  extraFee: z.number({ error: "أدخل رقمًا صالحًا" }).min(0, "الرسوم لا تقل عن صفر").nullable(),
  isActive: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

function ZoneForm({ zone, onClose }: { zone: AdminDeliveryZone | null; onClose: () => void }) {
  const toast = useToast();
  const create = useCreateAdminDeliveryZone();
  const update = useUpdateAdminDeliveryZone();
  const mutation = zone ? update : create;
  const [serverError, setServerError] = useState("");
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: zone?.name ?? "", extraFee: zone?.extraFee ?? 20, isActive: zone?.isActive ?? true },
  });
  const errors = form.formState.errors;

  const submit = form.handleSubmit((values) => {
    setServerError("");
    const input: AdminDeliveryZoneInput = { name: values.name, extraFee: values.extraFee, isActive: values.isActive };
    const options = {
      onSuccess: () => {
        toast.success(zone ? "تم حفظ منطقة التوصيل" : "تمت إضافة منطقة التوصيل");
        onClose();
      },
      onError: (error: unknown) => {
        Object.entries(fieldErrorsOf(error)).forEach(([field, message]) => form.setError(field as keyof FormValues, { message }));
        setServerError(friendlyError(error, "تعذّر حفظ المنطقة. حاول مجددًا."));
      },
    };
    if (zone) update.mutate({ id: zone.id, input }, options);
    else create.mutate(input, options);
  });

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Field label="اسم المنطقة" required error={errors.name?.message}>
        <input {...form.register("name")} className={inputClass} placeholder="مثال: طولكرم" autoFocus />
      </Field>
      <Field label="رسوم التوصيل (₪)" hint="اتركه فارغًا إذا كانت الرسوم تُحدد لاحقًا" error={errors.extraFee?.message}>
        <input {...form.register("extraFee", { setValueAs: (value: string) => (value === "" ? null : Number(value)) })} type="number" min={0} step="0.5" className={inputClass} placeholder="بدون رسوم محددة" />
      </Field>
      <Controller control={form.control} name="isActive" render={({ field }) => <Toggle checked={field.value} onChange={field.onChange} label="متاحة للعملاء" description="المناطق المتوقفة لا تظهر أثناء إتمام الطلب" />} />
      {serverError && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700">{serverError}</p>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} disabled={mutation.isPending} className={secondaryButtonClass}>إلغاء</button>
        <PendingButton type="submit" isPending={mutation.isPending}>{zone ? "حفظ التعديلات" : "إضافة المنطقة"}</PendingButton>
      </div>
    </form>
  );
}

export function DeliveryZonesPage() {
  const toast = useToast();
  const query = useAdminDeliveryZones();
  const remove = useDeleteAdminDeliveryZone();
  const [editing, setEditing] = useState<AdminDeliveryZone | null | "new">(null);
  const [deleting, setDeleting] = useState<AdminDeliveryZone | null>(null);
  const closeForm = useCallback(() => setEditing(null), []);

  return (
    <>
      <PageTitle
        eyebrow="إعدادات الشحن"
        title="مناطق التوصيل"
        description="حدد المناطق المتاحة ورسوم التوصيل لكل منطقة."
        action={<button type="button" onClick={() => setEditing("new")} className={buttonClass}><Plus className="h-4 w-4" /> إضافة منطقة</button>}
      />
      {query.isPending && <AdminSkeleton rows={5} />}
      {query.isError && <AdminError onRetry={() => query.refetch()} isRetrying={query.isFetching} />}
      {query.data && (
        <section className={cx(panelClass, "overflow-hidden")}>
          <div className="flex items-center justify-between border-b border-black/5 p-5">
            <div><h2 className="font-bold">المناطق المسجلة</h2><p className="mt-1 text-xs text-[#8b8178]">{formatNumber(query.data.length)} منطقة • {formatNumber(query.data.filter((zone) => zone.isActive).length)} متاحة</p></div>
            <Truck className="h-5 w-5 text-[#a77d4e]" />
          </div>
          {!query.data.length && <AdminEmpty title="لا توجد مناطق توصيل" description="أضف أول منطقة ليتمكن العملاء من اختيار التوصيل." />}
          <ul className="divide-y divide-black/5">
            {query.data.map((zone) => (
              <li key={zone.id} className="flex flex-wrap items-center gap-4 p-5 sm:flex-nowrap">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#f5eee5] text-[#9b7143]"><MapPin className="h-5 w-5" /></span>
                <div className="min-w-0"><strong className="text-sm">{zone.name}</strong></div>
                <strong className="mr-auto text-sm">{zone.extraFee === null ? <span className="text-xs font-normal text-[#8b8178]">رسوم غير محددة</span> : zone.extraFee === 0 ? "مجانًا" : formatMoney(zone.extraFee)}</strong>
                <Badge tone={zone.isActive ? "green" : "slate"}>{zone.isActive ? "متاحة" : "متوقفة"}</Badge>
                <div className="flex gap-1">
                  <button type="button" aria-label={`تعديل ${zone.name}`} onClick={() => setEditing(zone)} className={ghostIconClass}><Pencil className="h-4 w-4" /></button>
                  <button type="button" aria-label={`حذف ${zone.name}`} onClick={() => setDeleting(zone)} className={cx(ghostIconClass, "text-red-500 hover:bg-red-50 hover:text-red-600")}><Trash2 className="h-4 w-4" /></button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <AdminModal open={editing !== null} onClose={closeForm} title={editing === "new" || !editing ? "منطقة توصيل جديدة" : `تعديل ${editing.name}`} size="sm">
        {editing !== null && <ZoneForm key={editing === "new" ? "new" : editing.id} zone={editing === "new" ? null : editing} onClose={closeForm} />}
      </AdminModal>
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        isPending={remove.isPending}
        title="حذف منطقة التوصيل"
        description={deleting ? `سيتم حذف «${deleting.name}» ولن تظهر للعملاء.` : undefined}
        confirmLabel="حذف"
        onConfirm={() => deleting && remove.mutate(deleting.id, {
          onSuccess: () => { toast.success("تم حذف المنطقة"); setDeleting(null); },
          onError: (error) => toast.error(friendlyError(error, "تعذّر حذف المنطقة.")),
        })}
      />
    </>
  );
}
