import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { ROUTES } from "@/lib/constants/routes";
import styles from "./not-found.module.css";

export default function NotFound() {
  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.number} aria-hidden="true">404</div>
      <span className="eyebrow">يبدو أن هذه الصفحة تاهت</span>
      <h1 className={styles.title}>لم نعثر على الصفحة المطلوبة</h1>
      <p className={styles.text}>قد يكون الرابط تغيّر، أو أن القطعة لم تعد متاحة.</p>
      <div className={styles.actions}>
        <Link className="button" href={ROUTES.home}><ArrowRight size={17} /> العودة للرئيسية</Link>
        <Link className="button secondary" href={ROUTES.search}><Search size={17} /> البحث</Link>
      </div>
    </div>
  );
}
