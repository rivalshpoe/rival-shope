"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { POLICY_ROUTES, WHATSAPP_SUPPORT_URL } from "@/lib/constants/routes";
import { POLICY_KEYS } from "@/lib/api/endpoints/policies";
import { usePolicy } from "@/lib/hooks/queries";
import type { Policy, PolicyKey } from "@/types/api.types";
import { ErrorState } from "./ErrorState";
import { SectionHead } from "./SectionHead";
import { Skeleton } from "./Skeleton";
import styles from "./PolicyPage.module.css";

const POLICY_LABELS: Record<PolicyKey, string> = {
  order: "الطلب والتوصيل",
  cancellation: "إلغاء الطلب",
  returns: "الاستبدال والإرجاع",
  shipping: "الشحن والتوصيل",
  privacy: "الخصوصية",
};

type Section = { title: string; paragraphs: string[] };

/** Splits plain-text policy content: `## ` lines open a section; blank lines separate paragraphs. */
export function parsePolicyContent(content: string): { intro: string[]; sections: Section[] } {
  const intro: string[] = [];
  const sections: Section[] = [];
  for (const block of content.split(/\n{2,}/)) {
    const text = block.trim();
    if (!text) continue;
    if (text.startsWith("## ")) {
      sections.push({ title: text.slice(3).trim(), paragraphs: [] });
      continue;
    }
    const target = sections.at(-1);
    if (target) target.paragraphs.push(text);
    else intro.push(text);
  }
  return { intro, sections };
}

type PolicyPageProps = {
  policyKey: PolicyKey;
  /** Server-fetched policy used as initial data (ISR). */
  initialPolicy?: Policy;
};

export function PolicyPage({ policyKey, initialPolicy }: PolicyPageProps) {
  const { data, isPending, isError, error, refetch, isRefetching } = usePolicy(policyKey, { initialData: initialPolicy });
  const parsed = data ? parsePolicyContent(data.content) : null;
  const updated = data ? new Intl.DateTimeFormat("ar", { dateStyle: "long" }).format(new Date(data.updatedAt)) : null;

  return (
    <>
      <section className={styles.hero}>
        <div className="container">
          {isPending ? (
            <div className={styles.heroSkeleton}><Skeleton style={{ width: 120, height: 14 }} /><Skeleton style={{ width: 320, height: 42 }} /></div>
          ) : (
            <SectionHead as="h1" tone="light" eyebrow="سياسات ريفال" title={data?.title ?? POLICY_LABELS[policyKey]} description={updated ? `آخر تحديث: ${updated}` : undefined} />
          )}
        </div>
      </section>

      <div className={`container ${styles.layout}`}>
        <aside className={styles.aside}>
          <span className="eyebrow">كل السياسات</span>
          <nav aria-label="السياسات">
            {POLICY_KEYS.map((key) => (
              <Link href={POLICY_ROUTES[key]} key={key} className={key === policyKey ? styles.activeLink : ""} aria-current={key === policyKey ? "page" : undefined}>{POLICY_LABELS[key]}</Link>
            ))}
          </nav>
          {parsed && parsed.sections.length > 0 && (
            <>
              <span className={`eyebrow ${styles.tocLabel}`}>في هذه الصفحة</span>
              <nav aria-label="محتويات الصفحة" className={styles.toc}>
                {parsed.sections.map((section, index) => <a href={`#section-${index}`} key={section.title}>{section.title}</a>)}
              </nav>
            </>
          )}
        </aside>

        <article className={styles.article}>
          {isError ? (
            <ErrorState error={error} onRetry={() => void refetch()} retrying={isRefetching} />
          ) : isPending || !parsed ? (
            <div className={styles.articleSkeleton}>{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} style={{ height: 90 }} />)}</div>
          ) : (
            <>
              {parsed.intro.map((paragraph) => <p className={styles.intro} key={paragraph.slice(0, 40)}>{paragraph}</p>)}
              {parsed.sections.map((section, index) => (
                <section id={`section-${index}`} key={section.title} className={styles.section}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <h2>{section.title}</h2>
                    {section.paragraphs.map((paragraph) => <p key={paragraph.slice(0, 40)}>{paragraph}</p>)}
                  </div>
                </section>
              ))}
            </>
          )}
          <div className={`surface ${styles.help}`}>
            <MessageCircle className={styles.helpIcon} />
            <div>
              <h3>هل تحتاجين للمساعدة؟</h3>
              <p>فريق ريفال يسعد بالإجابة عن أي استفسار قبل أو بعد الطلب.</p>
            </div>
            <a className="button" href={WHATSAPP_SUPPORT_URL} target="_blank" rel="noreferrer">تواصلي معنا</a>
          </div>
        </article>
      </div>
    </>
  );
}
