"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowUpLeft, ChevronLeft, ChevronRight, Quote, Sparkles, Star } from "lucide-react";
import { ProductCard, ProductGrid } from "@/components/product/ProductCard";
import { ErrorState } from "@/components/ui/ErrorState";
import { SectionHead } from "@/components/ui/SectionHead";
import { Skeleton, SkeletonList, SkeletonProductGrid, SkeletonTiles } from "@/components/ui/Skeleton";
import { SmartImage } from "@/components/ui/SmartImage";
import { Spinner } from "@/components/ui/Spinner";
import { ROUTES } from "@/lib/constants/routes";
import { useBrands, useCategoryTree, useProductPage, useProducts, useReviews } from "@/lib/hooks/queries";
import type { Review } from "@/types/api.types";
import styles from "./HomeExperience.module.css";

const HERO_POSTER = "https://images.unsplash.com/photo-1547887538-e3a2f32cb1cc?auto=format&fit=crop&w=2000&q=80";
const HERO_VIDEO = "https://cdn.coverr.co/videos/coverr-a-woman-walking-in-a-coat-1577/1080p.mp4";

export function HomeExperience() {
  return (
    <>
      <Hero />
      <CategoriesSection />
      <div className={styles.strip} aria-hidden="true">
        <span>RIVAL EDIT</span><i>تفاصيل تختاركِ</i><span>CURATED LUXURY</span><i>أناقة بلا مجهود</i>
      </div>
      <NewArrivalsSection />
      <BrandsSection />
      <BrowseAllSection />
      <ReviewsSection />
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  Hero                                                                       */
/* -------------------------------------------------------------------------- */

function Hero() {
  const [videoFailed, setVideoFailed] = useState(false);
  const reducedMotion = useReducedMotion();
  return (
    <section className={styles.hero} aria-label="مقدمة">
      <div className={styles.heroMedia}>
        <SmartImage src={HERO_POSTER} alt="" fill sizes="100vw" priority />
        {!videoFailed && !reducedMotion && (
          <video autoPlay muted loop playsInline poster={HERO_POSTER} onError={() => setVideoFailed(true)} aria-hidden="true">
            <source src={HERO_VIDEO} type="video/mp4" />
          </video>
        )}
        <div className={styles.heroShade} />
      </div>
      <motion.div
        className={`container ${styles.heroContent}`}
        initial={reducedMotion ? false : { opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      >
        <span className={styles.heroKicker}><Sparkles size={14} /> THE RIVAL EDIT · 2026</span>
        <h1>أناقتكِ،<br /><em>بتوقيع مختلف.</em></h1>
        <p>قطع منتقاة لا تتبع اللحظة، بل تصنعها. حقائب، نظارات، مشدات كولومبية، وحرير يليق بكِ.</p>
        <div className={styles.heroActions}>
          <Link className="button light" href={ROUTES.products}>اكتشفي المجموعة <ArrowLeft size={17} /></Link>
          <Link className={styles.heroSecondary} href="#categories">تصفّحي الأقسام</Link>
        </div>
      </motion.div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Categories                                                                 */
/* -------------------------------------------------------------------------- */

function CategoriesSection() {
  const { tree, isPending, isError, error, refetch, isRefetching } = useCategoryTree();
  return (
    <section className="section container" id="categories">
      <SectionHead eyebrow="عوالم ريفال" title="تسوّقي حسب القسم" description="ست مجموعات صُممت لتنتقي منها ما يشبهكِ، من القطعة الأيقونية إلى طقوس العناية اليومية." />
      {isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} retrying={isRefetching} />
      ) : isPending ? (
        <SkeletonTiles count={6} />
      ) : (
        <div className={styles.categoryGrid}>
          {tree.map((category, index) => (
            <Link href={ROUTES.category(category.slug)} className={styles.categoryCard} key={category.id}>
              <SmartImage src={category.imageUrl} alt="" fill sizes="(max-width: 680px) 50vw, 33vw" priority={index === 0} />
              <div>
                <small>{String(index + 1).padStart(2, "0")}</small>
                <h3>{category.name}</h3>
                <p>{category.productCount} قطعة{category.children.length ? ` · ${category.children.length} أقسام فرعية` : ""}</p>
                <span>اكتشفي <ArrowUpLeft size={15} /></span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  New arrivals rail                                                          */
/* -------------------------------------------------------------------------- */

function NewArrivalsSection() {
  const rail = useRef<HTMLDivElement>(null);
  const { data, isPending, isError, error, refetch, isRefetching } = useProductPage({ sort: "newest", pageSize: 8 });
  const scroll = (direction: 1 | -1) => rail.current?.scrollBy({ left: direction * 320, behavior: "smooth" });
  return (
    <section className="section container">
      <SectionHead eyebrow="وصل للتو" title="الجديد في ريفال" description="أحدث القطع التي انضمت إلى مجموعتنا هذا الأسبوع." />
      {isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} retrying={isRefetching} />
      ) : (
        <div className={styles.railWrap}>
          <div className={styles.railButtons}>
            <button type="button" onClick={() => scroll(1)} aria-label="السابق"><ChevronRight /></button>
            <button type="button" onClick={() => scroll(-1)} aria-label="التالي"><ChevronLeft /></button>
          </div>
          <div className={styles.rail} ref={rail}>
            {isPending
              ? Array.from({ length: 4 }, (_, index) => <div key={index}><Skeleton className={styles.railSkeleton} /></div>)
              : data?.items.map((product) => <div key={product.id}><ProductCard product={product} /></div>)}
          </div>
        </div>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Brands banner                                                              */
/* -------------------------------------------------------------------------- */

function BrandsSection() {
  const { data: brands, isPending, isError, error, refetch, isRefetching } = useBrands();
  return (
    <section className={styles.brands}>
      <div className="container">
        <SectionHead tone="light" eyebrow="BRANDS OF DISTINCTION" title="أسماءٌ لا تحتاج إلى تعريف" description="من دور الأزياء الأيقونية إلى العلامات الصاعدة، اخترنا لكِ قطعًا توازن بين إرث التصميم وروح اليوم." />
        {isError ? (
          <ErrorState error={error} onRetry={() => void refetch()} retrying={isRefetching} />
        ) : (
          <div className={styles.brandGrid}>
            {isPending
              ? Array.from({ length: 8 }, (_, index) => <Skeleton key={index} className={styles.brandSkeleton} />)
              : brands?.map((brand) => (
                  <Link href={ROUTES.brand(brand.slug)} key={brand.id} className={styles.brandCard}>
                    <SmartImage src={brand.imageUrl} alt="" fill sizes="(max-width: 680px) 50vw, 25vw" />
                    <span>{brand.name}</span>
                  </Link>
                ))}
          </div>
        )}
        <div className={styles.brandsAction}>
          <Link className="button light" href={ROUTES.products}>استكشفي كل الماركات <ArrowLeft size={17} /></Link>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Browse all (infinite, 10 per page, progress bar)                           */
/* -------------------------------------------------------------------------- */

function BrowseAllSection() {
  const { items, totalItems, progress, isPending, isError, error, refetch, isRefetching, hasNextPage, fetchNextPage, isFetchingNextPage } = useProducts({ sort: "newest" });
  return (
    <section className="section container">
      <SectionHead eyebrow="اختاري ما يعبّر عنكِ" title="تصفّحي كل القطع" description="تشكيلة متجددة، حيث تجدين الجمال في كل اختيار." />
      {isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} retrying={isRefetching} />
      ) : isPending ? (
        <SkeletonProductGrid count={8} />
      ) : (
        <>
          <ProductGrid products={items} />
          <LoadMore shown={items.length} total={totalItems} progress={progress} hasMore={Boolean(hasNextPage)} loading={isFetchingNextPage} onLoad={() => void fetchNextPage()} />
        </>
      )}
    </section>
  );
}

export function LoadMore({ shown, total, progress, hasMore, loading, onLoad }: { shown: number; total: number; progress: number; hasMore: boolean; loading: boolean; onLoad: () => void }) {
  if (!total) return null;
  return (
    <div className={styles.loadMore}>
      <div className={styles.progress} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
        <span style={{ width: `${progress}%` }} />
      </div>
      <small>عرضتِ {shown} من {total}</small>
      {hasMore ? (
        <button type="button" className="button secondary" onClick={onLoad} disabled={loading}>
          {loading ? <><Spinner size={16} /> جارٍ التحميل</> : "تحميل المزيد"}
        </button>
      ) : (
        <span className={styles.loadDone}>شاهدتِ كل القطع المتاحة</span>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Reviews                                                                    */
/* -------------------------------------------------------------------------- */

function ReviewsSection() {
  const { items, isPending, isError, error, refetch, isRefetching, averageRating } = useReviews({ pageSize: 6 });
  return (
    <section className={`section ${styles.reviews}`}>
      <div className="container">
        <SectionHead eyebrow="آراء العميلات" title="قالوا عن ريفال" description={averageRating ? `متوسط التقييم ${averageRating} من 5 بناءً على تجارب حقيقية.` : "تجارب حقيقية من عميلات اخترن ريفال."} />
        {isError ? (
          <ErrorState error={error} onRetry={() => void refetch()} retrying={isRefetching} />
        ) : isPending ? (
          <SkeletonList rows={3} />
        ) : items.length === 0 ? (
          <p className={styles.reviewsEmpty}>لا توجد تقييمات منشورة بعد.</p>
        ) : (
          <div className={styles.reviewGrid}>
            {items.map((review) => <ReviewCard review={review} key={review.id} />)}
          </div>
        )}
      </div>
    </section>
  );
}

export function ReviewCard({ review }: { review: Review }) {
  return (
    <article className={styles.reviewCard}>
      <Quote size={20} className={styles.reviewQuote} />
      <div className={styles.stars} aria-label={`${review.rating} من 5`}>
        {Array.from({ length: 5 }, (_, index) => <Star key={index} size={14} fill={index < review.rating ? "currentColor" : "none"} />)}
      </div>
      <p>{review.comment}</p>
      {review.imageUrl && (
        <div className={styles.reviewImage}>
          <SmartImage src={review.imageUrl} alt={`صورة من ${review.customerName}`} fill sizes="(max-width: 680px) 90vw, 30vw" />
        </div>
      )}
      <footer>
        <strong>{review.customerName}</strong>
        {review.productId && review.productTitle && <Link href={ROUTES.product(review.productId)}>{review.productTitle}</Link>}
      </footer>
    </article>
  );
}
