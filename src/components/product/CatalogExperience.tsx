"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, X } from "lucide-react";
import { LoadMore } from "@/components/home/HomeExperience";
import { ErrorState } from "@/components/ui/ErrorState";
import { SectionHead } from "@/components/ui/SectionHead";
import { SkeletonProductGrid } from "@/components/ui/Skeleton";
import { SmartImage } from "@/components/ui/SmartImage";
import { ROUTES } from "@/lib/constants/routes";
import { useBrands, useCategoryBySlug, useProducts } from "@/lib/hooks/queries";
import type { ProductSort } from "@/types/api.types";
import { ProductGrid } from "./ProductCard";
import styles from "./CatalogExperience.module.css";

const SORT_OPTIONS: { value: ProductSort; label: string }[] = [
  { value: "newest", label: "الأحدث" },
  { value: "bestselling", label: "الأكثر طلبًا" },
  { value: "priceAsc", label: "السعر: الأقل أولًا" },
  { value: "priceDesc", label: "السعر: الأعلى أولًا" },
];

const isSort = (value: string | null): value is ProductSort =>
  SORT_OPTIONS.some((option) => option.value === value);

type CatalogExperienceProps = {
  /** Main category slug (from `/category/[slug]`). */
  categorySlug?: string;
  /** Sub-category slug (from `/category/[slug]/[subSlug]`); takes precedence for filtering. */
  subCategorySlug?: string;
};

export function CatalogExperience({ categorySlug, subCategorySlug }: CatalogExperienceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sortParam = searchParams.get("sort");
  const sort: ProductSort = isSort(sortParam) ? sortParam : "newest";
  const brandSlug = searchParams.get("brand") ?? undefined;

  const activeSlug = subCategorySlug ?? categorySlug;
  const categories = useCategoryBySlug(activeSlug);
  const parent = useCategoryBySlug(categorySlug);
  const { data: brands } = useBrands();
  const brand = brandSlug ? brands?.find((candidate) => candidate.slug === brandSlug) : undefined;

  const categoryMissing = Boolean(activeSlug) && categories.isSuccess && !categories.category;
  const products = useProducts(
    { categorySlug: activeSlug, brandSlug, sort },
    { enabled: !categoryMissing },
  );

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value); else next.delete(key);
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const title = categories.category?.name ?? (brand ? brand.name : "كل المنتجات");
  const description = categories.category
    ? `${categories.category.productCount} قطعة مختارة بعناية في ${categories.category.name}.`
    : brand
      ? `كل ما اخترناه لكِ من ${brand.name}.`
      : "تفاصيل منتقاة لتضيف إلى حضوركِ لمسة لا تُنسى.";
  const chips = (subCategorySlug ? parent.children : categories.children) ?? [];
  const heroImage = categories.category?.imageUrl ?? brand?.imageUrl;

  return (
    <>
      <section className={styles.hero}>
        {heroImage && <SmartImage src={heroImage} alt="" fill sizes="100vw" priority className={styles.heroImage} />}
        <div className={styles.heroShade} />
        <div className={`container ${styles.heroContent}`}>
          <nav className={styles.breadcrumbs} aria-label="مسار التصفح">
            <Link href={ROUTES.home}>الرئيسية</Link>
            <ChevronLeft size={12} />
            <Link href={ROUTES.products}>المتجر</Link>
            {categories.path.map((crumb, index) => (
              <span key={crumb.id} className={styles.crumb}>
                <ChevronLeft size={12} />
                {index === categories.path.length - 1
                  ? <span aria-current="page">{crumb.name}</span>
                  : <Link href={index === 0 ? ROUTES.category(crumb.slug) : ROUTES.subCategory(categories.path[0].slug, crumb.slug)}>{crumb.name}</Link>}
              </span>
            ))}
          </nav>
          <SectionHead as="h1" tone="light" eyebrow={brand ? "الماركة" : "RIVAL COLLECTION"} title={title} description={description} />
        </div>
      </section>

      <section className={`container ${styles.catalog}`}>
        {categoryMissing ? (
          <ErrorState description={{ title: "هذا القسم غير متاح", message: "ربما تم نقل القسم أو لم يعد موجودًا. تصفّحي أقسامنا الأخرى.", action: "back", isRetryable: false }} />
        ) : (
          <>
            {(chips.length > 0 || brand) && (
              <div className={styles.chips}>
                {brand && (
                  <button type="button" className={`${styles.chip} ${styles.chipActive}`} onClick={() => setParam("brand", null)} aria-label={`إزالة تصفية ${brand.name}`}>
                    {brand.name} <X size={13} />
                  </button>
                )}
                {chips.length > 0 && categorySlug && (
                  <Link href={ROUTES.category(categorySlug)} className={`${styles.chip} ${!subCategorySlug ? styles.chipActive : ""}`}>الكل</Link>
                )}
                {categorySlug && chips.map((child) => (
                  <Link
                    key={child.id}
                    href={ROUTES.subCategory(categorySlug, child.slug)}
                    className={`${styles.chip} ${subCategorySlug === child.slug ? styles.chipActive : ""}`}
                  >
                    {child.name}
                  </Link>
                ))}
              </div>
            )}

            <div className={styles.tools}>
              <span className={styles.count}>
                {products.isPending ? "جارٍ العدّ..." : `${products.totalItems} قطعة`}
              </span>
              <label className={styles.sort}>
                <span>ترتيب حسب</span>
                <select value={sort} onChange={(event) => setParam("sort", event.target.value === "newest" ? null : event.target.value)}>
                  {SORT_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
                </select>
              </label>
            </div>

            {products.isError ? (
              <ErrorState error={products.error} onRetry={() => void products.refetch()} retrying={products.isRefetching} />
            ) : products.isPending ? (
              <SkeletonProductGrid count={8} />
            ) : products.items.length === 0 ? (
              <div className="empty-state">
                <h2>لا توجد قطع في هذا القسم حاليًا</h2>
                <p>جرّبي قسمًا آخر أو تصفّحي كل المنتجات.</p>
                <Link className="button" href={ROUTES.products}>كل المنتجات</Link>
              </div>
            ) : (
              <>
                <ProductGrid products={products.items} priorityCount={2} />
                <LoadMore
                  shown={products.items.length}
                  total={products.totalItems}
                  progress={products.progress}
                  hasMore={Boolean(products.hasNextPage)}
                  loading={products.isFetchingNextPage}
                  onLoad={() => void products.fetchNextPage()}
                />
              </>
            )}
          </>
        )}
      </section>
    </>
  );
}
