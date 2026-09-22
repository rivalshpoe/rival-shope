"use client";

import { ExternalLink, History, PackagePlus, Pencil, Ruler, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";
import { useAdminCategories } from "@/lib/hooks/queries/admin/useAdminCategories";
import { useAdminProducts, useDeleteAdminProduct } from "@/lib/hooks/queries/admin/useAdminProducts";
import type { AdminProductRow } from "@/types/admin.types";
import { AdminEmpty, AdminError, AdminSkeleton, ConfirmDialog, useToast } from "./AdminFeedback";
import { AdminImage, Badge, buttonClass, DataTable, ghostIconClass, inputClass, PageTitle, Pagination, panelClass, SearchInput } from "./AdminUI";
import { adminRoutes, cx, formatDate, formatMoney, formatNumber, friendlyError } from "./admin-utils";

const PAGE_SIZE = 10;

export function ProductsPage() {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState<"" | "active" | "inactive">("");
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<AdminProductRow | null>(null);

  const query = useAdminProducts({
    page,
    pageSize: PAGE_SIZE,
    search: search || undefined,
    categoryId: categoryId || undefined,
    isActive: status ? status === "active" : undefined,
  });
  const categories = useAdminCategories();
  const remove = useDeleteAdminProduct();

  const onSearch = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const rows = query.data?.items ?? [];

  return (
    <>
      <PageTitle
        eyebrow="إدارة الكتالوج"
        title="المنتجات"
        description="تابع الأسعار والمخزون وحالة ظهور المنتجات في المتجر."
        action={<Link href={adminRoutes.productNew} className={buttonClass}><PackagePlus className="h-4 w-4" /> إضافة منتج</Link>}
      />

      <section className={cx(panelClass, "overflow-hidden")}>
        <div className="grid gap-3 border-b border-black/5 p-4 md:grid-cols-[1fr_14rem_10rem]">
          <SearchInput value={search} onChange={onSearch} placeholder="ابحث بالاسم أو المعرّف..." />
          <select
            value={categoryId}
            onChange={(event) => { setCategoryId(event.target.value); setPage(1); }}
            className={inputClass}
            aria-label="تصفية حسب القسم"
          >
            <option value="">كل الأقسام</option>
            {categories.data?.map((category) => (
              <option key={category.id} value={category.id}>{category.parentId ? `— ${category.name}` : category.name}</option>
            ))}
          </select>
          <select value={status} onChange={(event) => { setStatus(event.target.value as typeof status); setPage(1); }} className={inputClass} aria-label="تصفية حسب الحالة">
            <option value="">كل الحالات</option>
            <option value="active">نشط</option>
            <option value="inactive">مخفي</option>
          </select>
        </div>

        {query.isPending && <AdminSkeleton rows={6} className="rounded-none border-0 shadow-none" />}
        {query.isError && <div className="p-4"><AdminError onRetry={() => query.refetch()} isRetrying={query.isFetching} /></div>}
        {query.data && (
          <>
            <DataTable
              rows={rows}
              rowKey={(item) => item.id}
              isFetching={query.isFetching && query.isPlaceholderData}
              minWidth="min-w-[900px]"
              emptyState={<AdminEmpty title="لا توجد منتجات مطابقة" description="جرّب تعديل البحث أو الفلاتر." action={<Link href={adminRoutes.productNew} className={buttonClass}><PackagePlus className="h-4 w-4" /> إضافة منتج</Link>} />}
              columns={[
                {
                  key: "product",
                  label: "المنتج",
                  render: (item) => (
                    <div className="flex items-center gap-3">
                      <AdminImage src={item.primaryImageUrl} alt={item.title} size={96} className="h-12 w-12 shrink-0 rounded-xl" />
                      <div className="min-w-0">
                        <Link href={adminRoutes.productEdit(item.id)} className="block truncate font-bold hover:underline">{item.title}</Link>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-[#948a80]">
                          <span dir="ltr">/{item.slug}</span>
                          {item.hasSizes && <span className="inline-flex items-center gap-1 text-[#8a5f33]"><Ruler className="h-3 w-3" /> مقاسات</span>}
                        </div>
                      </div>
                    </div>
                  ),
                },
                { key: "category", label: "القسم", render: (item) => <span><span className="block">{item.categoryName}</span>{item.brandName && <small className="text-[#948a80]">{item.brandName}</small>}</span> },
                {
                  key: "price",
                  label: "السعر",
                  render: (item) => (
                    <span>
                      {item.isDiscountActive && item.discountPrice !== null ? (
                        <>
                          <strong className="block text-emerald-700">{formatMoney(item.discountPrice)}</strong>
                          <small className="text-[#948a80] line-through">{formatMoney(item.price)}</small>
                        </>
                      ) : (
                        <strong>{formatMoney(item.price)}</strong>
                      )}
                    </span>
                  ),
                },
                {
                  key: "stock",
                  label: "المخزون",
                  render: (item) => (
                    <span className={cx("font-bold", item.totalStock === 0 ? "text-red-600" : item.totalStock <= 5 ? "text-amber-700" : "")}>
                      {formatNumber(item.totalStock)} قطعة
                      {item.totalStock === 0 && <Badge tone="red" className="mr-2">نافد</Badge>}
                    </span>
                  ),
                },
                { key: "status", label: "الحالة", render: (item) => <Badge tone={item.isActive ? "green" : "slate"}>{item.isActive ? "نشط" : "مخفي"}</Badge> },
                { key: "created", label: "أُضيف", render: (item) => <span className="text-xs text-[#8a8076]">{formatDate(item.createdAt)}</span> },
                {
                  key: "actions",
                  label: "",
                  className: "text-left",
                  render: (item) => (
                    <div className="flex justify-end gap-1">
                      <Link aria-label={`عرض ${item.title} في المتجر`} href={adminRoutes.storefrontProduct(item.id)} target="_blank" rel="noreferrer" className={ghostIconClass}><ExternalLink className="h-4 w-4" /></Link>
                      <Link aria-label={`سجل مخزون ${item.title}`} href={adminRoutes.inventoryHistory(item.id)} className={ghostIconClass}><History className="h-4 w-4" /></Link>
                      <Link aria-label={`تعديل ${item.title}`} href={adminRoutes.productEdit(item.id)} className={ghostIconClass}><Pencil className="h-4 w-4" /></Link>
                      <button type="button" aria-label={`حذف ${item.title}`} onClick={() => setDeleting(item)} className={cx(ghostIconClass, "text-red-500 hover:bg-red-50 hover:text-red-600")}><Trash2 className="h-4 w-4" /></button>
                    </div>
                  ),
                },
              ]}
            />
            <Pagination pagination={query.data.pagination} onPageChange={setPage} isFetching={query.isFetching} />
          </>
        )}
      </section>

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        isPending={remove.isPending}
        title="حذف المنتج"
        description={deleting ? `سيتم إخفاء «${deleting.title}» من المتجر (حذف ناعم). يمكن للفريق الفني استرجاعه لاحقًا.` : undefined}
        confirmLabel="حذف المنتج"
        onConfirm={() => deleting && remove.mutate(deleting.id, {
          onSuccess: () => { toast.success("تم حذف المنتج"); setDeleting(null); },
          onError: (error) => toast.error(friendlyError(error, "تعذّر حذف المنتج.")),
        })}
      />
    </>
  );
}
