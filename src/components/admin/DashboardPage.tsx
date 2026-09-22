"use client";

import {
  ArrowUpLeft,
  Ban,
  BellRing,
  Boxes,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  HandCoins,
  PackageX,
  ShieldAlert,
  ShoppingBag,
  ShoppingCart,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { useAdminAnalyticsSummary } from "@/lib/hooks/queries/admin/useAdminAnalytics";
import { useAdminNotifications } from "@/lib/hooks/queries/admin/useAdminNotifications";
import type { AdminSalesByDay } from "@/types/admin.types";
import { AdminEmpty, AdminError, AdminSkeleton } from "./AdminFeedback";
import { Badge, PageTitle, panelClass, StatCard } from "./AdminUI";
import { adminRoutes, cx, formatMoney, formatNumber, formatRelative, formatWeekday, NOTIFICATION_TYPE_LABEL } from "./admin-utils";

// ---------------------------------------------------------------------------
// Pure SVG sales chart
// ---------------------------------------------------------------------------
function SalesChart({ data }: { data: AdminSalesByDay[] }) {
  const gradientId = useId();
  const [active, setActive] = useState<number | null>(null);
  const width = 720;
  const height = 240;
  const padX = 12;
  const padTop = 24;
  const padBottom = 30;
  const max = Math.max(1, ...data.map((day) => day.total));
  const innerW = width - padX * 2;
  const innerH = height - padTop - padBottom;
  const step = data.length > 1 ? innerW / (data.length - 1) : 0;

  const points = data.map((day, index) => ({
    x: padX + index * step,
    y: padTop + innerH - (day.total / max) * innerH,
    day,
  }));
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const area = `${path} L${(padX + innerW).toFixed(1)},${(padTop + innerH).toFixed(1)} L${padX},${(padTop + innerH).toFixed(1)} Z`;
  const gridLines = [0, 0.25, 0.5, 0.75, 1];
  const current = active !== null ? points[active] : null;

  if (!data.some((day) => day.total > 0)) {
    return <AdminEmpty compact title="لا توجد مبيعات في هذه الفترة" description="ستظهر المبيعات هنا فور تسجيل أول طلب." />;
  }

  return (
    <div className="relative" dir="ltr">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-64 w-full" role="img" aria-label="مخطط المبيعات اليومية خلال آخر 14 يومًا">
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#c7a478" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#c7a478" stopOpacity="0" />
          </linearGradient>
        </defs>
        {gridLines.map((ratio) => {
          const y = padTop + innerH - ratio * innerH;
          return (
            <g key={ratio}>
              <line x1={padX} x2={width - padX} y1={y} y2={y} stroke="#eee6da" strokeDasharray="3 5" />
              <text x={width - padX} y={y - 4} textAnchor="end" fontSize="9" fill="#a89c8d">{formatMoney(max * ratio)}</text>
            </g>
          );
        })}
        <path d={area} fill={`url(#${gradientId})`} />
        <path d={path} fill="none" stroke="#9b7043" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((point, index) => (
          <g key={point.day.date}>
            <rect
              x={point.x - step / 2}
              y={0}
              width={Math.max(step, 12)}
              height={height}
              fill="transparent"
              onMouseEnter={() => setActive(index)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(index)}
              onBlur={() => setActive(null)}
              tabIndex={0}
              aria-label={`${formatWeekday(point.day.date)} ${point.day.date}: ${formatMoney(point.day.total)} من ${formatNumber(point.day.count)} طلب`}
            />
            <circle cx={point.x} cy={point.y} r={active === index ? 6 : 3.5} fill={active === index ? "#17130f" : "#fff"} stroke="#9b7043" strokeWidth="2" className="transition-all" />
            <text x={point.x} y={height - 10} textAnchor="middle" fontSize="9" fill="#968b80">{formatWeekday(point.day.date)}</text>
          </g>
        ))}
        {current && (
          <line x1={current.x} x2={current.x} y1={padTop} y2={padTop + innerH} stroke="#17130f" strokeOpacity="0.2" strokeDasharray="2 4" />
        )}
      </svg>
      {current && (
        <div
          dir="rtl"
          className="pointer-events-none absolute -top-2 rounded-xl bg-[#17130f] px-3 py-2 text-[11px] text-white shadow-xl"
          style={{ left: `${(current.x / width) * 100}%`, transform: "translateX(-50%)" }}
        >
          <strong className="block">{formatMoney(current.day.total)}</strong>
          <span className="text-white/60">{formatNumber(current.day.count)} طلب • {current.day.date}</span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
function StatusDonut({ pending, confirmed, cancelled, fake }: { pending: number; confirmed: number; cancelled: number; fake: number }) {
  const total = pending + confirmed + cancelled + fake;
  const segments = [
    { label: "مؤكد", value: confirmed, color: "#17130f" },
    { label: "قيد الانتظار", value: pending, color: "#c7a478" },
    { label: "ملغي", value: cancelled, color: "#e4d5c0" },
    { label: "وهمي", value: fake, color: "#e05a4f" },
  ];
  let offset = 0;
  const gradient = segments
    .map((segment) => {
      const start = offset;
      const share = total ? (segment.value / total) * 100 : 0;
      offset += share;
      return `${segment.color} ${start}% ${offset}%`;
    })
    .join(", ");

  return (
    <>
      <div className="mx-auto mt-7 flex h-36 w-36 items-center justify-center rounded-full" style={{ background: total ? `conic-gradient(${gradient})` : "#eeeae4" }} role="img" aria-label={`إجمالي ${total} طلب`}>
        <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-white">
          <strong className="text-2xl">{formatNumber(total)}</strong>
          <span className="text-[10px] text-[#8a8076]">طلبًا</span>
        </div>
      </div>
      <ul className="mt-7 grid grid-cols-2 gap-3 text-xs">
        {segments.map((segment) => (
          <li key={segment.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: segment.color }} />
            <span className="text-[#786f66]">{segment.label}</span>
            <strong className="mr-auto">{formatNumber(segment.value)}</strong>
          </li>
        ))}
      </ul>
    </>
  );
}

// ---------------------------------------------------------------------------
export function DashboardPage() {
  const analytics = useAdminAnalyticsSummary();
  const notifications = useAdminNotifications({ unresolvedOnly: true, page: 1, pageSize: 5 });
  const summary = analytics.data;

  const cards = useMemo(() => {
    if (!summary) return [];
    return [
      { title: "مبيعات اليوم", value: formatMoney(summary.todaySales), note: `${formatNumber(summary.todayOrders)} طلب اليوم`, icon: <CircleDollarSign className="h-5 w-5" />, accent: true },
      { title: "إجمالي الطلبات", value: formatNumber(summary.ordersCount), note: `${formatNumber(summary.pendingCount)} قيد الانتظار`, icon: <ShoppingCart className="h-5 w-5" />, tone: "amber" as const },
      { title: "طلبات مؤكدة", value: formatNumber(summary.confirmedCount), note: `${formatNumber(summary.cancelledCount)} ملغية`, icon: <CheckCircle2 className="h-5 w-5" /> },
      { title: "طلبات وهمية", value: formatNumber(summary.fakeCount), note: "مستبعدة من المبيعات", icon: <Ban className="h-5 w-5" />, tone: "red" as const },
      { title: "إجمالي المبيعات", value: formatMoney(summary.totalSold), note: "الطلبات غير الملغية وغير الوهمية", icon: <Wallet className="h-5 w-5" /> },
      { title: "المحصّل", value: formatMoney(summary.totalCollected), note: "مبالغ تم تحصيلها", icon: <HandCoins className="h-5 w-5" /> },
      { title: "غير المحصّل", value: formatMoney(summary.totalUncollected), note: "بانتظار التحصيل", icon: <Clock3 className="h-5 w-5" />, tone: "amber" as const },
      { title: "المنتجات", value: formatNumber(summary.productsCount), note: `${formatNumber(summary.lowStockCount)} منخفض • ${formatNumber(summary.depletedCount)} نافد`, icon: <Boxes className="h-5 w-5" />, tone: summary.depletedCount ? ("red" as const) : summary.lowStockCount ? ("amber" as const) : undefined },
    ];
  }, [summary]);

  return (
    <>
      <PageTitle
        eyebrow="لوحة الأداء"
        title="نظرة عامة"
        description="ملخص حي لأداء المتجر والطلبات التي تحتاج انتباهك اليوم."
        action={
          <span className="inline-flex items-center gap-2 rounded-2xl border border-black/5 bg-white px-4 py-3 text-xs font-bold text-[#6e6359] shadow-sm">
            <CalendarDays className="h-4 w-4 text-[#a57b4b]" /> آخر 14 يومًا
          </span>
        }
      />

      {analytics.isPending && <AdminSkeleton variant="cards" rows={8} />}
      {analytics.isError && <AdminError onRetry={() => analytics.refetch()} isRetrying={analytics.isFetching} />}
      {summary && (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="مؤشرات الأداء">
            {cards.map((card) => <StatCard key={card.title} {...card} />)}
          </section>

          <section className="mt-5 grid gap-5 xl:grid-cols-[1.55fr_1fr]">
            <article className={cx(panelClass, "p-5 sm:p-6")}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold">المبيعات اليومية</p>
                  <p className="mt-1 text-xs text-[#8a8076]">إجمالي المبيعات خلال آخر 14 يومًا (بدون الطلبات الوهمية)</p>
                </div>
                <Badge tone="gold">{formatMoney(summary.salesByDay.reduce((sum, day) => sum + day.total, 0))}</Badge>
              </div>
              <div className="mt-6">
                <SalesChart data={summary.salesByDay} />
              </div>
            </article>

            <article className={cx(panelClass, "p-5 sm:p-6")}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold">حالة الطلبات</p>
                  <p className="mt-1 text-xs text-[#8a8076]">توزيع الطلبات حسب الحالة</p>
                </div>
                <ShoppingBag className="h-5 w-5 text-[#a77d4e]" />
              </div>
              <StatusDonut pending={summary.pendingCount} confirmed={summary.confirmedCount} cancelled={summary.cancelledCount} fake={summary.fakeCount} />
            </article>
          </section>

          <section className="mt-5 grid gap-5 xl:grid-cols-[1.55fr_1fr]">
            <article className={cx(panelClass, "overflow-hidden")}>
              <div className="flex items-center justify-between border-b border-black/5 p-5">
                <div>
                  <p className="font-bold">الأكثر مبيعًا</p>
                  <p className="mt-1 text-xs text-[#8a8076]">المنتجات الأعلى كمية مبيعة</p>
                </div>
                <Link href={adminRoutes.products} className="inline-flex items-center gap-1 text-xs font-bold text-[#987043] hover:underline">كل المنتجات <ArrowUpLeft className="h-4 w-4" /></Link>
              </div>
              {summary.topProducts.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-right text-sm">
                    <thead className="bg-[#faf7f1] text-xs text-[#756a5f]">
                      <tr>
                        <th scope="col" className="px-5 py-3 font-bold">#</th>
                        <th scope="col" className="px-5 py-3 font-bold">المنتج</th>
                        <th scope="col" className="px-5 py-3 font-bold">الكمية</th>
                        <th scope="col" className="px-5 py-3 font-bold">الإيراد</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5">
                      {summary.topProducts.map((product, index) => (
                        <tr key={product.productId} className="hover:bg-[#fcfaf6]">
                          <td className="px-5 py-3 font-display text-lg text-[#9c7549]">{String(index + 1).padStart(2, "0")}</td>
                          <td className="px-5 py-3">
                            <Link href={adminRoutes.productEdit(product.productId)} className="font-bold hover:underline">{product.title}</Link>
                          </td>
                          <td className="px-5 py-3">{formatNumber(product.quantity)} قطعة</td>
                          <td className="px-5 py-3 font-bold">{formatMoney(product.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <AdminEmpty compact title="لا توجد مبيعات بعد" />
              )}
            </article>

            <article className={cx(panelClass, "overflow-hidden")}>
              <div className="flex items-center justify-between border-b border-black/5 p-5">
                <div>
                  <p className="font-bold">إشعارات غير محلولة</p>
                  <p className="mt-1 text-xs text-[#8a8076]">تبقى ظاهرة حتى تُحل</p>
                </div>
                <Link href={adminRoutes.notifications} className="inline-flex items-center gap-1 text-xs font-bold text-[#987043] hover:underline">عرض الكل <ArrowUpLeft className="h-4 w-4" /></Link>
              </div>
              {notifications.isPending && <div className="p-5"><AdminSkeleton variant="lines" rows={5} /></div>}
              {notifications.isError && <div className="p-4"><AdminError compact onRetry={() => notifications.refetch()} isRetrying={notifications.isFetching} /></div>}
              {notifications.data && !notifications.data.items.length && <AdminEmpty compact title="كل شيء تحت السيطرة" description="لا توجد إشعارات تحتاج إلى معالجة." icon={<CheckCircle2 className="h-6 w-6" />} />}
              {notifications.data && notifications.data.items.length > 0 && (
                <ul className="divide-y divide-black/5">
                  {notifications.data.items.map((item) => {
                    const Icon = item.type === "Depleted" ? PackageX : item.type === "LowStock" ? TriangleAlert : BellRing;
                    const href = item.relatedOrderId ? adminRoutes.order(item.relatedOrderId) : item.relatedProductId ? adminRoutes.inventoryHistory(item.relatedProductId) : adminRoutes.notifications;
                    return (
                      <li key={item.id}>
                        <Link href={href} className="flex items-start gap-3 p-4 transition hover:bg-[#fcfaf6]">
                          <span className={cx("rounded-xl p-2.5", item.type === "Depleted" ? "bg-red-50 text-red-600" : item.type === "LowStock" ? "bg-amber-50 text-amber-700" : "bg-[#f0e7da] text-[#977044]")}>
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-bold">{item.title}</span>
                            <span className="mt-0.5 line-clamp-1 block text-xs text-[#8a8076]">{item.message}</span>
                            <span className="mt-1 block text-[10px] text-[#aaa097]">{NOTIFICATION_TYPE_LABEL[item.type]} • {formatRelative(item.createdAt)}</span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </article>
          </section>

          {(summary.fakeCount > 0 || summary.depletedCount > 0) && (
            <section className="mt-5 flex flex-wrap items-center gap-3 rounded-[1.75rem] border border-amber-100 bg-amber-50/60 px-5 py-4 text-xs font-bold text-amber-800">
              <ShieldAlert className="h-4 w-4" />
              {summary.fakeCount > 0 && <span>{formatNumber(summary.fakeCount)} طلب وهمي مسجل — راجع صفحة <Link href={adminRoutes.devices} className="underline">الأجهزة</Link>.</span>}
              {summary.depletedCount > 0 && <span>{formatNumber(summary.depletedCount)} منتج نفد مخزونه — راجع <Link href={adminRoutes.inventory} className="underline">المخزون</Link>.</span>}
            </section>
          )}
        </>
      )}
    </>
  );
}
