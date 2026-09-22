"use client";

import { Eye, PencilLine, RotateCcw, Save, ScrollText } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { useAdminPolicies, useUpdateAdminPolicy } from "@/lib/hooks/queries/admin/useAdminPolicies";
import type { AdminPolicy } from "@/types/admin.types";
import { AdminError, AdminSkeleton, useToast } from "./AdminFeedback";
import { Field, inputClass, PageTitle, panelClass, PendingButton, secondaryButtonClass, Tabs } from "./AdminUI";
import { cx, formatDateTime, friendlyError, POLICY_LABEL } from "./admin-utils";

/** Minimal, safe renderer for the policy markdown subset (## headings, paragraphs, - lists). */
function PolicyPreview({ content }: { content: string }) {
  const blocks = useMemo(() => {
    const lines = content.replace(/\r\n/g, "\n").split("\n");
    const output: Array<{ type: "h2" | "p" | "ul"; text?: string; items?: string[] }> = [];
    let list: string[] | null = null;
    let paragraph: string[] = [];
    const flushParagraph = () => {
      if (paragraph.length) output.push({ type: "p", text: paragraph.join(" ") });
      paragraph = [];
    };
    const flushList = () => {
      if (list?.length) output.push({ type: "ul", items: list });
      list = null;
    };
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) {
        flushParagraph();
        flushList();
        continue;
      }
      if (line.startsWith("#")) {
        flushParagraph();
        flushList();
        output.push({ type: "h2", text: line.replace(/^#+\s*/, "") });
      } else if (/^[-*•]\s+/.test(line)) {
        flushParagraph();
        list = [...(list ?? []), line.replace(/^[-*•]\s+/, "")];
      } else {
        flushList();
        paragraph.push(line);
      }
    }
    flushParagraph();
    flushList();
    return output;
  }, [content]);

  if (!blocks.length) return <p className="text-sm text-[#a39a90]">ابدأ بالكتابة لعرض المعاينة...</p>;
  return (
    <div className="space-y-4 text-sm leading-7 text-[#3d352e]">
      {blocks.map((block, index) => {
        if (block.type === "h2") return <h3 key={index} className="pt-2 font-black text-[#17130f]">{block.text}</h3>;
        if (block.type === "ul") return <ul key={index} className="list-disc space-y-1 pr-5">{block.items?.map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}</ul>;
        return <p key={index}>{block.text}</p>;
      })}
    </div>
  );
}

function PolicyEditor({ policy }: { policy: AdminPolicy }) {
  const toast = useToast();
  const update = useUpdateAdminPolicy();
  const [title, setTitle] = useState(policy.title);
  const [content, setContent] = useState(policy.content);
  const [error, setError] = useState("");
  const dirty = title !== policy.title || content !== policy.content;
  const titleError = title.trim().length < 3 ? "العنوان يجب أن يتكون من 3 أحرف على الأقل" : "";
  const contentError = content.trim().length < 20 ? "المحتوى قصير جدًا (20 حرفًا على الأقل)" : "";

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (titleError || contentError) {
      setError(titleError || contentError);
      return;
    }
    setError("");
    update.mutate(
      { key: policy.key, input: { title: title.trim(), content: content.trim() } },
      {
        onSuccess: () => toast.success(`تم حفظ «${POLICY_LABEL[policy.key]}»`),
        onError: (mutationError) => setError(friendlyError(mutationError, "تعذّر حفظ السياسة.")),
      },
    );
  };

  return (
    <form onSubmit={submit} noValidate className="grid gap-5 xl:grid-cols-2">
      <section className={cx(panelClass, "p-5 sm:p-6")}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-bold"><PencilLine className="h-4 w-4 text-[#9b7246]" /> التحرير</h2>
          <span className="text-[11px] text-[#9a9086]">آخر تحديث: {formatDateTime(policy.updatedAt)}</span>
        </div>
        <div className="space-y-4">
          <Field label="عنوان السياسة" required error={error && titleError ? titleError : undefined}>
            <input value={title} onChange={(event) => setTitle(event.target.value)} className={inputClass} maxLength={120} />
          </Field>
          <Field label="المحتوى" required hint="يدعم العناوين بـ ## والقوائم بـ -" error={error && contentError ? contentError : undefined}>
            <textarea value={content} onChange={(event) => setContent(event.target.value)} rows={18} dir="rtl" className={cx(inputClass, "resize-y font-sans leading-7")} />
          </Field>
          {error && !titleError && !contentError && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700">{error}</p>}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-[#9a9086]">{content.trim().length} حرفًا</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => { setTitle(policy.title); setContent(policy.content); setError(""); }} disabled={!dirty || update.isPending} className={secondaryButtonClass}><RotateCcw className="h-4 w-4" /> تراجع</button>
              <PendingButton type="submit" isPending={update.isPending} disabled={!dirty}><Save className="h-4 w-4" /> حفظ السياسة</PendingButton>
            </div>
          </div>
        </div>
      </section>
      <section className={cx(panelClass, "p-5 sm:p-6")}>
        <h2 className="mb-5 flex items-center gap-2 font-bold"><Eye className="h-4 w-4 text-[#9b7246]" /> معاينة مباشرة</h2>
        <article className="rounded-[1.5rem] border border-black/5 bg-[#fcfaf6] p-6">
          <p className="text-[10px] font-bold tracking-[0.25em] text-[#a57b4b]">RIVAL</p>
          <h3 className="mt-2 text-2xl font-black">{title || "عنوان السياسة"}</h3>
          <div className="mt-5"><PolicyPreview content={content} /></div>
        </article>
      </section>
    </form>
  );
}

export function PoliciesPage() {
  const query = useAdminPolicies();
  const [activeKey, setActiveKey] = useState<AdminPolicy["key"]>("order");
  const active = query.data?.find((policy) => policy.key === activeKey) ?? query.data?.[0];

  return (
    <>
      <PageTitle eyebrow="المحتوى" title="السياسات" description="حرّر نصوص السياسات الخمس التي تظهر للعملاء في المتجر، مع معاينة مباشرة قبل الحفظ." />
      {query.isPending && <AdminSkeleton variant="form" rows={6} />}
      {query.isError && <AdminError onRetry={() => query.refetch()} isRetrying={query.isFetching} />}
      {query.data && (
        <>
          <div className={cx(panelClass, "mb-5 flex items-center gap-3 p-3")}>
            <ScrollText className="mr-2 hidden h-5 w-5 text-[#a77d4e] sm:block" />
            <Tabs tabs={query.data.map((policy) => ({ value: policy.key, label: POLICY_LABEL[policy.key] }))} value={active?.key ?? "order"} onChange={setActiveKey} ariaLabel="اختيار السياسة" />
          </div>
          {active && <PolicyEditor key={`${active.key}-${active.updatedAt}`} policy={active} />}
        </>
      )}
    </>
  );
}
