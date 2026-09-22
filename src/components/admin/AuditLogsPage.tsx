"use client";

import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useAdminAuditLogs } from "@/lib/hooks/queries/admin/useAdminAuditLogs";
import { AdminEmpty, AdminError, AdminSkeleton } from "./AdminFeedback";
import { Badge, DataTable, PageTitle, Pagination, panelClass } from "./AdminUI";
import { cx, formatDateTime, formatNumber, type Tone } from "./admin-utils";

/** Actions are verb-prefixed (`CreateProduct`, `UpdateOrderStatus:Confirmed`, `BlockDevice`). */
const VERBS: Array<{ prefix: string; label: string; tone: Tone }> = [
  { prefix: "UpdateOrderStatus", label: "تغيير حالة طلب", tone: "amber" },
  { prefix: "Unblock", label: "رفع حظر", tone: "green" },
  { prefix: "Block", label: "حظر", tone: "red" },
  { prefix: "Create", label: "إنشاء", tone: "green" },
  { prefix: "Update", label: "تعديل", tone: "blue" },
  { prefix: "Delete", label: "حذف", tone: "red" },
  { prefix: "Restock", label: "تعبئة مخزون", tone: "green" },
  { prefix: "Collect", label: "تحصيل", tone: "gold" },
  { prefix: "Approve", label: "اعتماد", tone: "green" },
  { prefix: "Resolve", label: "حل إشعار", tone: "slate" },
  { prefix: "Login", label: "تسجيل دخول", tone: "slate" },
  { prefix: "Logout", label: "تسجيل خروج", tone: "slate" },
];
const STATUS_SUFFIX: Record<string, string> = { Confirmed: "مؤكد", Cancelled: "ملغي", Fake: "وهمي", Pending: "قيد الانتظار", true: "منشور", false: "مخفي" };

function describeAction(action: string): { label: string; tone: Tone } {
  const [verb, suffix] = action.split(":");
  const match = VERBS.find((candidate) => verb.startsWith(candidate.prefix));
  const base = match?.label ?? action;
  const detail = suffix ? ` → ${STATUS_SUFFIX[suffix] ?? suffix}` : "";
  return { label: `${base}${detail}`, tone: match?.tone ?? "slate" };
}
const ENTITY_LABEL: Record<string, string> = {
  Product: "منتج",
  Category: "قسم",
  Brand: "ماركة",
  Order: "طلب",
  DeliveryZone: "منطقة توصيل",
  DiscountCode: "كود خصم",
  Inventory: "مخزون",
  Device: "جهاز",
  Notification: "إشعار",
  Policy: "سياسة",
  Review: "تقييم",
  Session: "جلسة",
};

export function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const query = useAdminAuditLogs({ page, pageSize: 20 });

  return (
    <>
      <PageTitle eyebrow="الأمان" title="سجل العمليات" description="سجل للقراءة فقط بكل الإجراءات التي نفذها المسؤولون في لوحة التحكم." />
      <section className={cx(panelClass, "overflow-hidden")}>
        <div className="flex items-center justify-between border-b border-black/5 p-5">
          <div><h2 className="font-bold">آخر العمليات</h2>{query.data && <p className="mt-1 text-xs text-[#8b8178]">{formatNumber(query.data.pagination.totalItems)} عملية مسجلة</p>}</div>
          <ShieldCheck className="h-5 w-5 text-[#a77d4e]" />
        </div>
        {query.isPending && <AdminSkeleton rows={10} className="rounded-none border-0 shadow-none" />}
        {query.isError && <div className="p-4"><AdminError onRetry={() => query.refetch()} isRetrying={query.isFetching} /></div>}
        {query.data && (
          <>
            <DataTable
              rows={query.data.items}
              rowKey={(log) => log.id}
              isFetching={query.isFetching && query.isPlaceholderData}
              minWidth="min-w-[820px]"
              emptyState={<AdminEmpty title="لا توجد عمليات مسجلة" />}
              columns={[
                { key: "time", label: "الوقت", render: (log) => <span className="whitespace-nowrap text-xs text-[#6f665d]">{formatDateTime(log.createdAt)}</span> },
                { key: "admin", label: "المسؤول", render: (log) => <span dir="ltr" className="block text-right text-xs font-bold">{log.adminEmail}</span> },
                {
                  key: "action",
                  label: "الإجراء",
                  render: (log) => {
                    const described = describeAction(log.action);
                    return <Badge tone={described.tone} title={log.action}>{described.label}</Badge>;
                  },
                },
                { key: "entity", label: "العنصر", render: (log) => <span><span className="block text-sm">{ENTITY_LABEL[log.entityType] ?? log.entityType}</span><span dir="ltr" className="block truncate text-right font-mono text-[11px] text-[#9a9086]">{log.entityId}</span></span> },
                { key: "ip", label: "عنوان IP", render: (log) => <span dir="ltr" className="block text-right font-mono text-xs text-[#6f665d]">{log.ipAddress}</span> },
              ]}
            />
            <Pagination pagination={query.data.pagination} onPageChange={setPage} isFetching={query.isFetching} />
          </>
        )}
      </section>
    </>
  );
}
