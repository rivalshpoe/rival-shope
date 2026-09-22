import Link from "next/link";
import { Instagram, MessageCircle } from "lucide-react";
import { SmartImage } from "@/components/ui/SmartImage";
import { NewsletterForm } from "@/components/layout/NewsletterForm";
import { CATEGORY_SLUGS } from "@/lib/constants/categories";
import { POLICY_ROUTES, ROUTES, WHATSAPP_SUPPORT_URL } from "@/lib/constants/routes";
import styles from "./Footer.module.css";

const shopLinks = [
  { href: ROUTES.products, label: "كل المنتجات" },
  { href: ROUTES.category(CATEGORY_SLUGS.brandBags), label: "حقائب ماركات" },
  { href: ROUTES.category(CATEGORY_SLUGS.womenBags), label: "حقائب نسائية" },
  { href: ROUTES.category(CATEGORY_SLUGS.sunglasses), label: "نظارات شمسية" },
  { href: ROUTES.category(CATEGORY_SLUGS.shapewear), label: "مشدات كولومبية" },
  { href: ROUTES.category(CATEGORY_SLUGS.accessories), label: "إكسسوارات" },
  { href: ROUTES.category(CATEGORY_SLUGS.silk), label: "أغطية وسائد حرير" },
];

const policyLinks = [
  { href: POLICY_ROUTES.order, label: "سياسة الطلب والتوصيل" },
  { href: POLICY_ROUTES.cancellation, label: "سياسة إلغاء الطلب" },
  { href: POLICY_ROUTES.returns, label: "الاستبدال والإرجاع" },
  { href: POLICY_ROUTES.shipping, label: "الشحن والتوصيل" },
  { href: POLICY_ROUTES.privacy, label: "سياسة الخصوصية" },
];

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.main}`}>
        <div className={styles.brand}>
          <Link href={ROUTES.home} className={styles.logo} aria-label="ريفال - الرئيسية">
            <SmartImage src="/brand/rival-logo.png" alt="Rival" width={1178} height={591} sizes="170px" />
          </Link>
          <p>اختيارات أنثوية راقية، منتقاة بحب لترافق تفاصيلكِ الجميلة.</p>
          <div className={styles.socials}>
            <a href="https://instagram.com" target="_blank" rel="noreferrer" aria-label="إنستغرام"><Instagram size={18} /></a>
            <a href={WHATSAPP_SUPPORT_URL} target="_blank" rel="noreferrer" aria-label="واتساب"><MessageCircle size={18} /></a>
          </div>
        </div>

        <nav className={styles.column} aria-label="تسوّقي">
          <h3>تسوّقي</h3>
          {shopLinks.map((link) => <Link href={link.href} key={link.href}>{link.label}</Link>)}
        </nav>

        <nav className={styles.column} aria-label="السياسات">
          <h3>نساعدكِ</h3>
          {policyLinks.map((link) => <Link href={link.href} key={link.href}>{link.label}</Link>)}
          <Link href={ROUTES.search}>البحث</Link>
        </nav>

        <div className={styles.newsletter}>
          <h3>كوني أول من يعرف</h3>
          <p>إصدارات محدودة، اختيارات جديدة، وحكايات أناقة تصل إليكِ.</p>
          <NewsletterForm />
        </div>
      </div>

      <div className={`container ${styles.bottom}`}>
        <span>© {new Date().getFullYear()} RIVAL. جميع الحقوق محفوظة.</span>
        <span>فلسطين · نصنع التفاصيل بشغف</span>
      </div>
    </footer>
  );
}
