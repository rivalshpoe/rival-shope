"use client";

import { ChevronLeft, HandCoins } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";
import { useAdminOrders } from "@/lib/hooks/queries/admin/useAdminOrders";
import type { AdminOrderStatus, AdminOrdersQuery } from "@/types/admin.types";
import { AdminEmpty, AdminError, AdminSkeleton } from "./AdminFeedback";
import { Badge, DataTable, inputClass, PageTitle, Pagination, panelClass, SearchInput, Tabs } from "./AdminUI";
import { adminRoutes, cx, formatDateTime, formatMoney, formatNumber, ORDER_STATUS_LABEL, ORDER_STATUS_TONE } from "./admin-utils";

type Tab = "all" | AdminOrderStatus | "collected";
const TABS: Array<{ value: Tab; label: string }> = [
  { value: "all", label: "الكل" },
  { value: "Pending", label: "قيد الانتظار" },
  { value: "Confirmed", label: "مؤكد" },
  { value: "Cancelled", label: "ملغي" },
  { value: "Fake", label: "وهمي" },
  { value: "collected", label: "محصّل" },
];
const PAGE_SIZE = 10;

export function OrdersPage() {
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const query: AdminOrdersQuery = {
    page,
    pageSize: PAGE_SIZE,
    search: search || undefined,
    from: from || undefined,
    to: to || undefined,
    status: tab !== "all" && tab !== "collected" ? tab : undefined,
    isCollected: tab === "collected" ? true : undefined,
  };
  const orders = useAdminOrders(query);
  const onSearch = useCallback((value: string) => { setSearch(value); setPage(1); }, []);

  return (
    <>
      <PageTitle
        eyebrow="المبيعات"
        title="الطلبات"
        description="راجع الطلبات، أكّدها أو ألغِها، وحدّد الطلبات الوهمية لحماية المتجر."
        action={<Link href={adminRoutes.collections} className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white px-5 py-3 text-sm font-bold text-[#211c17] transition hover:border-[#c7a478]"><HandCoins className="h-4 w-4" /> تحصيل الفواتير</Link>}
      />

      <section className={cx(panelClass, "overflow-hidden")}>
        <div className="space-y-3 border-b border-black/5 p-4">
          <Tabs tabs={TABS} value={tab} onChange={(value) => { setTab(value); setPage(1); }} ariaLabel="تصفية الطلبات حسب الحالة" />
          <div className="grid gap-3 md:grid-cols-[1fr_11rem_11rem]">
            <SearchInput value={search} onChange={onSearch} placeholder="ابحث برقم الفاتورة أو اسم العميل أو الهاتف..." />
            <label className="block">
              <span className="sr-only">من تاريخ</span>
              <input type="date" value={from} max={to || undefined} onChange={(event) => { setFrom(event.target.value); setPage(1); }} dir="ltr" className={cx(inputClass, "text-left")} aria-label="من تاريخ" />
            </label>
            <label className="block">
              <span className="sr-only">إلى تاريخ</span>
              <input type="date" value={to} min={from || undefined} onChange={(event) => { setTo(event.target.value); setPage(1); }} dir="ltr" className={cx(inputClass, "text-left")} aria-label="إلى تاريخ" />
            </label>
          </div>
        </div>

        {orders.isPending && <AdminSkeleton rows={6} className="rounded-none border-0 shadow-none" />}
        {orders.isError && <div className="p-4"><AdminError onRetry={() => orders.refetch()} isRetrying={orders.isFetching} /></div>}
        {orders.data && (
          <>
            <DataTable
              rows={orders.data.items}
              rowKey={(item) => item.id}
              isFetching={orders.isFetching && orders.isPlaceholderData}
              minWidth="min-w-[860px]"
              emptyState={<AdminEmpty title="لا توجد طلبات مطابقة" description="جرّب تغيير الحالة أو نطاق التاريخ." />}
              columns={[
                { key: "invoice", label: "رقم الفاتورة", render: (item) => <Link className="font-black text-[#8e663a] hover:underline" dir="ltr" href={adminRoutes.order(item.id)}>{item.invoiceNumber}</Link> },
                { key: "customer", label: "العميل", render: (item) => <span><strong className="block">{item.customerName}</strong><small dir="ltr" className="block text-right text-[#92887e]">+{item.whatsAppCountryCode} {item.phoneNumber}</small></span> },
                { key: "date", label: "التاريخ", render: (item) => <span className="text-xs text-[#6f665d]">{formatDateTime(item.createdAt)}</span> },
                { key: "items", label: "القطع", render: (item) => `${formatNumber(item.itemCount)} قطعة` },
                { key: "total", label: "الإجمالي", render: (item) => <strong>{formatMoney(item.total)}</strong> },
                {
                  key: "status",
                  label: "الحالة",
                  render: (item) => (
                    <span className="flex flex-wrap gap-1">
                      <Badge tone={ORDER_STATUS_TONE[item.status]}>{ORDER_STATUS_LABEL[item.status]}</Badge>
                      {item.isCollected && <Badge tone="gold">محصّل</Badge>}
                    </span>
                  ),
                },
                { key: "open", label: "", className: "text-left", render: (item) => <Link href={adminRoutes.order(item.id)} className="inline-flex items-center gap-1 text-xs font-bold hover:underline">التفاصيل <ChevronLeft className="h-4 w-4" /></Link> },
              ]}
            />
            <Pagination pagination={orders.data.pagination} onPageChange={setPage} isFetching={orders.isFetching} />
          </>
        )}
      </section>
    </>
  );
}
