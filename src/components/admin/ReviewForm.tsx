"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronLeft, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { useAdminProducts } from "@/lib/hooks/queries/admin/useAdminProducts";
import { useAdminReview, useCreateAdminReview, useUpdateAdminReview } from "@/lib/hooks/queries/admin/useAdminReviews";
import type { AdminReview, AdminReviewInput } from "@/types/admin.types";
import { AdminError, AdminSkeleton, useToast } from "./AdminFeedback";
import { Field, inputClass, PageTitle, panelClass, PendingButton, secondaryButtonClass, Stars, Toggle } from "./AdminUI";
import { SingleImageUpload } from "./ImageUpload";
import { adminRoutes, cx, fieldErrorsOf, friendlyError } from "./admin-utils";

const schema = z.object({
  customerName: z.string().trim().min(2, "أدخل اسم العميلة").max(60, "الاسم طويل جدًا"),
  rating: z.number().int().min(1, "اختر تقييمًا من 1 إلى 5").max(5, "اختر تقييمًا من 1 إلى 5"),
  comment: z.string().trim().min(5, "التعليق قصير جدًا").max(600, "التعليق طويل جدًا"),
  imageUrl: z.string(),
  productId: z.string(),
  isApproved: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

function ReviewFormInner({ review }: { review: AdminReview | null }) {
  const router = useRouter();
  const toast = useToast();
  const products = useAdminProducts({ page: 1, pageSize: 200, isActive: true });
  const create = useCreateAdminReview();
  const update = useUpdateAdminReview();
  const mutation = review ? update : create;
  const [serverError, setServerError] = useState("");
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      customerName: review?.customerName ?? "",
      rating: review?.rating ?? 5,
      comment: review?.comment ?? "",
      imageUrl: review?.imageUrl ?? "",
      productId: review?.productId ?? "",
      isApproved: review?.isApproved ?? true,
    },
  });
  const errors = form.formState.errors;

  const submit = form.handleSubmit((values) => {
    setServerError("");
    const input: AdminReviewInput = {
      customerName: values.customerName,
      rating: values.rating,
      comment: values.comment,
      imageUrl: values.imageUrl || null,
      productId: values.productId || null,
      isApproved: values.isApproved,
    };
    const options = {
      onSuccess: () => {
        toast.success(review ? "تم حفظ التقييم" : "تمت إضافة التقييم");
        router.push(adminRoutes.reviews);
      },
      onError: (error: unknown) => {
        Object.entries(fieldErrorsOf(error)).forEach(([field, message]) => form.setError(field as keyof FormValues, { message }));
        setServerError(friendlyError(error, "تعذّر حفظ التقييم. حاول مجددًا."));
      },
    };
    if (review) update.mutate({ id: review.id, input }, options);
    else create.mutate(input, options);
  });

  return (
    <form onSubmit={submit} noValidate className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
      <section className={cx(panelClass, "p-5 sm:p-7")}>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="اسم العميلة" required error={errors.customerName?.message}>
            <input {...form.register("customerName")} className={inputClass} placeholder="مثال: سارة م." autoFocus />
          </Field>
          <Field label="المنتج" hint="اختياري — تقييم عام إذا تُرك فارغًا" error={errors.productId?.message}>
            <select {...form.register("productId")} className={inputClass} disabled={products.isPending}>
              <option value="">— تقييم عام للمتجر —</option>
              {products.data?.items.map((product) => <option key={product.id} value={product.id}>{product.title}</option>)}
            </select>
          </Field>
          <Field label="التقييم" required error={errors.rating?.message} className="sm:col-span-2">
            <Controller control={form.control} name="rating" render={({ field }) => <Stars value={field.value} onChange={field.onChange} size="lg" />} />
          </Field>
          <Field label="التعليق" required error={errors.comment?.message} className="sm:col-span-2">
            <textarea {...form.register("comment")} rows={6} className={cx(inputClass, "resize-y leading-7")} placeholder="ما الذي أعجب العميلة في المنتج أو الخدمة؟" />
          </Field>
        </div>
      </section>
      <div className="space-y-5">
        <section className={cx(panelClass, "p-5 sm:p-6")}>
          <h2 className="mb-4 font-bold">صورة مرفقة</h2>
          <Controller control={form.control} name="imageUrl" render={({ field }) => <SingleImageUpload value={field.value || null} onChange={(url) => field.onChange(url ?? "")} label="صورة العميلة أو المنتج (اختياري)" aspect="aspect-[4/3]" />} />
        </section>
        <section className={cx(panelClass, "p-5 sm:p-6")}>
          <Controller control={form.control} name="isApproved" render={({ field }) => <Toggle checked={field.value} onChange={field.onChange} label="منشور في المتجر" description="التقييمات غير المنشورة تبقى مخفية عن العملاء" />} />
          {serverError && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700">{serverError}</p>}
          <PendingButton type="submit" isPending={mutation.isPending} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#141210] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#2b251f] disabled:cursor-not-allowed disabled:opacity-50">
            <Save className="h-4 w-4" /> {review ? "حفظ التعديلات" : "إضافة التقييم"}
          </PendingButton>
          <Link href={adminRoutes.reviews} className={cx(secondaryButtonClass, "mt-2 w-full")}>إلغاء</Link>
        </section>
      </div>
    </form>
  );
}

export function ReviewFormPage({ reviewId }: { reviewId?: string }) {
  const isEdit = Boolean(reviewId);
  const review = useAdminReview(reviewId);

  return (
    <>
      <PageTitle
        eyebrow="المحتوى"
        title={isEdit ? "تعديل التقييم" : "تقييم جديد"}
        description="أضف تقييمًا موثّقًا من عميلة مع صورة اختيارية، وحدد إن كان يُنشر في المتجر."
        action={<Link href={adminRoutes.reviews} className={secondaryButtonClass}>التقييمات <ChevronLeft className="h-4 w-4" /></Link>}
      />
      {isEdit && review.isPending && <AdminSkeleton variant="form" rows={5} />}
      {isEdit && review.isError && <AdminError message={friendlyError(review.error, "تعذّر تحميل التقييم.")} onRetry={() => review.refetch()} isRetrying={review.isFetching} />}
      {isEdit && review.data === null && <AdminError title="التقييم غير موجود" message="ربما تم حذفه." onRetry={() => review.refetch()} isRetrying={review.isFetching} />}
      {(!isEdit || review.data) && <ReviewFormInner key={review.data?.id ?? "new"} review={review.data ?? null} />}
    </>
  );
}
