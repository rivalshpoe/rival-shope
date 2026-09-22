"use client";

import Link from "next/link";
import { ArrowLeft, Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { useShop, type CartLine } from "@/components/layout/ShopProvider";
import { SectionHead } from "@/components/ui/SectionHead";
import { SkeletonList } from "@/components/ui/Skeleton";
import { SmartImage } from "@/components/ui/SmartImage";
import { ROUTES } from "@/lib/constants/routes";
import { formatPrice } from "@/lib/utils/formatCurrency";
import styles from "./CartExperience.module.css";

function LineRow({ line, compact = false }: { line: CartLine; compact?: boolean }) {
  const shop = useShop();
  const variant = [line.sizeLabel && `المقاس: ${line.sizeLabel}`, line.colorName && `اللون: ${line.colorName}`].filter(Boolean).join(" · ");
  return (
    <li className={`${styles.line} ${compact ? styles.lineCompact : ""}`}>
      <Link href={ROUTES.product(line.product.id)} className={styles.thumb} onClick={() => shop.setCartOpen(false)}>
        <SmartImage src={line.product.primaryImageUrl} alt={line.product.title} fill sizes="120px" />
      </Link>
      <div className={styles.lineBody}>
        <div className={styles.lineHead}>
          <div>
            <Link href={ROUTES.product(line.product.id)} className={styles.lineTitle} onClick={() => shop.setCartOpen(false)}>{line.product.title}</Link>
            {variant && <small className={styles.variant}>{variant}</small>}
          </div>
          <button type="button" className={styles.remove} onClick={() => shop.removeLine(line.key)} aria-label={`إزالة ${line.product.title}`}><Trash2 size={16} /></button>
        </div>
        <div className={styles.lineFoot}>
          <div className={styles.qty} aria-label="الكمية">
            <button type="button" onClick={() => shop.setLineQuantity(line.key, line.quantity - 1)} aria-label="تقليل الكمية"><Minus size={13} /></button>
            <span>{line.quantity}</span>
            <button type="button" onClick={() => shop.setLineQuantity(line.key, line.quantity + 1)} aria-label="زيادة الكمية"><Plus size={13} /></button>
          </div>
          <div className={styles.linePrice}>
            <strong>{formatPrice(line.lineTotal)}</strong>
            {line.quantity > 1 && <small>{formatPrice(line.unitPrice)} للقطعة</small>}
          </div>
        </div>
      </div>
    </li>
  );
}

function EmptyCart({ onClose }: { onClose?: () => void }) {
  return (
    <div className="empty-state">
      <ShoppingBag size={38} strokeWidth={1.2} />
      <h2>حقيبتكِ فارغة</h2>
      <p>ابدئي بإضافة القطع التي أسرت قلبكِ، وسنحتفظ بها هنا حتى تكملي طلبكِ.</p>
      <Link className="button" href={ROUTES.products} onClick={onClose}>تصفّحي المجموعة</Link>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Drawer                                                                     */
/* -------------------------------------------------------------------------- */

export function CartDrawer() {
  const shop = useShop();
  if (!shop.cartOpen) return null;
  const close = () => shop.setCartOpen(false);
  return (
    <div className="drawer-backdrop" data-scroll-lock onMouseDown={close}>
      <aside className={`drawer ${styles.drawer}`} role="dialog" aria-modal="true" aria-label="حقيبة التسوق" onMouseDown={(event) => event.stopPropagation()}>
        <div className="drawer-head">
          <h2>حقيبتكِ <span className={styles.drawerCount}>({shop.cartCount})</span></h2>
          <button type="button" className="icon-button" onClick={close} aria-label="إغلاق الحقيبة"><X size={19} /></button>
        </div>
        {!shop.hydrated ? (
          <SkeletonList rows={2} />
        ) : shop.cart.length === 0 ? (
          <EmptyCart onClose={close} />
        ) : (
          <>
            <ul className={styles.lines}>{shop.cart.map((line) => <LineRow line={line} key={line.key} compact />)}</ul>
            <div className={styles.drawerFoot}>
              <div className={styles.totalRow}><span>الإجمالي الفرعي</span><strong>{formatPrice(shop.subtotal)}</strong></div>
              <p className={styles.note}>تُحسب رسوم التوصيل (إن وُجدت) في صفحة الدفع.</p>
              <Link className="button block" href={ROUTES.checkout} onClick={close}>إتمام الطلب <ArrowLeft size={16} /></Link>
              <Link className={styles.viewCart} href={ROUTES.cart} onClick={close}>عرض الحقيبة كاملة</Link>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */

export function CartPage() {
  const shop = useShop();
  return (
    <div className={`container ${styles.page}`}>
      <div className="page-hero">
        <SectionHead as="h1" eyebrow="حقيبة التسوق" title="حقيبتكِ" description={shop.hydrated && shop.cartCount ? `${shop.cartCount} قطعة جاهزة لإتمام الطلب` : "راجعي اختياراتكِ قبل إتمام الطلب."} />
      </div>
      {!shop.hydrated ? (
        <SkeletonList rows={3} />
      ) : shop.cart.length === 0 ? (
        <EmptyCart />
      ) : (
        <div className={styles.pageGrid}>
          <ul className={styles.lines}>{shop.cart.map((line) => <LineRow line={line} key={line.key} />)}</ul>
          <aside className={`surface ${styles.summary}`}>
            <h2>ملخص الطلب</h2>
            <div className={styles.totalRow}><span>الإجمالي الفرعي</span><strong>{formatPrice(shop.subtotal)}</strong></div>
            <div className={styles.totalRow}><span>التوصيل</span><span className="muted">يُحدد في الدفع</span></div>
            <div className={`${styles.totalRow} ${styles.grand}`}><span>الإجمالي</span><strong>{formatPrice(shop.subtotal)}</strong></div>
            <Link className="button block" href={ROUTES.checkout}>إتمام الطلب <ArrowLeft size={16} /></Link>
            <button type="button" className={styles.clear} onClick={shop.clearCart}>إفراغ الحقيبة</button>
            <p className={styles.note}>الدفع نقدًا عند الاستلام · تأكيد عبر واتساب</p>
          </aside>
        </div>
      )}
    </div>
  );
}
