"use client";

import Link from "next/link";
import { ArrowUpRight, Heart, ShoppingBag, Trash2 } from "lucide-react";
import { useShop } from "@/components/layout/ShopProvider";
import { ErrorState } from "@/components/ui/ErrorState";
import { SectionHead } from "@/components/ui/SectionHead";
import { SkeletonProductGrid } from "@/components/ui/Skeleton";
import { SmartImage } from "@/components/ui/SmartImage";
import { getEffectivePrice } from "@/lib/api/endpoints/products";
import { MAX_COMPARE_ITEMS } from "@/lib/constants/categories";
import { ROUTES } from "@/lib/constants/routes";
import { useProductsByIds } from "@/lib/hooks/queries";
import { formatPrice } from "@/lib/utils/formatCurrency";
import { ProductGrid } from "./ProductCard";
import styles from "./SavedLists.module.css";

/* -------------------------------------------------------------------------- */
/*  Wishlist                                                                   */
/* -------------------------------------------------------------------------- */

export function WishlistPage() {
  const shop = useShop();
  const { items, isLoading, error, refetch, missingIds } = useProductsByIds(shop.wishlist);

  return (
    <div className={`container ${styles.page}`}>
      <div className="page-hero">
        <SectionHead as="h1" eyebrow="قائمة الأمنيات" title="المفضلة" description={shop.hydrated && shop.wishlist.length ? `${shop.wishlist.length} قطعة تنتظركِ` : "احتفظي بالقطع التي أعجبتكِ لتعودي إليها متى شئتِ."} />
      </div>
      {!shop.hydrated || (isLoading && shop.wishlist.length > 0) ? (
        <SkeletonProductGrid count={Math.max(4, shop.wishlist.length)} />
      ) : shop.wishlist.length === 0 ? (
        <div className="empty-state">
          <Heart size={38} strokeWidth={1.2} />
          <h2>لا توجد قطع في المفضلة بعد</h2>
          <p>اضغطي على القلب فوق أي قطعة لحفظها هنا.</p>
          <Link className="button" href={ROUTES.products}>تصفّحي المجموعة</Link>
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : (
        <>
          {missingIds.length > 0 && <p className={styles.notice}>{missingIds.length} من القطع المحفوظة لم تعد متاحة وأُخفيت من القائمة.</p>}
          <ProductGrid products={items} />
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Compare                                                                    */
/* -------------------------------------------------------------------------- */

export function ComparePage() {
  const shop = useShop();
  const { products, isLoading, error, refetch } = useProductsByIds(shop.compare);

  return (
    <div className={`container ${styles.page}`}>
      <div className="page-hero">
        <SectionHead as="h1" eyebrow="قارني بذكاء" title="المقارنة" description={`قارني حتى ${MAX_COMPARE_ITEMS} قطع جنبًا إلى جنب: السعر، المقاسات، الألوان والتوفر.`} />
      </div>
      {!shop.hydrated || (isLoading && shop.compare.length > 0) ? (
        <SkeletonProductGrid count={Math.max(2, shop.compare.length)} />
      ) : shop.compare.length === 0 ? (
        <div className="empty-state">
          <ArrowUpRight size={38} strokeWidth={1.2} />
          <h2>لا توجد قطع للمقارنة</h2>
          <p>أضيفي قطعتين أو أكثر من أيقونة المقارنة على بطاقات المنتجات.</p>
          <Link className="button" href={ROUTES.products}>تصفّحي المجموعة</Link>
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col"><span className="sr-only">الخاصية</span></th>
                {products.map((product) => (
                  <th scope="col" key={product.id}>
                    <div className={styles.head}>
                      <Link href={ROUTES.product(product.id)} className={styles.thumb}><SmartImage src={product.images[0]?.url ?? ""} alt={product.title} fill sizes="200px" /></Link>
                      <Link href={ROUTES.product(product.id)} className={styles.title}>{product.title}</Link>
                      <button type="button" className={styles.remove} onClick={() => shop.toggleCompare(product.id)} aria-label={`إزالة ${product.title} من المقارنة`}><Trash2 size={14} /> إزالة</button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">الماركة</th>
                {products.map((product) => <td key={product.id}>{product.brand?.name ?? "—"}</td>)}
              </tr>
              <tr>
                <th scope="row">السعر</th>
                {products.map((product) => {
                  const sized = product.sizes.filter((size) => size.inStock).map((size) => size.price);
                  return (
                    <td key={product.id}>
                      <strong>{sized.length ? `${formatPrice(Math.min(...sized))} – ${formatPrice(Math.max(...sized))}` : formatPrice(getEffectivePrice(product))}</strong>
                      {!sized.length && product.isDiscountActive && product.discountPrice !== null && <del className={styles.del}>{formatPrice(product.price)}</del>}
                    </td>
                  );
                })}
              </tr>
              <tr>
                <th scope="row">القسم</th>
                {products.map((product) => <td key={product.id}><Link href={ROUTES.category(product.categorySlug)}>{product.categoryName}</Link></td>)}
              </tr>
              <tr>
                <th scope="row">المقاسات</th>
                {products.map((product) => <td key={product.id}>{product.sizes.length ? product.sizes.map((size) => size.label).join("، ") : "مقاس واحد"}</td>)}
              </tr>
              <tr>
                <th scope="row">الألوان</th>
                {products.map((product) => (
                  <td key={product.id}>
                    {product.colors.length ? (
                      <span className={styles.swatches}>{product.colors.map((color) => <i key={color.id} style={{ background: color.hex }} title={color.name} aria-label={color.name} />)}</span>
                    ) : "—"}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row">التوفر</th>
                {products.map((product) => {
                  const available = product.sizes.length ? product.sizes.some((size) => size.inStock) : product.stock > 0;
                  return <td key={product.id} className={available ? styles.in : styles.out}>{available ? "متوفر" : "غير متوفر"}</td>;
                })}
              </tr>
              <tr>
                <th scope="row"><span className="sr-only">إجراءات</span></th>
                {products.map((product) => (
                  <td key={product.id}>
                    <Link className="button small block" href={ROUTES.product(product.id)}><ShoppingBag size={14} /> عرض القطعة</Link>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
