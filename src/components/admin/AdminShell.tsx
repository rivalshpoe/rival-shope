"use client";

import {
  Bell,
  Boxes,
  ChartNoAxesCombined,
  ChevronLeft,
  CirclePercent,
  ClipboardList,
  FolderTree,
  HandCoins,
  LogOut,
  MapPinned,
  Menu,
  MonitorSmartphone,
  PanelRightClose,
  PanelRightOpen,
  ScrollText,
  ShieldCheck,
  ShoppingBag,
  Star,
  Tags,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { logoutAdmin } from "@/lib/api/endpoints/adminAuth";
import { useUnresolvedNotifications } from "@/lib/hooks/queries/admin/useAdminNotifications";
import { useAdminAuthStore } from "@/lib/store/adminAuthStore";
import { Spinner, ToastProvider } from "./AdminFeedback";
import { ADMIN_LOGIN, adminRoutes, cx, formatNumber, formatRelative, NOTIFICATION_TYPE_LABEL } from "./admin-utils";

const NAV_GROUPS: Array<{ label: string; links: Array<{ href: string; label: string; icon: typeof Bell; exact?: boolean }> }> = [
  {
    label: "الرئيسية",
    links: [{ href: adminRoutes.home, label: "نظرة عامة", icon: ChartNoAxesCombined, exact: true }],
  },
  {
    label: "الكتالوج",
    links: [
      { href: adminRoutes.categories, label: "الأقسام", icon: FolderTree },
      { href: adminRoutes.brands, label: "الماركات", icon: Tags },
      { href: adminRoutes.products, label: "المنتجات", icon: ShoppingBag },
      { href: adminRoutes.inventory, label: "المخزون", icon: Boxes },
    ],
  },
  {
    label: "المبيعات",
    links: [
      { href: adminRoutes.orders, label: "الطلبات", icon: ClipboardList },
      { href: adminRoutes.collections, label: "التحصيل", icon: HandCoins },
      { href: adminRoutes.deliveryZones, label: "مناطق التوصيل", icon: MapPinned },
      { href: adminRoutes.discountCodes, label: "أكواد الخصم", icon: CirclePercent },
    ],
  },
  {
    label: "المحتوى والأمان",
    links: [
      { href: adminRoutes.reviews, label: "التقييمات", icon: Star },
      { href: adminRoutes.policies, label: "السياسات", icon: ScrollText },
      { href: adminRoutes.notifications, label: "الإشعارات", icon: Bell },
      { href: adminRoutes.devices, label: "الأجهزة", icon: MonitorSmartphone },
      { href: adminRoutes.auditLogs, label: "سجل العمليات", icon: ShieldCheck },
    ],
  },
];

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { data, isPending, isError } = useUnresolvedNotifications();
  const unresolved = data?.pagination.totalItems ?? 0;
  const preview = data?.items.slice(0, 4) ?? [];

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    const onClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={unresolved ? `الإشعارات، ${unresolved} غير محلولة` : "الإشعارات"}
        className="relative rounded-2xl border border-black/5 bg-white p-3 text-[#332b24] shadow-sm transition hover:border-[#c7a478]"
      >
        <Bell className="h-5 w-5" />
        {unresolved > 0 && (
          <span className="absolute -left-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#a36b3f] px-1 text-[10px] font-black text-white">
            {unresolved > 99 ? "99+" : formatNumber(unresolved)}
          </span>
        )}
      </button>
      {open && (
        <div role="dialog" aria-label="آخر الإشعارات" className="absolute left-0 top-14 z-40 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-3xl border border-black/5 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-black/5 px-5 py-4">
            <strong className="text-sm">إشعارات غير محلولة</strong>
            <Link href={adminRoutes.notifications} onClick={() => setOpen(false)} className="text-xs font-bold text-[#996f41] hover:underline">عرض الكل</Link>
          </div>
          <div className="divide-y divide-black/5">
            {isPending && <div className="flex justify-center p-6"><Spinner /></div>}
            {isError && <p className="p-5 text-center text-xs text-red-700">تعذّر تحميل الإشعارات.</p>}
            {!isPending && !isError && !preview.length && <p className="p-6 text-center text-xs text-[#8b8178]">لا توجد إشعارات جديدة 🎉</p>}
            {preview.map((item) => (
              <Link
                key={item.id}
                href={item.relatedOrderId ? adminRoutes.order(item.relatedOrderId) : item.relatedProductId ? adminRoutes.inventoryHistory(item.relatedProductId) : adminRoutes.notifications}
                onClick={() => setOpen(false)}
                className="relative block p-4 pr-7 transition hover:bg-[#fcfaf6]"
              >
                <span className={cx("absolute right-3 top-5 h-2 w-2 rounded-full", item.type === "Depleted" ? "bg-red-500" : item.type === "LowStock" ? "bg-amber-500" : "bg-[#b88952]")} />
                <p className="text-sm font-bold text-[#211b16]">{item.title}</p>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#7d746b]">{item.message}</p>
                <p className="mt-2 text-[10px] text-[#aaa097]">{NOTIFICATION_TYPE_LABEL[item.type]} • {formatRelative(item.createdAt)}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const clearSession = useAdminAuthStore((state) => state.clearSession);
  const email = useAdminAuthStore((state) => state.email);

  // Close the mobile drawer on navigation (state adjusted during render, no effect needed).
  const [lastPathname, setLastPathname] = useState(pathname);
  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    setMobileOpen(false);
  }

  const logout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logoutAdmin();
    } catch {
      // Session is cleared locally regardless of server response.
    } finally {
      clearSession(); // also clears the routing cookie
      router.push(ADMIN_LOGIN);
      router.refresh();
    }
  };

  const sidebar = (
    <div className="flex h-full flex-col bg-[#151310] text-white">
      <div className="flex h-24 items-center justify-between border-b border-white/10 px-5">
        <Link href={adminRoutes.home} className={cx("min-w-0", collapsed && "lg:hidden")}>
          <span className="block font-display text-2xl tracking-[0.18em]">RIVAL</span>
          <span className="mt-1 block text-[9px] tracking-[0.28em] text-[#cdb38e]">إدارة المتجر</span>
        </Link>
        <button type="button" className="hidden rounded-xl p-2 text-white/60 hover:bg-white/10 hover:text-white lg:block" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? "توسيع القائمة" : "طي القائمة"} aria-expanded={!collapsed}>
          {collapsed ? <PanelRightOpen className="h-5 w-5" /> : <PanelRightClose className="h-5 w-5" />}
        </button>
        <button type="button" className="rounded-xl p-2 text-white/60 hover:bg-white/10 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="إغلاق القائمة"><X className="h-5 w-5" /></button>
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto p-3" aria-label="القائمة الرئيسية">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            {!collapsed && <p className="px-3 pb-1 pt-2 text-[10px] font-bold tracking-[0.2em] text-white/35">{group.label}</p>}
            {collapsed && <div className="mx-3 my-2 hidden h-px bg-white/10 lg:block" />}
            <div className="space-y-0.5">
              {group.links.map((item) => {
                const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    title={collapsed ? item.label : undefined}
                    className={cx(
                      "group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition",
                      active ? "bg-[#c7a478] font-bold text-[#17130f]" : "text-white/65 hover:bg-white/5 hover:text-white",
                      collapsed && "lg:justify-center",
                    )}
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" />
                    <span className={collapsed ? "lg:hidden" : ""}>{item.label}</span>
                    {active && !collapsed && <ChevronLeft className="mr-auto h-4 w-4" />}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-white/10 p-3">
        <button
          type="button"
          onClick={logout}
          disabled={loggingOut}
          className={cx("flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm text-white/55 transition hover:bg-red-500/10 hover:text-red-300 disabled:opacity-60", collapsed && "lg:justify-center")}
        >
          {loggingOut ? <Spinner /> : <LogOut className="h-[18px] w-[18px]" />}
          <span className={collapsed ? "lg:hidden" : ""}>تسجيل الخروج</span>
        </button>
      </div>
    </div>
  );

  return (
    <ToastProvider>
      <div dir="rtl" className="min-h-screen bg-[#f6f2eb] text-[#17130f]">
        {mobileOpen && <button type="button" aria-label="إغلاق القائمة" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-40 bg-black/45 backdrop-blur-sm lg:hidden" />}
        <aside className={cx("fixed inset-y-0 right-0 z-50 w-72 transform transition-all duration-300 lg:translate-x-0", mobileOpen ? "translate-x-0" : "translate-x-full", collapsed ? "lg:w-[5.25rem]" : "lg:w-72")}>
          {sidebar}
        </aside>
        <div className={cx("transition-[margin] duration-300", collapsed ? "lg:mr-[5.25rem]" : "lg:mr-72")}>
          <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-black/5 bg-[#f6f2eb]/90 px-4 backdrop-blur-xl sm:px-7">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setMobileOpen(true)} className="rounded-2xl border border-black/5 bg-white p-3 shadow-sm lg:hidden" aria-label="فتح القائمة"><Menu className="h-5 w-5" /></button>
              <div>
                <p className="text-xs text-[#8b8075]">مرحبًا بعودتك</p>
                <p className="text-sm font-bold">إدارة Rival</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <NotificationBell />
              <div className="hidden items-center gap-3 rounded-2xl bg-white py-2 pl-4 pr-2 shadow-sm sm:flex">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#17130f] text-xs font-black text-[#dfc29a]">RA</span>
                <span className="min-w-0">
                  <span className="block text-xs font-bold">مسؤول المتجر</span>
                  <span dir="ltr" className="block max-w-[10rem] truncate text-right text-[10px] text-[#91867c]">{email ?? "Admin"}</span>
                </span>
              </div>
            </div>
          </header>
          <main className="min-h-[calc(100vh-5rem)] p-4 sm:p-7 lg:p-8">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
