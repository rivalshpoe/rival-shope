"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { useAdminBrands, useCreateAdminBrand, useDeleteAdminBrand, useUpdateAdminBrand } from "@/lib/hooks/queries/admin/useAdminBrands";
import type { AdminBrand, AdminBrandInput } from "@/types/admin.types";
import { AdminEmpty, AdminError, AdminModal, AdminSkeleton, ConfirmDialog, useToast } from "./AdminFeedback";
import { AdminImage, buttonClass, Field, ghostIconClass, inputClass, PageTitle, panelClass, PendingButton, secondaryButtonClass } from "./AdminUI";
import { SingleImageUpload } from "./ImageUpload";
import { cx, fieldErrorsOf, formatNumber, friendlyError } from "./admin-utils";

const schema = z.object({
  name: z.string().trim().min(2, "أدخل اسمًا من حرفين على الأقل").max(60, "الاسم طويل جدًا"),
  slug: z.string().trim().max(80, "المعرّف طويل جدًا").optional(),
  imageUrl: z.string().min(1, "أضف شعار الماركة"),
});
type FormValues = z.infer<typeof schema>;

function BrandForm({ brand, onClose }: { brand: AdminBrand | null; onClose: () => void }) {
  const toast = useToast();
  const create = useCreateAdminBrand();
  const update = useUpdateAdminBrand();
  const mutation = brand ? update : create;
  const [serverError, setServerError] = useState("");
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: brand?.name ?? "", slug: brand?.slug ?? "", imageUrl: brand?.imageUrl ?? "" },
  });
  const errors = form.formState.errors;

  const submit = form.handleSubmit((values) => {
    setServerError("");
    const input: AdminBrandInput = { name: values.name, slug: values.slug?.trim() || undefined, imageUrl: values.imageUrl };
    const options = {
      onSuccess: () => {
        toast.success(brand ? "تم حفظ تعديلات الماركة" : "تمت إضافة الماركة");
        onClose();
      },
      onError: (error: unknown) => {
        Object.entries(fieldErrorsOf(error)).forEach(([field, message]) => form.setError(field as keyof FormValues, { message }));
        setServerError(friendlyError(error, "تعذّر حفظ الماركة. حاول مجددًا."));
      },
    };
    if (brand) update.mutate({ id: brand.id, input }, options);
    else create.mutate(input, options);
  });

  return (
    <form onSubmit={submit} noValidate className="grid gap-5 sm:grid-cols-[12rem_1fr]">
      <Field label="الشعار" required error={errors.imageUrl?.message}>
        <Controller control={form.control} name="imageUrl" render={({ field }) => <SingleImageUpload value={field.value || null} onChange={(url) => field.onChange(url ?? "")} label="شعار الماركة" aspect="aspect-square" />} />
      </Field>
      <div className="space-y-4">
        <Field label="اسم الماركة" required error={errors.name?.message}>
          <input {...form.register("name")} className={inputClass} placeholder="مثال: غوتشي" autoFocus />
        </Field>
        <Field label="المعرّف (slug)" hint="يُنشأ تلقائيًا إذا تُرك فارغًا" error={errors.slug?.message}>
          <input {...form.register("slug")} dir="ltr" className={cx(inputClass, "text-left")} placeholder="gucci" />
        </Field>
      </div>
      {serverError && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700 sm:col-span-2">{serverError}</p>}
      <div className="flex flex-col-reverse gap-2 sm:col-span-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} disabled={mutation.isPending} className={secondaryButtonClass}>إلغاء</button>
        <PendingButton type="submit" isPending={mutation.isPending}>{brand ? "حفظ التعديلات" : "إضافة الماركة"}</PendingButton>
      </div>
    </form>
  );
}

export function BrandsPage() {
  const toast = useToast();
  const query = useAdminBrands();
  const remove = useDeleteAdminBrand();
  const [editing, setEditing] = useState<AdminBrand | null | "new">(null);
  const [deleting, setDeleting] = useState<AdminBrand | null>(null);
  const closeForm = useCallback(() => setEditing(null), []);
  const closeDelete = useCallback(() => setDeleting(null), []);

  return (
    <>
      <PageTitle
        eyebrow="إدارة الكتالوج"
        title="الماركات"
        description="أدر الماركات المعروضة في المتجر وشعاراتها."
        action={<button type="button" onClick={() => setEditing("new")} className={buttonClass}><Plus className="h-4 w-4" /> ماركة جديدة</button>}
      />
      {query.isPending && <AdminSkeleton variant="cards" rows={6} />}
      {query.isError && <AdminError onRetry={() => query.refetch()} isRetrying={query.isFetching} />}
      {query.data && !query.data.length && (
        <div className={panelClass}><AdminEmpty title="لا توجد ماركات بعد" icon={<Tags className="h-6 w-6" />} action={<button type="button" onClick={() => setEditing("new")} className={buttonClass}><Plus className="h-4 w-4" /> ماركة جديدة</button>} /></div>
      )}
      {query.data && query.data.length > 0 && (
        <>
          <p className="mb-3 text-xs text-[#8b8178]">{formatNumber(query.data.length)} ماركة</p>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {query.data.map((brand) => (
              <li key={brand.id} className={cx(panelClass, "group flex items-center gap-4 p-4")}>
                <AdminImage src={brand.imageUrl} alt={brand.name} size={128} className="h-16 w-16 shrink-0 rounded-2xl" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{brand.name}</p>
                  <p dir="ltr" className="mt-0.5 truncate text-right text-xs text-[#91877d]">/{brand.slug}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <button type="button" aria-label={`تعديل ${brand.name}`} onClick={() => setEditing(brand)} className={ghostIconClass}><Pencil className="h-4 w-4" /></button>
                  <button type="button" aria-label={`حذف ${brand.name}`} onClick={() => setDeleting(brand)} className={cx(ghostIconClass, "text-red-500 hover:bg-red-50 hover:text-red-600")}><Trash2 className="h-4 w-4" /></button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <AdminModal open={editing !== null} onClose={closeForm} title={editing === "new" || !editing ? "ماركة جديدة" : `تعديل ${editing.name}`} size="md">
        {editing !== null && <BrandForm key={editing === "new" ? "new" : editing.id} brand={editing === "new" ? null : editing} onClose={closeForm} />}
      </AdminModal>

      <ConfirmDialog
        open={deleting !== null}
        onClose={closeDelete}
        isPending={remove.isPending}
        title="حذف الماركة"
        description={deleting ? `سيتم حذف «${deleting.name}». المنتجات المرتبطة ستبقى بدون ماركة.` : undefined}
        confirmLabel="حذف"
        onConfirm={() => deleting && remove.mutate(deleting.id, {
          onSuccess: () => { toast.success("تم حذف الماركة"); setDeleting(null); },
          onError: (error) => toast.error(friendlyError(error, "تعذّر حذف الماركة.")),
        })}
      />
    </>
  );
}
