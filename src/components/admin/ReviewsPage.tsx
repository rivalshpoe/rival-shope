"use client";

import { MessageSquareQuote, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useAdminReviews, useApproveAdminReview, useDeleteAdminReview } from "@/lib/hooks/queries/admin/useAdminReviews";
import type { AdminReview } from "@/types/admin.types";
import { AdminEmpty, AdminError, AdminSkeleton, ConfirmDialog, useToast } from "./AdminFeedback";
import { AdminImage, buttonClass, DataTable, ghostIconClass, PageTitle, Pagination, panelClass, Stars, Tabs, Toggle } from "./AdminUI";
import { adminRoutes, cx, formatDate, formatNumber, friendlyError } from "./admin-utils";

export function ReviewsPage() {
  const toast = useToast();
  const [tab, setTab] = useState<"all" | "approved" | "pending">("all");
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<AdminReview | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const query = useAdminReviews({ page, pageSize: 10, approvedOnly: tab === "approved" ? true : tab === "pending" ? false : undefined });
  const approve = useApproveAdminReview();
  const remove = useDeleteAdminReview();

  const toggleApproval = (review: AdminReview) => {
    setPendingId(review.id);
    approve.mutate(
      { id: review.id, isApproved: !review.isApproved },
      {
        onSuccess: (updated) => toast.success(updated.isApproved ? "تم نشر التقييم" : "تم إخفاء التقييم"),
        onError: (error) => toast.error(friendlyError(error, "تعذّر تحديث حالة التقييم.")),
        onSettled: () => setPendingId(null),
      },
    );
  };

  return (
    <>
      <PageTitle
        eyebrow="المحتوى"
        title="التقييمات"
        description="راجع آراء العميلات، اعتمد ما يُنشر في المتجر، وأضف تقييمات موثّقة."
        action={<Link href={adminRoutes.reviewNew} className={buttonClass}><Plus className="h-4 w-4" /> تقييم جديد</Link>}
      />
      <section className={cx(panelClass, "overflow-hidden")}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/5 p-4">
          <Tabs tabs={[{ value: "all", label: "الكل" }, { value: "approved", label: "منشور" }, { value: "pending", label: "بانتظار الاعتماد" }]} value={tab} onChange={(value) => { setTab(value); setPage(1); }} ariaLabel="تصفية التقييمات" />
          {query.data && <span className="text-xs text-[#8b8178]">{formatNumber(query.data.pagination.totalItems)} تقييم</span>}
        </div>
        {query.isPending && <AdminSkeleton rows={6} className="rounded-none border-0 shadow-none" />}
        {query.isError && <div className="p-4"><AdminError onRetry={() => query.refetch()} isRetrying={query.isFetching} /></div>}
        {query.data && (
          <>
            <DataTable
              rows={query.data.items}
              rowKey={(review) => review.id}
              isFetching={query.isFetching && query.isPlaceholderData}
              minWidth="min-w-[900px]"
              emptyState={<AdminEmpty title="لا توجد تقييمات" icon={<MessageSquareQuote className="h-6 w-6" />} action={<Link href={adminRoutes.reviewNew} className={buttonClass}><Plus className="h-4 w-4" /> تقييم جديد</Link>} />}
              columns={[
                {
                  key: "customer",
                  label: "العميلة",
                  render: (review) => (
                    <div className="flex items-center gap-3">
                      {review.imageUrl ? <AdminImage src={review.imageUrl} alt="" size={96} className="h-11 w-11 shrink-0 rounded-xl" /> : <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#f3ebdf] text-sm font-black text-[#8a5f33]">{review.customerName.slice(0, 1)}</span>}
                      <span><strong className="block">{review.customerName}</strong><small className="text-[#9a9086]">{formatDate(review.createdAt)}</small></span>
                    </div>
                  ),
                },
                { key: "rating", label: "التقييم", render: (review) => <Stars value={review.rating} /> },
                { key: "comment", label: "التعليق", className: "max-w-md", render: (review) => <p className="line-clamp-2 text-sm leading-6 text-[#4f463e]" title={review.comment}>{review.comment}</p> },
                { key: "product", label: "المنتج", render: (review) => review.productId ? <Link href={adminRoutes.productEdit(review.productId)} className="text-xs font-bold hover:underline">{review.productTitle ?? "منتج"}</Link> : <span className="text-xs text-[#9a9086]">عام</span> },
                {
                  key: "status",
                  label: "النشر",
                  render: (review) => (
                    <div className="flex items-center gap-2">
                      <Toggle checked={review.isApproved} onChange={() => toggleApproval(review)} disabled={approve.isPending && pendingId === review.id} label={review.isApproved ? "منشور" : "مخفي"} />
                    </div>
                  ),
                },
                {
                  key: "actions",
                  label: "",
                  className: "text-left",
                  render: (review) => (
                    <div className="flex justify-end gap-1">
                      <Link href={adminRoutes.reviewEdit(review.id)} aria-label={`تعديل تقييم ${review.customerName}`} className={ghostIconClass}><Pencil className="h-4 w-4" /></Link>
                      <button type="button" aria-label={`حذف تقييم ${review.customerName}`} onClick={() => setDeleting(review)} className={cx(ghostIconClass, "text-red-500 hover:bg-red-50 hover:text-red-600")}><Trash2 className="h-4 w-4" /></button>
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
        title="حذف التقييم"
        description={deleting ? `سيتم حذف تقييم «${deleting.customerName}» نهائيًا.` : undefined}
        confirmLabel="حذف"
        onConfirm={() => deleting && remove.mutate(deleting.id, {
          onSuccess: () => { toast.success("تم حذف التقييم"); setDeleting(null); },
          onError: (error) => toast.error(friendlyError(error, "تعذّر حذف التقييم.")),
        })}
      />
    </>
  );
}
