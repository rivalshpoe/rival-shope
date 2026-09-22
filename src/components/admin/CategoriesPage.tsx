"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, CornerDownLeft, FolderTree, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import {
  useAdminCategories,
  useCreateAdminCategory,
  useDeleteAdminCategory,
  useUpdateAdminCategory,
} from "@/lib/hooks/queries/admin/useAdminCategories";
import type { AdminCategory, AdminCategoryInput } from "@/types/admin.types";
import { AdminEmpty, AdminError, AdminModal, AdminSkeleton, ConfirmDialog, useToast } from "./AdminFeedback";
import { AdminImage, Badge, buttonClass, Field, ghostIconClass, inputClass, PageTitle, panelClass, PendingButton, secondaryButtonClass, Toggle } from "./AdminUI";
import { SingleImageUpload } from "./ImageUpload";
import { cx, fieldErrorsOf, formatNumber, friendlyError } from "./admin-utils";

const schema = z.object({
  name: z.string().trim().min(2, "أدخل اسمًا من حرفين على الأقل").max(60, "الاسم طويل جدًا"),
  slug: z.string().trim().max(80, "المعرّف طويل جدًا").optional(),
  imageUrl: z.string().min(1, "أضف صورة للقسم"),
  parentId: z.string().nullable(),
  sortOrder: z.coerce.number().int("أدخل رقمًا صحيحًا").min(0, "الترتيب لا يقل عن 0"),
  isActive: z.boolean(),
});
type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

function CategoryForm({
  category,
  parents,
  onClose,
}: {
  category: AdminCategory | null;
  parents: AdminCategory[];
  onClose: () => void;
}) {
  const toast = useToast();
  const create = useCreateAdminCategory();
  const update = useUpdateAdminCategory();
  const mutation = category ? update : create;
  const [serverError, setServerError] = useState("");

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: category?.name ?? "",
      slug: category?.slug ?? "",
      imageUrl: category?.imageUrl ?? "",
      parentId: category?.parentId ?? null,
      sortOrder: category?.sortOrder ?? parents.length + 1,
      isActive: category?.isActive ?? true,
    },
  });
  const errors = form.formState.errors;

  const submit = form.handleSubmit((values) => {
    setServerError("");
    const input: AdminCategoryInput = {
      name: values.name,
      slug: values.slug?.trim() || undefined,
      imageUrl: values.imageUrl,
      parentId: values.parentId || null,
      sortOrder: values.sortOrder,
      isActive: values.isActive,
    };
    const options = {
      onSuccess: () => {
        toast.success(category ? "تم حفظ تعديلات القسم" : "تمت إضافة القسم بنجاح");
        onClose();
      },
      onError: (error: unknown) => {
        const fieldErrors = fieldErrorsOf(error);
        Object.entries(fieldErrors).forEach(([field, message]) => form.setError(field as keyof FormInput, { message }));
        setServerError(friendlyError(error, "تعذّر حفظ القسم. حاول مجددًا."));
      },
    };
    if (category) update.mutate({ id: category.id, input }, options);
    else create.mutate(input, options);
  });

  return (
    <form onSubmit={submit} noValidate className="grid gap-5 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Field label="صورة القسم" required error={errors.imageUrl?.message}>
          <Controller control={form.control} name="imageUrl" render={({ field }) => <SingleImageUpload value={field.value || null} onChange={(url) => field.onChange(url ?? "")} label="اختر صورة القسم" aspect="aspect-[16/7]" />} />
        </Field>
      </div>
      <Field label="اسم القسم" required error={errors.name?.message}>
        <input {...form.register("name")} className={inputClass} placeholder="مثال: عطور" autoFocus />
      </Field>
      <Field label="المعرّف (slug)" hint="يُنشأ تلقائيًا إذا تُرك فارغًا" error={errors.slug?.message}>
        <input {...form.register("slug")} dir="ltr" className={cx(inputClass, "text-left")} placeholder="perfumes" />
      </Field>
      <Field label="القسم الرئيسي" hint="اتركه فارغًا ليكون قسمًا رئيسيًا" error={errors.parentId?.message}>
        <select {...form.register("parentId", { setValueAs: (value: string) => value || null })} className={inputClass} defaultValue={category?.parentId ?? ""}>
          <option value="">— قسم رئيسي —</option>
          {parents.filter((parent) => parent.id !== category?.id).map((parent) => <option key={parent.id} value={parent.id}>{parent.name}</option>)}
        </select>
      </Field>
      <Field label="الترتيب" error={errors.sortOrder?.message}>
        <input {...form.register("sortOrder")} type="number" min={0} className={inputClass} />
      </Field>
      <div className="sm:col-span-2">
        <Controller control={form.control} name="isActive" render={({ field }) => <Toggle checked={field.value} onChange={field.onChange} label="ظاهر في المتجر" description="الأقسام المخفية لا تظهر للعملاء" />} />
      </div>
      {serverError && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700 sm:col-span-2">{serverError}</p>}
      <div className="flex flex-col-reverse gap-2 sm:col-span-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} disabled={mutation.isPending} className={secondaryButtonClass}>إلغاء</button>
        <PendingButton type="submit" isPending={mutation.isPending}>{category ? "حفظ التعديلات" : "إضافة القسم"}</PendingButton>
      </div>
    </form>
  );
}

function CategoryRow({
  category,
  isChild,
  onEdit,
  onDelete,
  childCount,
  expanded,
  onToggle,
}: {
  category: AdminCategory;
  isChild?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  childCount?: number;
  expanded?: boolean;
  onToggle?: () => void;
}) {
  return (
    <div className={cx("flex flex-wrap items-center gap-3 p-4 sm:flex-nowrap", isChild && "bg-[#fcfaf6] pr-8 sm:pr-14")}>
      {isChild && <CornerDownLeft className="hidden h-4 w-4 shrink-0 -scale-x-100 text-[#c9b494] sm:block" aria-hidden />}
      {!isChild && onToggle && (
        <button type="button" onClick={onToggle} aria-expanded={expanded} aria-label={expanded ? "طي الأقسام الفرعية" : "عرض الأقسام الفرعية"} disabled={!childCount} className={cx(ghostIconClass, "p-1")}>
          <ChevronDown className={cx("h-4 w-4 transition", expanded && "rotate-180", !childCount && "opacity-20")} />
        </button>
      )}
      <AdminImage src={category.imageUrl} alt={category.name} size={96} className={cx("shrink-0 rounded-2xl", isChild ? "h-10 w-10" : "h-12 w-12")} />
      <div className="min-w-0">
        <p className="text-sm font-bold">{category.name}</p>
        <p dir="ltr" className="mt-0.5 truncate text-right text-xs text-[#91877d]">/{category.slug}</p>
      </div>
      <div className="mr-auto flex items-center gap-2 text-xs text-[#796f66]">
        <span className="rounded-full bg-[#f3ebdf] px-2.5 py-1 font-bold text-[#8a5f33]">{formatNumber(category.productCount)} منتج</span>
        {!isChild && typeof childCount === "number" && childCount > 0 && <span className="hidden sm:inline">{formatNumber(childCount)} فرعي</span>}
        <Badge tone={category.isActive ? "green" : "slate"}>{category.isActive ? "ظاهر" : "مخفي"}</Badge>
      </div>
      <div className="flex gap-1">
        <button type="button" aria-label={`تعديل ${category.name}`} onClick={onEdit} className={ghostIconClass}><Pencil className="h-4 w-4" /></button>
        <button type="button" aria-label={`حذف ${category.name}`} onClick={onDelete} className={cx(ghostIconClass, "text-red-500 hover:bg-red-50 hover:text-red-600")}><Trash2 className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

export function CategoriesPage() {
  const toast = useToast();
  const query = useAdminCategories();
  const remove = useDeleteAdminCategory();
  const [editing, setEditing] = useState<AdminCategory | null | "new">(null);
  const [deleting, setDeleting] = useState<AdminCategory | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const { mains, childrenOf } = useMemo(() => {
    const items = query.data ?? [];
    const mainsList = items.filter((category) => !category.parentId || !items.some((candidate) => candidate.id === category.parentId));
    const map = new Map<string, AdminCategory[]>();
    items.forEach((category) => {
      if (category.parentId && items.some((candidate) => candidate.id === category.parentId)) {
        map.set(category.parentId, [...(map.get(category.parentId) ?? []), category]);
      }
    });
    return { mains: mainsList, childrenOf: map };
  }, [query.data]);

  const closeForm = useCallback(() => setEditing(null), []);
  const closeDelete = useCallback(() => setDeleting(null), []);

  const confirmDelete = () => {
    if (!deleting) return;
    remove.mutate(deleting.id, {
      onSuccess: () => {
        toast.success("تم إخفاء القسم (حذف ناعم)");
        setDeleting(null);
      },
      onError: (error) => toast.error(friendlyError(error, "تعذّر حذف القسم.")),
    });
  };

  return (
    <>
      <PageTitle
        eyebrow="إدارة الكتالوج"
        title="الأقسام"
        description="نظّم الأقسام الرئيسية والفرعية وحدد ما يظهر للعملاء في المتجر."
        action={<button type="button" onClick={() => setEditing("new")} className={buttonClass}><Plus className="h-4 w-4" /> قسم جديد</button>}
      />

      {query.isPending && <AdminSkeleton rows={6} />}
      {query.isError && <AdminError onRetry={() => query.refetch()} isRetrying={query.isFetching} />}
      {query.data && (
        <section className={cx(panelClass, "overflow-hidden")}>
          <div className="flex items-center justify-between border-b border-black/5 p-5">
            <div>
              <h2 className="font-bold">شجرة الأقسام</h2>
              <p className="mt-1 text-xs text-[#8b8178]">{formatNumber(mains.length)} قسم رئيسي • {formatNumber(query.data.length - mains.length)} قسم فرعي</p>
            </div>
            <FolderTree className="h-5 w-5 text-[#a77d4e]" />
          </div>
          {!mains.length && <AdminEmpty title="لا توجد أقسام بعد" description="ابدأ بإضافة أول قسم رئيسي." action={<button type="button" onClick={() => setEditing("new")} className={buttonClass}><Plus className="h-4 w-4" /> قسم جديد</button>} />}
          <div className="divide-y divide-black/5">
            {mains.map((category) => {
              const children = childrenOf.get(category.id) ?? [];
              const expanded = !collapsed[category.id];
              return (
                <div key={category.id}>
                  <CategoryRow
                    category={category}
                    childCount={children.length}
                    expanded={expanded}
                    onToggle={() => setCollapsed((current) => ({ ...current, [category.id]: !current[category.id] }))}
                    onEdit={() => setEditing(category)}
                    onDelete={() => setDeleting(category)}
                  />
                  {expanded && children.length > 0 && (
                    <div className="divide-y divide-black/5 border-t border-black/5">
                      {children.map((child) => <CategoryRow key={child.id} category={child} isChild onEdit={() => setEditing(child)} onDelete={() => setDeleting(child)} />)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <AdminModal open={editing !== null} onClose={closeForm} title={editing === "new" || !editing ? "قسم جديد" : `تعديل ${editing.name}`} description="أضف صورة واسمًا واضحًا؛ يمكنك ربطه بقسم رئيسي ليظهر كقسم فرعي." size="lg">
        {editing !== null && <CategoryForm key={editing === "new" ? "new" : editing.id} category={editing === "new" ? null : editing} parents={mains} onClose={closeForm} />}
      </AdminModal>

      <ConfirmDialog
        open={deleting !== null}
        onClose={closeDelete}
        onConfirm={confirmDelete}
        isPending={remove.isPending}
        title="حذف القسم"
        description={deleting ? `سيتم إخفاء «${deleting.name}» وأقسامه الفرعية من المتجر. المنتجات المرتبطة تبقى محفوظة.` : undefined}
        confirmLabel="حذف"
      />
    </>
  );
}
