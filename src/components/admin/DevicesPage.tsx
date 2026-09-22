"use client";

import { Ban, MonitorSmartphone, ShieldAlert, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useAdminDevices, useSetAdminDeviceBlocked } from "@/lib/hooks/queries/admin/useAdminDevices";
import type { AdminDevice } from "@/types/admin.types";
import { AdminEmpty, AdminError, AdminSkeleton, ConfirmDialog, useToast } from "./AdminFeedback";
import { Badge, DataTable, Field, inputClass, PageTitle, Pagination, panelClass, PendingButton, Toggle } from "./AdminUI";
import { cx, formatDateTime, formatNumber, formatRelative, friendlyError, maskHash } from "./admin-utils";

export function DevicesPage() {
  const toast = useToast();
  const [blockedOnly, setBlockedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState<AdminDevice | null>(null);
  const [reason, setReason] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const query = useAdminDevices({ blockedOnly, page, pageSize: 12 });
  const mutation = useSetAdminDeviceBlocked();

  const apply = (device: AdminDevice, isBlocked: boolean, blockReason: string | null) => {
    setPendingId(device.id);
    mutation.mutate(
      { id: device.id, request: { isBlocked, reason: blockReason } },
      {
        onSuccess: () => {
          toast.success(isBlocked ? "تم حظر الجهاز" : "تم رفع الحظر");
          setTarget(null);
          setReason("");
        },
        onError: (error) => toast.error(friendlyError(error, "تعذّر تحديث حالة الجهاز.")),
        onSettled: () => setPendingId(null),
      },
    );
  };

  return (
    <>
      <PageTitle eyebrow="الأمان" title="الأجهزة" description="الأجهزة التي أنشأت طلبات في المتجر، مع عدد الطلبات الوهمية لكل جهاز وإمكانية حظره." />
      <section className={cx(panelClass, "overflow-hidden")}>
        <div className="flex flex-wrap items-center gap-4 border-b border-black/5 p-4">
          <Toggle checked={blockedOnly} onChange={(value) => { setBlockedOnly(value); setPage(1); }} label="المحظورة فقط" />
          {query.data && <span className="mr-auto inline-flex items-center gap-1 text-xs text-[#8b8178]"><MonitorSmartphone className="h-4 w-4" /> {formatNumber(query.data.pagination.totalItems)} جهاز</span>}
        </div>
        {query.isPending && <AdminSkeleton rows={8} className="rounded-none border-0 shadow-none" />}
        {query.isError && <div className="p-4"><AdminError onRetry={() => query.refetch()} isRetrying={query.isFetching} /></div>}
        {query.data && (
          <>
            <DataTable
              rows={query.data.items}
              rowKey={(device) => device.id}
              isFetching={query.isFetching && query.isPlaceholderData}
              minWidth="min-w-[820px]"
              emptyState={<AdminEmpty title={blockedOnly ? "لا توجد أجهزة محظورة" : "لا توجد أجهزة مسجلة"} />}
              columns={[
                {
                  key: "device",
                  label: "الجهاز",
                  render: (device) => (
                    <div className="flex items-center gap-3">
                      <span className={cx("flex h-10 w-10 items-center justify-center rounded-2xl", device.isBlocked ? "bg-red-50 text-red-600" : "bg-[#f3ebdf] text-[#8a5f33]")}>
                        {device.isBlocked ? <ShieldAlert className="h-4 w-4" /> : <MonitorSmartphone className="h-4 w-4" />}
                      </span>
                      <span>
                        <span dir="ltr" className="block font-mono text-sm font-bold">{device.maskedHash || maskHash(device.id)}</span>
                        <span className="block text-[11px] text-[#9a9086]">آخر طلب: {device.lastOrderAt ? formatRelative(device.lastOrderAt) : "—"}</span>
                      </span>
                    </div>
                  ),
                },
                { key: "orders", label: "الطلبات", render: (device) => `${formatNumber(device.totalOrders)} طلب` },
                {
                  key: "fake",
                  label: "وهمية",
                  render: (device) => (
                    <span className={cx("inline-flex min-w-8 items-center justify-center rounded-lg px-2 py-1 text-sm font-black", device.fakeOrderCount >= 3 ? "bg-red-50 text-red-700" : device.fakeOrderCount > 0 ? "bg-amber-50 text-amber-800" : "bg-[#f5f1ea] text-[#6f665d]")}>
                      {formatNumber(device.fakeOrderCount)}
                    </span>
                  ),
                },
                {
                  key: "status",
                  label: "الحالة",
                  render: (device) => (
                    <span>
                      <Badge tone={device.isBlocked ? "red" : "green"}>{device.isBlocked ? "محظور" : "نشط"}</Badge>
                      {device.isBlocked && <span className="mt-1 block text-[11px] text-[#9a9086]">{device.blockedReason ?? "بدون سبب"} • {device.blockedAt ? formatDateTime(device.blockedAt) : ""}</span>}
                    </span>
                  ),
                },
                {
                  key: "actions",
                  label: "",
                  className: "text-left",
                  render: (device) => (
                    <div className="flex justify-end">
                      <PendingButton
                        type="button"
                        isPending={pendingId === device.id}
                        disabled={mutation.isPending}
                        onClick={() => (device.isBlocked ? apply(device, false, null) : setTarget(device))}
                        className={cx("inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition disabled:opacity-50", device.isBlocked ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "bg-red-50 text-red-700 hover:bg-red-100")}
                      >
                        {device.isBlocked ? <><ShieldCheck className="h-3.5 w-3.5" /> رفع الحظر</> : <><Ban className="h-3.5 w-3.5" /> حظر</>}
                      </PendingButton>
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
        open={target !== null}
        onClose={() => !mutation.isPending && setTarget(null)}
        isPending={mutation.isPending}
        title="حظر الجهاز"
        description={target ? `لن يتمكن الجهاز ${target.maskedHash || maskHash(target.id)} من إنشاء طلبات جديدة.` : undefined}
        confirmLabel="حظر الجهاز"
        onConfirm={() => target && apply(target, true, reason.trim() || null)}
      >
        <Field label="سبب الحظر" hint="اختياري">
          <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} className={cx(inputClass, "resize-none")} placeholder="مثال: 3 طلبات وهمية متكررة" />
        </Field>
      </ConfirmDialog>
    </>
  );
}
