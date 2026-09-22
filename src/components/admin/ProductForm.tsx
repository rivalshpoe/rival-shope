"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Palette, Plus, Ruler, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Controller, useFieldArray, useForm, useWatch, type DefaultValues } from "react-hook-form";
import { z } from "zod";
import { useAdminBrands } from "@/lib/hooks/queries/admin/useAdminBrands";
import { useAdminCategories } from "@/lib/hooks/queries/admin/useAdminCategories";
import { useAdminProduct, useCreateAdminProduct, useUpdateAdminProduct } from "@/lib/hooks/queries/admin/useAdminProducts";
import type { AdminCategory, AdminProductDetails, AdminProductInput } from "@/types/admin.types";
import { AdminError, AdminSkeleton, useToast } from "./AdminFeedback";
import { Field, ghostIconClass, inputClass, PageTitle, panelClass, PendingButton, secondaryButtonClass, Toggle } from "./AdminUI";
import { MultiImageUpload } from "./ImageUpload";
import { adminRoutes, cx, fieldErrorsOf, friendlyError, fromDatetimeLocal, toDatetimeLocal } from "./admin-utils";

// ---------------------------------------------------------------------------
const numberField = (message: string) => z.number({ error: message });
const optionalNumber = z.number({ error: "أدخل رقمًا صالحًا" }).nullable();

const schema = z
  .object({
    title: z.string().trim().min(3, "اسم المنتج يجب أن يتكون من 3 أحرف على الأقل").max(120, "الاسم طويل جدًا"),
    description: z.string().trim().max(3000, "الوصف طويل جدًا"),
    mainCategoryId: z.string().min(1, "اختر القسم الرئيسي"),
    subCategoryId: z.string(),
    brandId: z.string(),
    price: numberField("أدخل السعر").positive("أدخل سعرًا أكبر من صفر"),
    discountPrice: optionalNumber,
    discountStartAt: z.string(),
    discountEndAt: z.string(),
    hasSizes: z.boolean(),
    stock: optionalNumber,
    sizes: z.array(
      z.object({
        id: z.string().optional(),
        label: z.string().trim().min(1, "أدخل المقاس").max(12, "المقاس طويل"),
        price: numberField("أدخل السعر").min(0, "السعر لا يقل عن صفر"),
        stock: numberField("أدخل الكمية").int("أدخل عددًا صحيحًا").min(0, "الكمية لا تقل عن صفر"),
      }),
    ),
    colors: z.array(
      z.object({
        id: z.string().optional(),
        name: z.string().trim().min(1, "أدخل اسم اللون").max(30, "الاسم طويل"),
        hex: z.string().regex(/^#[0-9a-fA-F]{6}$/, "لون غير صالح"),
      }),
    ),
    imageUrls: z.array(z.string()).min(1, "أضف صورة واحدة على الأقل"),
    isActive: z.boolean(),
  })
  .superRefine((values, context) => {
    if (values.discountPrice !== null && values.discountPrice >= values.price) {
      context.addIssue({ code: "custom", path: ["discountPrice"], message: "سعر الخصم يجب أن يكون أقل من السعر الأصلي" });
    }
    if (values.discountPrice !== null && values.discountPrice < 0) {
      context.addIssue({ code: "custom", path: ["discountPrice"], message: "أدخل قيمة صحيحة" });
    }
    if (values.discountStartAt && values.discountEndAt && values.discountStartAt > values.discountEndAt) {
      context.addIssue({ code: "custom", path: ["discountEndAt"], message: "نهاية الخصم يجب أن تكون بعد بدايته" });
    }
    if (values.hasSizes) {
      if (!values.sizes.length) context.addIssue({ code: "custom", path: ["sizes"], message: "أضف مقاسًا واحدًا على الأقل" });
      const labels = values.sizes.map((size) => size.label.toUpperCase());
      if (new Set(labels).size !== labels.length) context.addIssue({ code: "custom", path: ["sizes"], message: "المقاسات مكررة" });
    } else if (values.stock === null || !Number.isInteger(values.stock) || values.stock < 0) {
      context.addIssue({ code: "custom", path: ["stock"], message: "أدخل كمية صحيحة (0 أو أكثر)" });
    }
  });

type FormValues = z.infer<typeof schema>;

const SIZE_PRESETS = ["S", "M", "L", "XL", "XXL", "3XL"];
const COLOR_GROUPS: Array<{ label: string; colors: Array<{ name: string; hex: string }> }> = [
  { label: "أساسية", colors: [{ name: "أسود", hex: "#111111" }, { name: "أبيض", hex: "#F5F5F5" }, { name: "بيج", hex: "#D8C3A5" }, { name: "بني", hex: "#6B4A2B" }] },
  { label: "بشرة", colors: [{ name: "نيود", hex: "#E8C4A8" }, { name: "كراميل", hex: "#C68E5B" }, { name: "موكا", hex: "#8B5A3C" }] },
  { label: "فاخرة", colors: [{ name: "ذهبي", hex: "#C7A478" }, { name: "بورغندي", hex: "#6E1E2B" }, { name: "أخضر زيتي", hex: "#4B5A3A" }, { name: "أزرق ملكي", hex: "#1F3A78" }] },
];

function isShapewear(category: AdminCategory | undefined): boolean {
  if (!category) return false;
  return /shape/i.test(category.slug) || category.name.includes("مشد");
}

function toDefaults(product: AdminProductDetails | undefined, categories: AdminCategory[]): DefaultValues<FormValues> {
  const category = categories.find((candidate) => candidate.id === product?.categoryId);
  const main = category?.parentId ? categories.find((candidate) => candidate.id === category.parentId) : category;
  return {
    title: product?.title ?? "",
    description: product?.description ?? "",
    mainCategoryId: main?.id ?? "",
    subCategoryId: category?.parentId ? category.id : "",
    brandId: product?.brandId ?? "",
    price: product?.price,
    discountPrice: product?.discountPrice ?? null,
    discountStartAt: toDatetimeLocal(product?.discountStartAt),
    discountEndAt: toDatetimeLocal(product?.discountEndAt),
    hasSizes: product?.hasSizes ?? false,
    stock: product ? (product.hasSizes ? null : product.stock) : 0,
    sizes: product?.sizes.map((size) => ({ id: size.id, label: size.label, price: size.price, stock: size.stock })) ?? [],
    colors: product?.colors.map((color) => ({ id: color.id, name: color.name, hex: color.hex })) ?? [],
    imageUrls: product?.images.map((image) => image.url) ?? [],
    isActive: product?.isActive ?? true,
  };
}

const numberValue = (value: string) => (value === "" ? null : Number(value));
const requiredNumber = (value: string) => (value === "" ? Number.NaN : Number(value));

// ---------------------------------------------------------------------------
function ProductFormInner({ product, categories }: { product?: AdminProductDetails; categories: AdminCategory[] }) {
  const router = useRouter();
  const toast = useToast();
  const brands = useAdminBrands();
  const create = useCreateAdminProduct();
  const update = useUpdateAdminProduct();
  const mutation = product ? update : create;
  const [serverError, setServerError] = useState("");

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: useMemo(() => toDefaults(product, categories), [product, categories]),
  });
  const { register, control, formState: { errors }, setValue, setError } = form;
  const sizes = useFieldArray({ control, name: "sizes" });
  const colors = useFieldArray({ control, name: "colors" });

  const mainCategoryId = useWatch({ control, name: "mainCategoryId" });
  const subCategoryId = useWatch({ control, name: "subCategoryId" });
  const hasSizes = useWatch({ control, name: "hasSizes" });
  const price = useWatch({ control, name: "price" });

  const mains = useMemo(() => categories.filter((category) => !category.parentId), [categories]);
  const subs = useMemo(() => categories.filter((category) => category.parentId === mainCategoryId), [categories, mainCategoryId]);
  const selectedMain = categories.find((category) => category.id === mainCategoryId);
  const selectedSub = categories.find((category) => category.id === subCategoryId);
  const shapewear = isShapewear(selectedMain) || isShapewear(selectedSub);

  useEffect(() => {
    if (subCategoryId && !subs.some((sub) => sub.id === subCategoryId)) setValue("subCategoryId", "");
  }, [subs, subCategoryId, setValue]);

  useEffect(() => {
    if (shapewear && !form.getValues("hasSizes")) setValue("hasSizes", true);
  }, [shapewear, setValue, form]);

  const addSizePreset = (label: string) => {
    if (sizes.fields.some((field) => field.label.toUpperCase() === label)) return;
    sizes.append({ label, price: Number.isFinite(price) ? price : 0, stock: 0 });
  };

  const submit = form.handleSubmit((values) => {
    setServerError("");
    const input: AdminProductInput = {
      title: values.title,
      description: values.description,
      categoryId: values.subCategoryId || values.mainCategoryId,
      brandId: values.brandId || null,
      price: values.price,
      discountPrice: values.discountPrice,
      discountStartAt: values.discountPrice !== null ? fromDatetimeLocal(values.discountStartAt) : null,
      discountEndAt: values.discountPrice !== null ? fromDatetimeLocal(values.discountEndAt) : null,
      hasSizes: values.hasSizes,
      stock: values.hasSizes ? 0 : values.stock ?? 0,
      sizes: values.hasSizes ? values.sizes.map((size) => ({ id: size.id, label: size.label.toUpperCase(), price: size.price, stock: size.stock })) : [],
      colors: values.colors.map((color) => ({ id: color.id, name: color.name, hex: color.hex.toUpperCase() })),
      imageUrls: values.imageUrls,
      isActive: values.isActive,
    };
    const options = {
      onSuccess: () => {
        toast.success(product ? "تم حفظ تعديلات المنتج" : "تمت إضافة المنتج إلى الكتالوج");
        router.push(adminRoutes.products);
      },
      onError: (error: unknown) => {
        const fieldErrors = fieldErrorsOf(error);
        Object.entries(fieldErrors).forEach(([field, message]) => {
          const key = field === "categoryId" ? "mainCategoryId" : field;
          setError(key as keyof FormValues, { message });
        });
        setServerError(friendlyError(error, "تعذّر حفظ المنتج. تحقق من البيانات وحاول مجددًا."));
      },
    };
    if (product) update.mutate({ id: product.id, input }, options);
    else create.mutate(input, options);
  });

  return (
    <form onSubmit={submit} noValidate className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
      <div className="space-y-5">
        <section className={cx(panelClass, "p-5 sm:p-7")}>
          <h2 className="mb-6 font-bold">المعلومات الأساسية</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="اسم المنتج" required error={errors.title?.message} className="sm:col-span-2">
              <input {...register("title")} className={inputClass} placeholder="اسم واضح ومميز للمنتج" />
            </Field>
            <Field label="القسم الرئيسي" required error={errors.mainCategoryId?.message}>
              <select {...register("mainCategoryId")} className={inputClass}>
                <option value="">اختر القسم</option>
                {mains.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </Field>
            <Field label="القسم الفرعي" hint={subs.length ? "اختياري" : "لا توجد أقسام فرعية لهذا القسم"} error={errors.subCategoryId?.message}>
              <select {...register("subCategoryId")} className={inputClass} disabled={!subs.length}>
                <option value="">— بدون قسم فرعي —</option>
                {subs.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </Field>
            <Field label="الماركة" error={errors.brandId?.message}>
              <select {...register("brandId")} className={inputClass} disabled={brands.isPending}>
                <option value="">— بدون ماركة —</option>
                {brands.data?.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
              </select>
            </Field>
            <Field label="الوصف" error={errors.description?.message} className="sm:col-span-2">
              <textarea {...register("description")} rows={5} className={cx(inputClass, "resize-y")} placeholder="صف الخامة، الاستخدام، والتفاصيل المميزة..." />
            </Field>
          </div>
        </section>

        <section className={cx(panelClass, "p-5 sm:p-7")}>
          <h2 className="mb-6 font-bold">السعر والخصم</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="السعر (₪)" required error={errors.price?.message}>
              <input {...register("price", { setValueAs: requiredNumber })} type="number" min={0} step="0.5" inputMode="decimal" className={inputClass} placeholder="0" />
            </Field>
            <Field label="سعر الخصم (₪)" hint="اختياري — يجب أن يكون أقل من السعر" error={errors.discountPrice?.message}>
              <input {...register("discountPrice", { setValueAs: numberValue })} type="number" min={0} step="0.5" inputMode="decimal" className={inputClass} placeholder="بدون خصم" />
            </Field>
            <Field label="بداية الخصم" error={errors.discountStartAt?.message}>
              <input {...register("discountStartAt")} type="datetime-local" dir="ltr" className={cx(inputClass, "text-left")} />
            </Field>
            <Field label="نهاية الخصم" error={errors.discountEndAt?.message}>
              <input {...register("discountEndAt")} type="datetime-local" dir="ltr" className={cx(inputClass, "text-left")} />
            </Field>
          </div>
        </section>

        <section className={cx(panelClass, "p-5 sm:p-7")}>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-bold"><Ruler className="h-4 w-4 text-[#9b7246]" /> المقاسات والمخزون</h2>
            {shapewear && <span className="rounded-full bg-[#f3ebdf] px-3 py-1 text-xs font-bold text-[#8a5f33]">قسم المشدات — المقاسات مفعّلة</span>}
          </div>
          <Controller control={control} name="hasSizes" render={({ field }) => <Toggle checked={field.value} onChange={field.onChange} label="له مقاسات" description="لكل مقاس سعر ومخزون مستقل" />} />

          {hasSizes ? (
            <div className="mt-5">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="text-xs text-[#8b8178]">إضافة سريعة:</span>
                {SIZE_PRESETS.map((label) => (
                  <button key={label} type="button" onClick={() => addSizePreset(label)} className="rounded-lg border border-black/10 px-2.5 py-1 text-xs font-bold hover:border-[#c7a478] hover:bg-[#faf7f1]">{label}</button>
                ))}
                <button type="button" onClick={() => sizes.append({ label: "", price: Number.isFinite(price) ? price : 0, stock: 0 })} className="inline-flex items-center gap-1 rounded-lg bg-[#17130f] px-2.5 py-1 text-xs font-bold text-white"><Plus className="h-3 w-3" /> مقاس مخصص</button>
              </div>
              {sizes.fields.length > 0 && (
                <div className="overflow-x-auto rounded-2xl border border-black/5">
                  <table className="w-full min-w-[520px] text-right text-sm">
                    <thead className="bg-[#faf7f1] text-xs text-[#756a5f]">
                      <tr>
                        <th scope="col" className="px-4 py-3 font-bold">المقاس</th>
                        <th scope="col" className="px-4 py-3 font-bold">السعر (₪)</th>
                        <th scope="col" className="px-4 py-3 font-bold">المخزون</th>
                        <th scope="col" className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5">
                      {sizes.fields.map((field, index) => (
                        <tr key={field.id}>
                          <td className="px-3 py-2">
                            <input {...register(`sizes.${index}.label` as const)} className={cx(inputClass, "py-2 uppercase")} placeholder="M" aria-label={`المقاس ${index + 1}`} />
                            {errors.sizes?.[index]?.label && <span role="alert" className="mt-1 block text-[11px] font-bold text-red-600">{errors.sizes[index]?.label?.message}</span>}
                          </td>
                          <td className="px-3 py-2">
                            <input {...register(`sizes.${index}.price` as const, { setValueAs: requiredNumber })} type="number" min={0} step="0.5" className={cx(inputClass, "py-2")} aria-label={`سعر المقاس ${index + 1}`} />
                            {errors.sizes?.[index]?.price && <span role="alert" className="mt-1 block text-[11px] font-bold text-red-600">{errors.sizes[index]?.price?.message}</span>}
                          </td>
                          <td className="px-3 py-2">
                            <input {...register(`sizes.${index}.stock` as const, { setValueAs: requiredNumber })} type="number" min={0} step={1} className={cx(inputClass, "py-2")} aria-label={`مخزون المقاس ${index + 1}`} />
                            {errors.sizes?.[index]?.stock && <span role="alert" className="mt-1 block text-[11px] font-bold text-red-600">{errors.sizes[index]?.stock?.message}</span>}
                          </td>
                          <td className="px-3 py-2 text-left">
                            <button type="button" onClick={() => sizes.remove(index)} aria-label={`إزالة المقاس ${index + 1}`} className={cx(ghostIconClass, "text-red-500 hover:bg-red-50")}><Trash2 className="h-4 w-4" /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {errors.sizes?.root?.message || (typeof errors.sizes?.message === "string" && errors.sizes.message) ? (
                <p role="alert" className="mt-2 text-xs font-bold text-red-600">{errors.sizes?.root?.message ?? errors.sizes?.message}</p>
              ) : null}
            </div>
          ) : (
            <div className="mt-5 max-w-xs">
              <Field label="الكمية المتاحة" required error={errors.stock?.message}>
                <input {...register("stock", { setValueAs: numberValue })} type="number" min={0} step={1} className={inputClass} />
              </Field>
            </div>
          )}
        </section>

        <section className={cx(panelClass, "p-5 sm:p-7")}>
          <h2 className="mb-2 flex items-center gap-2 font-bold"><Palette className="h-4 w-4 text-[#9b7246]" /> الألوان</h2>
          <p className="mb-4 text-xs text-[#8b8178]">اختياري — أضف الألوان المتاحة لهذا المنتج من المجموعات أو أضف لونًا مخصصًا.</p>
          <div className="space-y-3">
            {COLOR_GROUPS.map((group) => (
              <div key={group.label} className="flex flex-wrap items-center gap-2">
                <span className="w-14 text-xs font-bold text-[#8b8178]">{group.label}</span>
                {group.colors.map((color) => {
                  const added = colors.fields.some((field) => field.hex.toUpperCase() === color.hex.toUpperCase());
                  return (
                    <button
                      key={color.hex}
                      type="button"
                      disabled={added}
                      onClick={() => colors.append(color)}
                      aria-label={`إضافة لون ${color.name}`}
                      className={cx("inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-bold transition", added ? "border-transparent bg-[#f3ebdf] text-[#8a5f33]" : "border-black/10 hover:border-[#c7a478]")}
                    >
                      <span className="h-3.5 w-3.5 rounded-full border border-black/10" style={{ background: color.hex }} /> {color.name}
                    </button>
                  );
                })}
              </div>
            ))}
            <button type="button" onClick={() => colors.append({ name: "", hex: "#C7A478" })} className="inline-flex items-center gap-1 rounded-lg bg-[#17130f] px-3 py-1.5 text-xs font-bold text-white"><Plus className="h-3 w-3" /> لون مخصص</button>
          </div>
          {colors.fields.length > 0 && (
            <ul className="mt-5 space-y-2">
              {colors.fields.map((field, index) => (
                <li key={field.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-[#faf7f1] p-3">
                  <input {...register(`colors.${index}.hex` as const)} type="color" className="h-10 w-12 cursor-pointer rounded-lg border border-black/10 bg-white p-1" aria-label={`اختيار لون ${index + 1}`} />
                  <div className="min-w-0 flex-1">
                    <input {...register(`colors.${index}.name` as const)} className={cx(inputClass, "py-2")} placeholder="اسم اللون" aria-label={`اسم اللون ${index + 1}`} />
                    {errors.colors?.[index]?.name && <span role="alert" className="mt-1 block text-[11px] font-bold text-red-600">{errors.colors[index]?.name?.message}</span>}
                    {errors.colors?.[index]?.hex && <span role="alert" className="mt-1 block text-[11px] font-bold text-red-600">{errors.colors[index]?.hex?.message}</span>}
                  </div>
                  <input {...register(`colors.${index}.hex` as const)} dir="ltr" className={cx(inputClass, "w-28 py-2 text-left font-mono text-xs uppercase")} aria-label={`رمز اللون ${index + 1}`} />
                  <button type="button" onClick={() => colors.remove(index)} aria-label={`إزالة اللون ${index + 1}`} className={cx(ghostIconClass, "text-red-500 hover:bg-red-50")}><Trash2 className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="space-y-5 xl:sticky xl:top-24 xl:self-start">
        <section className={cx(panelClass, "p-5 sm:p-6")}>
          <h2 className="mb-5 font-bold">صور المنتج <span className="text-red-600" aria-hidden>*</span></h2>
          <Controller control={control} name="imageUrls" render={({ field }) => <MultiImageUpload value={field.value} onChange={field.onChange} error={errors.imageUrls?.message} />} />
        </section>
        <section className={cx(panelClass, "p-5 sm:p-6")}>
          <h2 className="mb-5 font-bold">النشر</h2>
          <Controller control={control} name="isActive" render={({ field }) => <Toggle checked={field.value} onChange={field.onChange} label="ظاهر في المتجر" description="المنتجات المخفية لا تظهر للعملاء" />} />
          {serverError && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700">{serverError}</p>}
          {Object.keys(errors).length > 0 && !serverError && <p role="alert" className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">يرجى مراجعة الحقول المميزة بالأحمر.</p>}
          <PendingButton type="submit" isPending={mutation.isPending} className={cx("mt-5 w-full", "inline-flex items-center justify-center gap-2 rounded-2xl bg-[#141210] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#2b251f] disabled:cursor-not-allowed disabled:opacity-50")}>
            <Save className="h-4 w-4" /> {product ? "حفظ التعديلات" : "نشر المنتج"}
          </PendingButton>
          <Link href={adminRoutes.products} className={cx(secondaryButtonClass, "mt-2 w-full")}>إلغاء</Link>
        </section>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
export function ProductFormPage({ productId }: { productId?: string }) {
  const categories = useAdminCategories();
  const product = useAdminProduct(productId);
  const isEdit = Boolean(productId);
  const loading = categories.isPending || (isEdit && product.isPending);
  const error = categories.isError || (isEdit && product.isError);

  return (
    <>
      <PageTitle
        eyebrow={isEdit ? "تعديل الكتالوج" : "منتج جديد"}
        title={isEdit ? (product.data ? `تعديل ${product.data.title}` : "تعديل المنتج") : "إضافة منتج"}
        description="أدخل معلومات المنتج كما ستظهر للعملاء في المتجر. الصورة الأولى هي الصورة الرئيسية."
        action={<Link href={adminRoutes.products} className={secondaryButtonClass}>العودة للمنتجات <ArrowLeft className="h-4 w-4" /></Link>}
      />
      {loading && <AdminSkeleton variant="form" rows={8} />}
      {!loading && error && (
        <AdminError
          message={isEdit && product.isError ? friendlyError(product.error, "تعذّر تحميل بيانات المنتج.") : "تعذّر تحميل الأقسام."}
          onRetry={() => { void categories.refetch(); if (isEdit) void product.refetch(); }}
          isRetrying={categories.isFetching || product.isFetching}
        />
      )}
      {!loading && !error && categories.data && (
        <ProductFormInner key={product.data?.id ?? "new"} product={product.data} categories={categories.data} />
      )}
    </>
  );
}
