"use client";

import { CheckCircle2, ClipboardPaste, HandCoins, SearchX, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type KeyboardEvent } from "react";
import { useCollectAdminOrders, useCollectedAdminOrders } from "@/lib/hooks/queries/admin/useAdminOrders";
import type { AdminCollectOrdersResponse } from "@/types/admin.types";
import { AdminEmpty, AdminError, AdminSkeleton, useToast } from "./AdminFeedback";
import { Badge, DataTable, inputClass, PageTitle, Pagination, panelClass, PendingButton } from "./AdminUI";
import { adminRoutes, cx, formatDateTime, formatMoney, formatNumber, friendlyError, ORDER_STATUS_LABEL, ORDER_STATUS_TONE } from "./admin-utils";

const SEPARATOR = /[\s,،;]+/;

export function CollectionsPage() {
  const toast = useToast();
  const [draft, setDraft] = useState("");
  const [chips, setChips] = useState<string[]>([]);
  const [result, setResult] = useState<AdminCollectOrdersResponse | null>(null);
  const [page, setPage] = useState(1);
  const collect = useCollectAdminOrders();
  const collected = useCollectedAdminOrders({ page, pageSize: 10 });

  const addFromDraft = (text: string) => {
    const tokens = text.split(SEPARATOR).map((token) => token.trim().toUpperCase()).filter(Boolean);
    if (!tokens.length) return;
    setChips((current) => Array.from(new Set([...current, ...tokens])));
    setDraft("");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      addFromDraft(draft);
    }
    if (event.key === "Backspace" && !draft && chips.length) setChips((current) => current.slice(0, -1));
  };

  const pending = useMemo(() => Array.from(new Set([...chips, ...draft.split(SEPARATOR).map((t) => t.trim().toUpperCase()).filter(Boolean)])), [chips, draft]);

  const submit = () => {
    if (!pending.length || collect.isPending) return;
    collect.mutate(
      { invoiceNumbers: pending },
      {
        onSuccess: (response) => {
          setResult(response);
          setChips([]);
          setDraft("");
          setPage(1);
          toast.success(response.collectedCount ? `تم تحصيل ${formatNumber(response.collectedCount)} فاتورة` : "لم يتم تحصيل أي فاتورة جديدة");
        },
        onError: (error) => toast.error(friendlyError(error, "تعذّر تسجيل التحصيل. حاول مجددًا.")),
      },
    );
  };

  return (
    <>
      <PageTitle eyebrow="المبيعات" title="تحصيل الفواتير" description="الصق أرقام الفواتير التي تم تحصيل مبالغها من شركة التوصيل ليتم تحديثها دفعة واحدة." />

      <div className="grid gap-5 xl:grid-cols-[1fr_1.4fr]">
        <section className={cx(panelClass, "h-fit p-6")}>
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f2eadf] text-[#9c7447]"><ClipboardPaste className="h-5 w-5" /></span>
          <h2 className="mt-5 font-black">أرقام الفواتير</h2>
          <p className="mt-1 text-xs leading-5 text-[#8b8178]">افصل بين الأرقام بمسافة أو فاصلة أو سطر جديد. اضغط Enter لتحويل النص إلى عناصر.</p>
          <div className={cx(inputClass, "mt-5 flex min-h-36 flex-wrap content-start gap-2 p-3 focus-within:border-[#b68a55] focus-within:ring-4 focus-within:ring-[#c7a478]/10")} onClick={(event) => (event.currentTarget.querySelector("textarea") as HTMLTextAreaElement | null)?.focus()}>
            {chips.map((chip) => (
              <span key={chip} dir="ltr" className="inline-flex items-center gap-1 rounded-lg bg-[#17130f] px-2.5 py-1 font-mono text-xs font-bold text-white">
                {chip}
                <button type="button" onClick={() => setChips((current) => current.filter((candidate) => candidate !== chip))} aria-label={`إزالة ${chip}`} className="rounded p-0.5 text-white/60 hover:bg-white/10 hover:text-white"><X className="h-3 w-3" /></button>
              </span>
            ))}
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={onKeyDown}
              onBlur={() => addFromDraft(draft)}
              onPaste={(event) => {
                event.preventDefault();
                addFromDraft(`${draft} ${event.clipboardData.getData("text")}`);
              }}
              rows={chips.length ? 1 : 4}
              dir="ltr"
              className="min-w-[10rem] flex-1 resize-none bg-transparent font-mono text-sm outline-none placeholder:text-right placeholder:font-sans"
              placeholder={chips.length ? "" : "RIV-260921-001\nRIV-260920-014"}
              aria-label="أرقام الفواتير"
            />
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-[#8b8178]">
            <span>{formatNumber(pending.length)} فاتورة جاهزة</span>
            {pending.length > 0 && <button type="button" onClick={() => { setChips([]); setDraft(""); }} className="font-bold text-[#8c6338] hover:underline">مسح الكل</button>}
          </div>
          <PendingButton type="button" onClick={submit} isPending={collect.isPending} disabled={!pending.length} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#141210] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#2b251f] disabled:cursor-not-allowed disabled:opacity-50">
            <HandCoins className="h-4 w-4" /> تسجيل التحصيل
          </PendingButton>

          {result && (
            <div className="mt-6 space-y-3" role="status" aria-live="polite">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-emerald-50 p-4 text-emerald-800">
                  <p className="text-xs">فواتير محصّلة</p>
                  <p className="mt-1 text-2xl font-black">{formatNumber(result.collectedCount)}</p>
                </div>
                <div className="rounded-2xl bg-[#f5eee4] p-4 text-[#6f5a43]">
                  <p className="text-xs">المبلغ المحصّل</p>
                  <p className="mt-1 text-2xl font-black">{formatMoney(result.collectedAmount)}</p>
                </div>
              </div>
              {result.notFound.length > 0 ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
                  <p className="flex items-center gap-2 font-bold"><SearchX className="h-4 w-4" /> {formatNumber(result.notFound.length)} فاتورة غير موجودة أو غير قابلة للتحصيل:</p>
                  <ul className="mt-2 flex flex-wrap gap-1.5" dir="ltr">
                    {result.notFound.map((invoice) => <li key={invoice} className="rounded-md bg-white px-2 py-0.5 font-mono font-bold">{invoice}</li>)}
                  </ul>
                </div>
              ) : (
                <p className="flex items-center gap-2 text-xs font-bold text-emerald-700"><CheckCircle2 className="h-4 w-4" /> جميع الفواتير تم العثور عليها.</p>
              )}
            </div>
          )}
        </section>

        <section className={cx(panelClass, "overflow-hidden")}>
          <div className="border-b border-black/5 p-5">
            <h2 className="font-bold">الفواتير المحصّلة</h2>
            <p className="mt-1 text-xs text-[#8b8178]">آخر الطلبات التي تم تحصيل مبالغها</p>
          </div>
          {collected.isPending && <AdminSkeleton rows={6} className="rounded-none border-0 shadow-none" />}
          {collected.isError && <div className="p-4"><AdminError onRetry={() => collected.refetch()} isRetrying={collected.isFetching} /></div>}
          {collected.data && (
            <>
              <DataTable
                rows={collected.data.items}
                rowKey={(item) => item.id}
                isFetching={collected.isFetching && collected.isPlaceholderData}
                minWidth="min-w-[620px]"
                emptyState={<AdminEmpty title="لا توجد فواتير محصّلة بعد" />}
                columns={[
                  { key: "invoice", label: "الفاتورة", render: (item) => <Link href={adminRoutes.order(item.id)} dir="ltr" className="font-black text-[#8e663a] hover:underline">{item.invoiceNumber}</Link> },
                  { key: "customer", label: "العميل", render: (item) => item.customerName },
                  { key: "date", label: "تاريخ الطلب", render: (item) => <span className="text-xs text-[#6f665d]">{formatDateTime(item.createdAt)}</span> },
                  { key: "status", label: "الحالة", render: (item) => <Badge tone={ORDER_STATUS_TONE[item.status]}>{ORDER_STATUS_LABEL[item.status]}</Badge> },
                  { key: "total", label: "المبلغ", render: (item) => <strong>{formatMoney(item.total)}</strong> },
                ]}
              />
              <Pagination pagination={collected.data.pagination} onPageChange={setPage} isFetching={collected.isFetching} />
            </>
          )}
        </section>
      </div>
    </>
  );
}
