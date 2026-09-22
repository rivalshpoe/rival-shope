"use client";

import { Ban, Check, ChevronLeft, ExternalLink, LockKeyhole, MapPin, MessageCircle, MonitorSmartphone, PackageCheck, Printer, ShieldAlert, ShieldCheck, Truck, UserRound } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useSetAdminDeviceBlocked } from "@/lib/hooks/queries/admin/useAdminDevices";
import { useAdminOrder, useUpdateAdminOrderStatus } from "@/lib/hooks/queries/admin/useAdminOrders";
import type { AdminOrderDetails, AdminOrderStatusUpdate } from "@/types/admin.types";
import { AdminError, AdminSkeleton, ConfirmDialog, useToast } from "./AdminFeedback";
import { AdminImage, Badge, Field, inputClass, PageTitle, panelClass, PendingButton, secondaryButtonClass } from "./AdminUI";
import { adminRoutes, buildWhatsAppLink, cx, formatDateTime, formatMoney, formatNumber, friendlyError, isLockedError, ORDER_STATUS_LABEL, ORDER_STATUS_TONE } from "./admin-utils";

const ACTIONS: Array<{ status: AdminOrderStatusUpdate; label: string; icon: typeof Check; className: string; confirm: boolean }> = [
  { status: "Confirmed", label: "تأكيد", icon: Check, className: "bg-emerald-600 hover:bg-emerald-700 text-white", confirm: false },
  { status: "Cancelled", label: "إلغاء", icon: Ban, className: "border border-black/10 bg-white text-[#211c17] hover:bg-[#faf7f1]", confirm: true },
  { status: "Fake", label: "وهمي", icon: ShieldAlert, className: "bg-red-600 hover:bg-red-700 text-white", confirm: true },
];

function StatusPanel({ order }: { order: AdminOrderDetails }) {
  const toast = useToast();
  const mutation = useUpdateAdminOrderStatus(order.id);
  const [pendingStatus, setPendingStatus] = useState<AdminOrderStatusUpdate | null>(null);
  const [confirming, setConfirming] = useState<AdminOrderStatusUpdate | null>(null);
  const [locked, setLocked] = useState(false);

  const run = (status: AdminOrderStatusUpdate) => {
    if (mutation.isPending) return;
    setPendingStatus(status);
    mutation.mutate(
      { status },
      {
        onSuccess: () => {
          toast.success(`تم تحديث حالة الطلب إلى «${ORDER_STATUS_LABEL[status]}»`);
          setConfirming(null);
        },
        onError: (error) => {
          if (isLockedError(error)) setLocked(true);
          toast.error(friendlyError(error, "تعذّر تحديث حالة الطلب."));
        },
        onSettled: () => setPendingStatus(null),
      },
    );
  };

  const canEdit = order.canEdit && !locked;

  return (
    <section className={cx(panelClass, "p-5")}>
      <div className="flex items-center justify-between">
        <h2 className="font-bold">حالة الطلب</h2>
        <Badge tone={ORDER_STATUS_TONE[order.status]}>{ORDER_STATUS_LABEL[order.status]}</Badge>
      </div>
      {canEdit ? (
        <>
          <p className="mt-2 text-xs text-[#8b8178]">يمكن تعديل الحالة حتى {formatDateTime(order.editableUntil)}.</p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {ACTIONS.map((action) => {
              const Icon = action.icon;
              const isCurrent = order.status === action.status;
              return (
                <PendingButton
                  key={action.status}
                  type="button"
                  isPending={pendingStatus === action.status}
                  disabled={mutation.isPending || isCurrent}
                  onClick={() => (action.confirm ? setConfirming(action.status) : run(action.status))}
                  aria-label={`تغيير الحالة إلى ${action.label}`}
                  className={cx("inline-flex items-center justify-center gap-1.5 rounded-2xl px-3 py-3 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50", action.className)}
                >
                  {pendingStatus !== action.status && <Icon className="h-4 w-4" />}
                  {action.label}
                </PendingButton>
              );
            })}
          </div>
        </>
      ) : (
        <div role="status" className="mt-4 flex items-start gap-3 rounded-2xl bg-[#f5eee4] p-4 text-xs leading-5 text-[#6f5a43]">
          <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />
          <span>هذه الفاتورة مقفلة — انتهت مهلة التعديل (30 يومًا) بتاريخ {formatDateTime(order.editableUntil)}. لا يمكن تغيير حالتها.</span>
        </div>
      )}

      <ConfirmDialog
        open={confirming !== null}
        onClose={() => !mutation.isPending && setConfirming(null)}
        isPending={mutation.isPending}
        tone={confirming === "Fake" ? "danger" : "warning"}
        title={confirming === "Fake" ? "تحديد الطلب كوهمي" : "إلغاء الطلب"}
        description={
          confirming === "Fake"
            ? "سيُستبعد الطلب من المبيعات ويُسجَّل على جهاز العميل كطلب وهمي. قد يؤدي تكراره إلى حظر الجهاز."
            : "سيتم إلغاء الطلب وإشعار الفريق. يمكنك التراجع خلال مهلة التعديل."
        }
        confirmLabel={confirming === "Fake" ? "تحديد كوهمي" : "إلغاء الطلب"}
        onConfirm={() => confirming && run(confirming)}
      />
    </section>
  );
}

function DevicePanel({ order }: { order: AdminOrderDetails }) {
  const toast = useToast();
  const mutation = useSetAdminDeviceBlocked();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const { device } = order;

  const toggle = () => {
    mutation.mutate(
      { id: device.id, request: { isBlocked: !device.isBlocked, reason: device.isBlocked ? null : reason.trim() || null } },
      {
        onSuccess: (updated) => {
          toast.success(updated.isBlocked ? "تم حظر الجهاز" : "تم رفع الحظر عن الجهاز");
          setOpen(false);
          setReason("");
        },
        onError: (error) => toast.error(friendlyError(error, "تعذّر تحديث حالة الجهاز.")),
      },
    );
  };

  return (
    <section className={cx(panelClass, "p-5")}>
      <div className="flex items-center gap-3">
        <span className={cx("rounded-2xl p-3", device.isBlocked ? "bg-red-50 text-red-600" : "bg-[#f1e9dd] text-[#987044]")}>
          {device.isBlocked ? <ShieldAlert className="h-5 w-5" /> : <MonitorSmartphone className="h-5 w-5" />}
        </span>
        <div>
          <h2 className="font-bold">جهاز العميل</h2>
          <p dir="ltr" className="text-right text-xs text-[#8b8178]">{device.id}</p>
        </div>
        <Badge tone={device.isBlocked ? "red" : "green"} className="mr-auto">{device.isBlocked ? "محظور" : "نشط"}</Badge>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl bg-[#faf7f1] p-3">
          <dt className="text-xs text-[#8b8178]">طلبات وهمية</dt>
          <dd className={cx("mt-1 text-xl font-black", device.fakeOrderCount > 0 && "text-red-600")}>{formatNumber(device.fakeOrderCount)}</dd>
        </div>
        <div className="rounded-2xl bg-[#faf7f1] p-3">
          <dt className="text-xs text-[#8b8178]">الحالة</dt>
          <dd className="mt-1 text-sm font-bold">{device.isBlocked ? "لا يمكنه الطلب" : "يمكنه الطلب"}</dd>
        </div>
      </dl>
      <PendingButton
        type="button"
        isPending={mutation.isPending}
        onClick={() => (device.isBlocked ? toggle() : setOpen(true))}
        className={cx("mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold transition disabled:opacity-50", device.isBlocked ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "bg-red-50 text-red-700 hover:bg-red-100")}
      >
        {device.isBlocked ? <><ShieldCheck className="h-4 w-4" /> رفع الحظر</> : <><Ban className="h-4 w-4" /> حظر الجهاز</>}
      </PendingButton>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        isPending={mutation.isPending}
        title="حظر الجهاز"
        description="لن يتمكن هذا الجهاز من إنشاء طلبات جديدة حتى رفع الحظر."
        confirmLabel="حظر"
        onConfirm={toggle}
      >
        <Field label="سبب الحظر" hint="اختياري — يظهر في سجل الأجهزة">
          <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} className={cx(inputClass, "resize-none")} placeholder="مثال: طلبات وهمية متكررة" />
        </Field>
      </ConfirmDialog>
    </section>
  );
}

export function OrderDetailPage({ orderId }: { orderId: string }) {
  const query = useAdminOrder(orderId);
  const order = query.data;

  return (
    <>
      <PageTitle
        eyebrow="تفاصيل الطلب"
        title={order ? `الطلب ${order.invoiceNumber}` : "تفاصيل الطلب"}
        description={order ? `أُنشئ في ${formatDateTime(order.createdAt)}` : undefined}
        action={
          <>
            <button type="button" onClick={() => window.print()} className={secondaryButtonClass}><Printer className="h-4 w-4" /> طباعة</button>
            <Link href={adminRoutes.orders} className={secondaryButtonClass}>العودة <ChevronLeft className="h-4 w-4" /></Link>
          </>
        }
      />
      {query.isPending && <AdminSkeleton variant="detail" rows={3} />}
      {query.isError && <AdminError message={friendlyError(query.error, "تعذّر تحميل الطلب.")} onRetry={() => query.refetch()} isRetrying={query.isFetching} />}
      {order && (
        <div className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
          <div className="space-y-5">
            <section className={cx(panelClass, "overflow-hidden")}>
              <div className="flex items-center justify-between border-b border-black/5 p-5">
                <h2 className="font-bold">محتويات الطلب</h2>
                <span className="text-xs text-[#8b8178]">{formatNumber(order.items.reduce((sum, item) => sum + item.quantity, 0))} قطعة</span>
              </div>
              <ul className="divide-y divide-black/5">
                {order.items.map((item, index) => (
                  <li key={`${item.productId}-${index}`} className="flex items-center gap-4 p-5">
                    <Link href={adminRoutes.storefrontProduct(item.productId)} target="_blank" rel="noreferrer" aria-label={`عرض ${item.productTitle} في المتجر`} className="shrink-0 overflow-hidden rounded-2xl ring-1 ring-black/5 transition hover:ring-[#c7a478]">
                      <AdminImage src={item.productImageUrl} alt={item.productTitle} size={128} className="h-16 w-16" />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link href={adminRoutes.storefrontProduct(item.productId)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-bold hover:underline">
                        {item.productTitle} <ExternalLink className="h-3 w-3 text-[#a08a70]" />
                      </Link>
                      <p className="mt-1 flex flex-wrap gap-2 text-xs text-[#8d8379]">
                        {item.sizeLabel && <span className="rounded-md bg-[#f3ebdf] px-2 py-0.5 font-bold text-[#8a5f33]">مقاس {item.sizeLabel}</span>}
                        {item.colorName && <span className="rounded-md bg-[#f3ebdf] px-2 py-0.5 font-bold text-[#8a5f33]">لون {item.colorName}</span>}
                        <span>{formatNumber(item.quantity)} × {formatMoney(item.unitPrice)}</span>
                      </p>
                    </div>
                    <strong className="shrink-0">{formatMoney(item.lineTotal)}</strong>
                  </li>
                ))}
              </ul>
              <dl className="space-y-2 border-t border-black/5 bg-[#fcfaf6] p-5 text-sm">
                <div className="flex justify-between text-[#7c7268]"><dt>المجموع الفرعي</dt><dd>{formatMoney(order.subtotal)}</dd></div>
                {order.discountAmount > 0 && <div className="flex justify-between text-emerald-700"><dt>الخصم {order.discountCode && <span dir="ltr" className="font-mono text-xs">({order.discountCode})</span>}</dt><dd>-{formatMoney(order.discountAmount)}</dd></div>}
                <div className="flex justify-between text-[#7c7268]"><dt>التوصيل{order.deliveryZoneName && ` — ${order.deliveryZoneName}`}</dt><dd>{order.deliveryFee ? formatMoney(order.deliveryFee) : "مجانًا"}</dd></div>
                <div className="flex justify-between border-t border-black/5 pt-3 text-base font-black"><dt>الإجمالي</dt><dd>{formatMoney(order.total)}</dd></div>
              </dl>
            </section>

            <section className={cx(panelClass, "p-5")}>
              <h2 className="font-bold">التحصيل</h2>
              <div className={cx("mt-3 flex items-center gap-3 rounded-2xl p-4 text-sm", order.isCollected ? "bg-emerald-50 text-emerald-800" : "bg-[#f5eee4] text-[#6f5a43]")}>
                <PackageCheck className="h-5 w-5 shrink-0" />
                {order.isCollected ? <span>تم تحصيل المبلغ بتاريخ {formatDateTime(order.collectedAt)}.</span> : <span>لم يُحصَّل المبلغ بعد — الدفع عند الاستلام. استخدم <Link href={adminRoutes.collections} className="font-bold underline">صفحة التحصيل</Link> بعد الاستلام.</span>}
              </div>
            </section>
          </div>

          <div className="space-y-5">
            <StatusPanel order={order} />

            <section className={cx(panelClass, "p-5")}>
              <h2 className="font-bold">بيانات العميل</h2>
              <div className="mt-5 space-y-4 text-sm">
                <p className="flex items-center gap-3"><UserRound className="h-4 w-4 shrink-0 text-[#9d754a]" /> {order.customerName}</p>
                <p className="flex items-center gap-3">
                  <MessageCircle className="h-4 w-4 shrink-0 text-[#25D366]" />
                  <a href={buildWhatsAppLink(order)} target="_blank" rel="noreferrer" dir="ltr" className="font-bold text-[#0f7a45] underline decoration-dotted underline-offset-4 hover:decoration-solid" aria-label="مراسلة العميل عبر واتساب برسالة مُعدّة مسبقًا">
                    +{order.whatsAppNumber}
                  </a>
                </p>
                <p className="flex items-start gap-3">
                  {order.needsDelivery ? <Truck className="mt-0.5 h-4 w-4 shrink-0 text-[#9d754a]" /> : <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#9d754a]" />}
                  <span>{order.needsDelivery ? <>{order.deliveryZoneName ?? "توصيل"}{order.address && <span className="block text-xs text-[#8b8178]">{order.address}</span>}</> : "استلام من المتجر (بدون توصيل)"}</span>
                </p>
              </div>
              <a href={buildWhatsAppLink(order)} target="_blank" rel="noreferrer" className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#1fb95a]">
                <MessageCircle className="h-4 w-4" /> فتح واتساب برسالة الطلب
              </a>
            </section>

            <DevicePanel order={order} />
          </div>
        </div>
      )}
    </>
  );
}
