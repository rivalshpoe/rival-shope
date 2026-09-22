"use client";

import { ArrowDownLeft, ArrowUpRight, ChevronLeft, PackagePlus, PackageX, Undo2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useAdminInventoryHistory } from "@/lib/hooks/queries/admin/useAdminInventory";
import { useAdminProduct } from "@/lib/hooks/queries/admin/useAdminProducts";
import type { AdminInventoryRow, InventoryChangeType } from "@/types/admin.types";
import { AdminEmpty, AdminError, AdminSkeleton } from "./AdminFeedback";
import { AdminImage, Badge, PageTitle, Pagination, panelClass, secondaryButtonClass, Tabs } from "./AdminUI";
import { adminRoutes, cx, formatDateTime, formatNumber, friendlyError, INVENTORY_CHANGE_LABEL, INVENTORY_CHANGE_TONE } from "./admin-utils";
import { RestockModal } from "./InventoryPage";

const ICONS: Record<InventoryChangeType, typeof ArrowUpRight> = {
  Sale: ArrowDownLeft,
  Restock: ArrowUpRight,
  Depleted: PackageX,
  Return: Undo2,
};

export function InventoryHistoryPage({ productId }: { productId: string }) {
  const searchParams = useSearchParams();
  const [sizeId, setSizeId] = useState(searchParams.get("sizeId") ?? "");
  const [page, setPage] = useState(1);
  const [restocking, setRestocking] = useState<AdminInventoryRow | null>(null);
  const product = useAdminProduct(productId);
  const history = useAdminInventoryHistory(productId, { sizeId: sizeId || undefined, page, pageSize: 15 });

  const sizeTabs = product.data?.hasSizes
    ? [{ value: "", label: "كل المقاسات" }, ...product.data.sizes.map((size) => ({ value: size.id, label: `${size.label} (${formatNumber(size.stock)})` }))]
    : [];
  const currentSize = product.data?.sizes.find((size) => size.id === sizeId) ?? null;
  const currentStock = product.data ? (product.data.hasSizes ? (currentSize ? currentSize.stock : product.data.sizes.reduce((sum, size) => sum + size.stock, 0)) : product.data.stock) : 0;

  const openRestock = () => {
    if (!product.data) return;
    if (product.data.hasSizes && !currentSize) return;
    setRestocking({
      productId: product.data.id,
      productTitle: product.data.title,
      primaryImageUrl: product.data.images[0]?.url ?? "",
      sizeId: currentSize?.id ?? null,
      sizeLabel: currentSize?.label ?? null,
      stock: currentStock,
      isLow: currentStock <= 5,
      isDepleted: currentStock === 0,
      lastChangeAt: product.data.createdAt,
    });
  };

  return (
    <>
      <PageTitle
        eyebrow="سجل المخزون"
        title={product.data ? product.data.title : "سجل حركات المخزون"}
        description="كل حركة بيع أو تعبئة أو إرجاع مسجلة مع الكمية والمخزون بعد التغيير."
        action={
          <>
            <button type="button" onClick={openRestock} disabled={!product.data || (product.data.hasSizes && !currentSize)} className="inline-flex items-center gap-2 rounded-2xl bg-[#141210] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#2b251f] disabled:cursor-not-allowed disabled:opacity-50" title={product.data?.hasSizes && !currentSize ? "اختر مقاسًا لإعادة التعبئة" : undefined}>
              <PackagePlus className="h-4 w-4" /> تعبئة
            </button>
            <Link href={adminRoutes.inventory} className={secondaryButtonClass}>المخزون <ChevronLeft className="h-4 w-4" /></Link>
          </>
        }
      />

      {product.isPending && <AdminSkeleton variant="detail" rows={2} />}
      {product.isError && <AdminError message={friendlyError(product.error, "تعذّر تحميل المنتج.")} onRetry={() => product.refetch()} isRetrying={product.isFetching} />}
      {product.data && (
        <div className="grid gap-5 xl:grid-cols-[1fr_2fr]">
          <section className={cx(panelClass, "h-fit p-5")}>
            <div className="flex items-center gap-4">
              <AdminImage src={product.data.images[0]?.url ?? null} alt={product.data.title} size={160} className="h-20 w-20 rounded-2xl" />
              <div className="min-w-0">
                <Link href={adminRoutes.productEdit(product.data.id)} className="block truncate font-bold hover:underline">{product.data.title}</Link>
                <p className="mt-1 text-xs text-[#8b8178]">{product.data.categoryName}</p>
                <Badge tone={product.data.isActive ? "green" : "slate"} className="mt-2">{product.data.isActive ? "نشط" : "مخفي"}</Badge>
              </div>
            </div>
            <div className="mt-5 rounded-2xl bg-[#faf7f1] p-4">
              <p className="text-xs text-[#8b8178]">{currentSize ? `مخزون مقاس ${currentSize.label}` : "المخزون الإجمالي"}</p>
              <p className={cx("mt-1 text-3xl font-black", currentStock === 0 ? "text-red-600" : currentStock <= 5 ? "text-amber-700" : "")}>{formatNumber(currentStock)} <span className="text-sm font-bold text-[#8b8178]">قطعة</span></p>
            </div>
            {product.data.hasSizes && (
              <ul className="mt-4 space-y-1.5 text-sm">
                {product.data.sizes.map((size) => (
                  <li key={size.id} className="flex items-center justify-between rounded-xl px-3 py-2 hover:bg-[#faf7f1]">
                    <span className="font-bold">{size.label}</span>
                    <span className={cx(size.stock === 0 ? "text-red-600" : size.stock <= 5 ? "text-amber-700" : "text-[#6f665d]")}>{formatNumber(size.stock)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={cx(panelClass, "overflow-hidden")}>
            {sizeTabs.length > 0 && (
              <div className="border-b border-black/5 p-4">
                <Tabs tabs={sizeTabs} value={sizeId} onChange={(value) => { setSizeId(value); setPage(1); }} ariaLabel="تصفية حسب المقاس" />
              </div>
            )}
            {history.isPending && <AdminSkeleton rows={8} className="rounded-none border-0 shadow-none" />}
            {history.isError && <div className="p-4"><AdminError onRetry={() => history.refetch()} isRetrying={history.isFetching} /></div>}
            {history.data && (
              <>
                {!history.data.items.length ? (
                  <AdminEmpty title="لا توجد حركات مسجلة" description="ستظهر حركات البيع والتعبئة هنا." />
                ) : (
                  <ol className={cx("divide-y divide-black/5", history.isFetching && history.isPlaceholderData && "opacity-60")}>
                    {history.data.items.map((log) => {
                      const Icon = ICONS[log.changeType];
                      const positive = log.quantityChanged > 0;
                      return (
                        <li key={log.id} className="flex items-center gap-4 p-4">
                          <span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl", log.changeType === "Restock" || log.changeType === "Return" ? "bg-emerald-50 text-emerald-700" : log.changeType === "Depleted" ? "bg-red-50 text-red-600" : "bg-[#f3ebdf] text-[#8a5f33]")}>
                            <Icon className="h-4 w-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="flex flex-wrap items-center gap-2 text-sm">
                              <Badge tone={INVENTORY_CHANGE_TONE[log.changeType]}>{INVENTORY_CHANGE_LABEL[log.changeType]}</Badge>
                              {log.note && <span className="truncate text-xs text-[#6f665d]">{log.note}</span>}
                            </p>
                            <p className="mt-1 text-[11px] text-[#9a9086]">{formatDateTime(log.createdAt)}</p>
                          </div>
                          <div className="text-left">
                            <p className={cx("text-sm font-black", positive ? "text-emerald-700" : log.quantityChanged < 0 ? "text-red-600" : "text-[#6f665d]")} dir="ltr">{positive ? "+" : ""}{formatNumber(log.quantityChanged)}</p>
                            <p className="text-[11px] text-[#9a9086]">الرصيد: {formatNumber(log.stockAfter)}</p>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
                <Pagination pagination={history.data.pagination} onPageChange={setPage} isFetching={history.isFetching} />
              </>
            )}
          </section>
        </div>
      )}
      <RestockModal key={restocking ? `${restocking.productId}:${restocking.sizeId ?? ""}` : "closed"} row={restocking} onClose={() => setRestocking(null)} />
    </>
  );
}
