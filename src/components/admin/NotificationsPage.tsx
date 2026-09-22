"use client";

import { BellRing, Check, CheckCircle2, ChevronLeft, PackageX, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useAdminNotifications, useResolveAdminNotification } from "@/lib/hooks/queries/admin/useAdminNotifications";
import type { AdminNotificationType } from "@/types/admin.types";
import { AdminEmpty, AdminError, AdminSkeleton, useToast } from "./AdminFeedback";
import { Badge, PageTitle, Pagination, panelClass, PendingButton, Tabs } from "./AdminUI";
import { adminRoutes, cx, formatDateTime, formatNumber, formatRelative, friendlyError, NOTIFICATION_TYPE_LABEL } from "./admin-utils";

const ICONS: Record<AdminNotificationType, typeof BellRing> = { NewOrder: BellRing, LowStock: TriangleAlert, Depleted: PackageX };
const TONES: Record<AdminNotificationType, "gold" | "amber" | "red"> = { NewOrder: "gold", LowStock: "amber", Depleted: "red" };

export function NotificationsPage() {
  const toast = useToast();
  const [tab, setTab] = useState<"unresolved" | "all">("unresolved");
  const [page, setPage] = useState(1);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const query = useAdminNotifications({ unresolvedOnly: tab === "unresolved", page, pageSize: 12 }, { poll: tab === "unresolved" });
  const resolve = useResolveAdminNotification();

  const markResolved = (id: string) => {
    setPendingId(id);
    resolve.mutate(id, {
      onSuccess: () => toast.success("تم تحديد الإشعار كمحلول"),
      onError: (error) => toast.error(friendlyError(error, "تعذّر تحديث الإشعار.")),
      onSettled: () => setPendingId(null),
    });
  };

  return (
    <>
      <PageTitle eyebrow="المتابعة" title="الإشعارات" description="الطلبات الجديدة وتنبيهات المخزون. تبقى الإشعارات ظاهرة حتى تحددها كمحلولة." />
      <section className={cx(panelClass, "overflow-hidden")}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/5 p-4">
          <Tabs tabs={[{ value: "unresolved", label: "غير محلولة" }, { value: "all", label: "الكل" }]} value={tab} onChange={(value) => { setTab(value); setPage(1); }} ariaLabel="تصفية الإشعارات" />
          {query.data && <span className="text-xs text-[#8b8178]">{formatNumber(query.data.pagination.totalItems)} إشعار</span>}
        </div>
        {query.isPending && <AdminSkeleton variant="lines" rows={8} className="p-5" />}
        {query.isError && <div className="p-4"><AdminError onRetry={() => query.refetch()} isRetrying={query.isFetching} /></div>}
        {query.data && (
          <>
            {!query.data.items.length ? (
              <AdminEmpty title={tab === "unresolved" ? "لا توجد إشعارات غير محلولة" : "لا توجد إشعارات"} description={tab === "unresolved" ? "كل شيء تحت السيطرة." : undefined} icon={<CheckCircle2 className="h-6 w-6" />} />
            ) : (
              <ul className={cx("divide-y divide-black/5", query.isFetching && query.isPlaceholderData && "opacity-60")}>
                {query.data.items.map((item) => {
                  const Icon = ICONS[item.type];
                  const href = item.relatedOrderId ? adminRoutes.order(item.relatedOrderId) : item.relatedProductId ? adminRoutes.inventoryHistory(item.relatedProductId) : null;
                  return (
                    <li key={item.id} className={cx("flex flex-wrap items-start gap-4 p-5 sm:flex-nowrap", item.isResolved && "opacity-70")}>
                      <span className={cx("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl", item.type === "Depleted" ? "bg-red-50 text-red-600" : item.type === "LowStock" ? "bg-amber-50 text-amber-700" : "bg-[#f3ebdf] text-[#8a5f33]")}>
                        <Icon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-bold">{item.title}</p>
                          <Badge tone={TONES[item.type]}>{NOTIFICATION_TYPE_LABEL[item.type]}</Badge>
                          {item.isResolved && <Badge tone="green">محلول</Badge>}
                        </div>
                        <p className="mt-1 text-sm leading-6 text-[#6f665d]">{item.message}</p>
                        <p className="mt-2 text-[11px] text-[#9a9086]" title={formatDateTime(item.createdAt)}>{formatRelative(item.createdAt)}</p>
                      </div>
                      <div className="flex w-full shrink-0 gap-2 sm:w-auto">
                        {href && <Link href={href} className="inline-flex items-center gap-1 rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-bold hover:border-[#c7a478]">فتح <ChevronLeft className="h-3.5 w-3.5" /></Link>}
                        {!item.isResolved && (
                          <PendingButton type="button" isPending={pendingId === item.id} disabled={resolve.isPending} onClick={() => markResolved(item.id)} className="inline-flex items-center gap-1 rounded-xl bg-[#17130f] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#2b251f] disabled:opacity-50">
                            <Check className="h-3.5 w-3.5" /> تم الحل
                          </PendingButton>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <Pagination pagination={query.data.pagination} onPageChange={setPage} isFetching={query.isFetching} />
          </>
        )}
      </section>
    </>
  );
}
