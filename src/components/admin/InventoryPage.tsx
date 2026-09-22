"use client";

import { Boxes, History, PackagePlus, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useAdminInventory, useRestockAdminInventory } from "@/lib/hooks/queries/admin/useAdminInventory";
import type { AdminInventoryRow } from "@/types/admin.types";
import { AdminEmpty, AdminError, AdminModal, AdminSkeleton, useToast } from "./AdminFeedback";
import { AdminImage, Badge, DataTable, Field, ghostIconClass, inputClass, PageTitle, Pagination, panelClass, PendingButton, secondaryButtonClass, Toggle } from "./AdminUI";
import { adminRoutes, cx, formatNumber, formatRelative, friendlyError } from "./admin-utils";

const PAGE_SIZE = 12;

export function RestockModal({ row, onClose }: { row: AdminInventoryRow | null; onClose: () => void }) {
  const toast = useToast();
  const restock = useRestockAdminInventory();
  const [quantity, setQuantity] = useState("10");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const parsed = Number(quantity);
  const valid = Number.isInteger(parsed) && parsed > 0 && parsed <= 10_000;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!row) return;
    if (!valid) {
      setError("أدخل كمية صحيحة بين 1 و10000");
      return;
    }
    setError("");
    restock.mutate(
      { productId: row.productId, sizeId: row.sizeId, quantity: parsed, note: note.trim() || null },
      {
        onSuccess: (response) => {
          toast.success(`تمت إضافة ${formatNumber(parsed)} قطعة — المخزون الآن ${formatNumber(response.stock)}`);
          onClose();
        },
        onError: (mutationError) => setError(friendlyError(mutationError, "تعذّر تحديث المخزون.")),
      },
    );
  };

  return (
    <AdminModal open={row !== null} onClose={() => !restock.isPending && onClose()} title="إعادة تعبئة المخزون" description={row ? `${row.productTitle}${row.sizeLabel ? ` — مقاس ${row.sizeLabel}` : ""}` : undefined} size="sm">
      {row && (
        <form onSubmit={submit} noValidate className="space-y-4">
          <div className="flex items-center gap-3 rounded-2xl bg-[#faf7f1] p-3">
            <AdminImage src={row.primaryImageUrl} alt={row.productTitle} size={96} className="h-12 w-12 rounded-xl" />
            <div className="text-sm"><p className="font-bold">{row.productTitle}</p><p className="text-xs text-[#8b8178]">المخزون الحالي: <strong className={cx(row.isDepleted && "text-red-600")}>{formatNumber(row.stock)}</strong></p></div>
          </div>
          <Field label="الكمية المضافة" required error={error}>
            <input value={quantity} onChange={(event) => { setQuantity(event.target.value); setError(""); }} type="number" min={1} max={10000} step={1} className={inputClass} autoFocus />
          </Field>
          <div className="flex flex-wrap gap-2">
            {[5, 10, 25, 50].map((preset) => (
              <button key={preset} type="button" onClick={() => setQuantity(String(preset))} className={cx("rounded-lg border px-3 py-1 text-xs font-bold transition", quantity === String(preset) ? "border-[#17130f] bg-[#17130f] text-white" : "border-black/10 hover:border-[#c7a478]")}>+{preset}</button>
            ))}
          </div>
          <Field label="ملاحظة" hint="اختياري — مثل رقم الشحنة أو المورد">
            <input value={note} onChange={(event) => setNote(event.target.value)} className={inputClass} maxLength={120} placeholder="شحنة سبتمبر" />
          </Field>
          {valid && <p className="text-xs text-[#6f665d]">المخزون بعد التعبئة: <strong>{formatNumber(row.stock + parsed)}</strong> قطعة</p>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} disabled={restock.isPending} className={secondaryButtonClass}>إلغاء</button>
            <PendingButton type="submit" isPending={restock.isPending} disabled={!valid}><PackagePlus className="h-4 w-4" /> تأكيد التعبئة</PendingButton>
          </div>
        </form>
      )}
    </AdminModal>
  );
}

export function InventoryPage() {
  const [lowOnly, setLowOnly] = useState(false);
  const [threshold, setThreshold] = useState(5);
  const [page, setPage] = useState(1);
  const [restocking, setRestocking] = useState<AdminInventoryRow | null>(null);
  const query = useAdminInventory({ lowStockOnly: lowOnly, threshold, page, pageSize: PAGE_SIZE });
  const rows = query.data?.items ?? [];
  const lowCount = rows.filter((row) => row.isLow || row.isDepleted).length;

  return (
    <>
      <PageTitle eyebrow="إدارة الكتالوج" title="المخزون" description="تابع الكميات المتاحة لكل منتج ومقاس، وأعد التعبئة قبل نفاد المخزون." />

      <section className={cx(panelClass, "overflow-hidden")}>
        <div className="flex flex-wrap items-center gap-4 border-b border-black/5 p-4">
          <Toggle checked={lowOnly} onChange={(value) => { setLowOnly(value); setPage(1); }} label="المخزون المنخفض فقط" />
          <label className="flex items-center gap-2 text-sm">
            <span className="text-[#6f665d]">حد التنبيه</span>
            <input type="number" min={1} max={100} value={threshold} onChange={(event) => { setThreshold(Math.max(1, Number(event.target.value) || 1)); setPage(1); }} className={cx(inputClass, "w-20 py-2 text-center")} aria-label="حد المخزون المنخفض" />
            <span className="text-xs text-[#8b8178]">قطعة أو أقل</span>
          </label>
          {query.data && <span className="mr-auto inline-flex items-center gap-1 text-xs text-[#8b8178]"><Boxes className="h-4 w-4" /> {formatNumber(query.data.pagination.totalItems)} صف{lowCount > 0 && <span className="mr-2 inline-flex items-center gap-1 font-bold text-amber-700"><TriangleAlert className="h-3.5 w-3.5" /> {formatNumber(lowCount)} يحتاج انتباهًا في هذه الصفحة</span>}</span>}
        </div>

        {query.isPending && <AdminSkeleton rows={8} className="rounded-none border-0 shadow-none" />}
        {query.isError && <div className="p-4"><AdminError onRetry={() => query.refetch()} isRetrying={query.isFetching} /></div>}
        {query.data && (
          <>
            <DataTable
              rows={rows}
              rowKey={(row) => `${row.productId}:${row.sizeId ?? "base"}`}
              isFetching={query.isFetching && query.isPlaceholderData}
              minWidth="min-w-[760px]"
              emptyState={<AdminEmpty title={lowOnly ? "لا يوجد مخزون منخفض" : "لا توجد منتجات"} description={lowOnly ? "جميع المنتجات ضمن الحد الآمن." : undefined} />}
              columns={[
                {
                  key: "product",
                  label: "المنتج",
                  render: (row) => (
                    <div className="flex items-center gap-3">
                      <AdminImage src={row.primaryImageUrl} alt={row.productTitle} size={96} className="h-11 w-11 shrink-0 rounded-xl" />
                      <div className="min-w-0">
                        <Link href={adminRoutes.productEdit(row.productId)} className="block truncate font-bold hover:underline">{row.productTitle}</Link>
                        {row.sizeLabel && <span className="mt-0.5 inline-block rounded-md bg-[#f3ebdf] px-2 py-0.5 text-[11px] font-bold text-[#8a5f33]">مقاس {row.sizeLabel}</span>}
                      </div>
                    </div>
                  ),
                },
                {
                  key: "stock",
                  label: "المخزون",
                  render: (row) => (
                    <div className="flex items-center gap-3">
                      <strong className={cx("text-base", row.isDepleted ? "text-red-600" : row.isLow ? "text-amber-700" : "")}>{formatNumber(row.stock)}</strong>
                      <span className="h-2 w-24 overflow-hidden rounded-full bg-[#eee7dc]" aria-hidden>
                        <span className={cx("block h-full rounded-full", row.isDepleted ? "bg-red-500" : row.isLow ? "bg-amber-500" : "bg-emerald-500")} style={{ width: `${Math.min(100, (row.stock / Math.max(threshold * 4, 1)) * 100)}%` }} />
                      </span>
                    </div>
                  ),
                },
                { key: "status", label: "الحالة", render: (row) => <Badge tone={row.isDepleted ? "red" : row.isLow ? "amber" : "green"}>{row.isDepleted ? "نافد" : row.isLow ? "منخفض" : "متوفر"}</Badge> },
                { key: "last", label: "آخر تغيير", render: (row) => <span className="text-xs text-[#8b8178]">{formatRelative(row.lastChangeAt)}</span> },
                {
                  key: "actions",
                  label: "",
                  className: "text-left",
                  render: (row) => (
                    <div className="flex justify-end gap-1">
                      <Link href={row.sizeId ? `${adminRoutes.inventoryHistory(row.productId)}?sizeId=${encodeURIComponent(row.sizeId)}` : adminRoutes.inventoryHistory(row.productId)} aria-label={`سجل حركات ${row.productTitle}`} className={ghostIconClass}><History className="h-4 w-4" /></Link>
                      <button type="button" onClick={() => setRestocking(row)} className="inline-flex items-center gap-1 rounded-xl bg-[#17130f] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#2b251f]"><PackagePlus className="h-3.5 w-3.5" /> تعبئة</button>
                    </div>
                  ),
                },
              ]}
            />
            <Pagination pagination={query.data.pagination} onPageChange={setPage} isFetching={query.isFetching} />
          </>
        )}
      </section>

      <RestockModal key={restocking ? `${restocking.productId}:${restocking.sizeId ?? ""}` : "closed"} row={restocking} onClose={() => setRestocking(null)} />
    </>
  );
}
