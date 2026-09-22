import type { Metadata } from "next";
import Link from "next/link";
import { Check, MessageCircle } from "lucide-react";
import { SectionHead } from "@/components/ui/SectionHead";
import { ROUTES, WHATSAPP_SUPPORT_URL } from "@/lib/constants/routes";
import { formatPrice } from "@/lib/utils/formatCurrency";
import { CopyInvoiceButton } from "./CopyInvoiceButton";
import styles from "./page.module.css";

type Props = {
  params: Promise<{ invoiceNumber: string }>;
  searchParams: Promise<{ total?: string }>;
};

export const metadata: Metadata = { title: "تم استلام طلبكِ", robots: { index: false, follow: false } };

const STEPS = [
  { title: "تأكيد الطلب", body: "رسالة واتساب من فريقنا خلال ساعات العمل" },
  { title: "تجهيز القطع", body: "نراجع كل تفصيل بعناية قبل التغليف" },
  { title: "التوصيل", body: "إلى عنوانكِ أو بالتنسيق معكِ للاستلام" },
];

export default async function OrderSuccessPage({ params, searchParams }: Props) {
  const [{ invoiceNumber }, { total }] = await Promise.all([params, searchParams]);
  const totalNumber = total ? Number(total) : NaN;

  return (
    <div className={`container ${styles.page}`}>
      <section className={`surface ${styles.card}`}>
        <div className={styles.check}><Check size={36} /></div>
        <SectionHead as="h1" eyebrow="تم استلام طلبكِ" title="شكرًا لاختياركِ ريفال" description="طلبكِ أصبح بين أيدينا. سنتواصل معكِ عبر واتساب لتأكيد التفاصيل وموعد التوصيل." />

        <div className={styles.invoice}>
          <div>
            <small>رقم الطلب</small>
            <strong dir="ltr">{invoiceNumber}</strong>
          </div>
          {Number.isFinite(totalNumber) && (
            <div>
              <small>الإجمالي عند الاستلام</small>
              <strong>{formatPrice(totalNumber)}</strong>
            </div>
          )}
          <CopyInvoiceButton value={invoiceNumber} />
        </div>

        <ol className={styles.steps}>
          {STEPS.map((step, index) => (
            <li key={step.title}>
              <span>{index + 1}</span>
              <div><b>{step.title}</b><small>{step.body}</small></div>
            </li>
          ))}
        </ol>

        <div className={styles.actions}>
          <Link className="button" href={ROUTES.products}>متابعة التسوق</Link>
          <a className="button secondary" href={WHATSAPP_SUPPORT_URL} target="_blank" rel="noreferrer"><MessageCircle size={17} /> تواصلي معنا</a>
        </div>
      </section>
    </div>
  );
}
