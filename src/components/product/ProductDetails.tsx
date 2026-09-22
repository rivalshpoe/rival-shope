"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Heart, Minus, Plus, Scale, ShoppingBag, Star, X, ZoomIn } from "lucide-react";
import { ReviewCard } from "@/components/home/HomeExperience";
import { useShop } from "@/components/layout/ShopProvider";
import { ErrorState } from "@/components/ui/ErrorState";
import { SectionHead } from "@/components/ui/SectionHead";
import { SkeletonList, SkeletonProductGrid, SkeletonProductPage } from "@/components/ui/Skeleton";
import { SmartImage } from "@/components/ui/SmartImage";
import { Spinner } from "@/components/ui/Spinner";
import { getEffectivePrice, toListItem } from "@/lib/api/endpoints/products";
import { isNotFoundError } from "@/lib/api/errors";
import { MAX_LINE_QUANTITY } from "@/lib/constants/categories";
import { POLICY_ROUTES, ROUTES } from "@/lib/constants/routes";
import { usePolicies, useProduct, useProductsByIds, useReviews } from "@/lib/hooks/queries";
import { formatPrice } from "@/lib/utils/formatCurrency";
import type { PolicyKey, ProductDetails as ProductDetailsData, ProductImage } from "@/types/api.types";
import { ProductGrid } from "./ProductCard";
import styles from "./ProductDetails.module.css";

type ProductDetailsProps = {
  id: string;
  /** Server-fetched product (ISR) used as initial data so the page renders without a client round-trip. */
  initialProduct?: ProductDetailsData;
};

export function ProductDetails({ id, initialProduct }: ProductDetailsProps) {
  const { data, isPending, isError, error, refetch, isRefetching } = useProduct(id, { initialData: initialProduct });

  if (isPending) return <SkeletonProductPage />;
  if (isError || !data) {
    if (isNotFoundError(error)) {
      return (
        <div className="container">
          <ErrorState variant="page" description={{ title: "هذه القطعة لم تعد متاحة", message: "ربما نفدت أو أُزيلت من المجموعة. تصفّحي اختياراتنا الأخرى.", action: "back", isRetryable: false }} />
        </div>
      );
    }
    return <div className="container"><ErrorState variant="page" error={error} onRetry={() => void refetch()} retrying={isRefetching} /></div>;
  }
  return <ProductView key={data.id} product={data} />;
}

/* -------------------------------------------------------------------------- */

function ProductView({ product }: { product: ProductDetailsData }) {
  const router = useRouter();
  const shop = useShop();
  const listItem = useMemo(() => toListItem(product), [product]);
  const images = useMemo(() => sortImages(product.images), [product.images]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [colorId, setColorId] = useState(product.colors[0]?.id ?? null);
  const [sizeId, setSizeId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [sizeError, setSizeError] = useState(false);
  const [pending, setPending] = useState<"cart" | "buy" | null>(null);

  const selectedSize = product.sizes.find((size) => size.id === sizeId) ?? null;
  const selectedColor = product.colors.find((color) => color.id === colorId) ?? null;
  const unitPrice = selectedSize ? selectedSize.price : getEffectivePrice(product);
  const hasDiscount = !selectedSize && product.isDiscountActive && product.discountPrice !== null;
  const soldOut = product.sizes.length ? product.sizes.every((size) => !size.inStock) : product.stock <= 0;
  const liked = shop.wishlist.includes(product.id);
  const compared = shop.compare.includes(product.id);

  const priceRange = useMemo(() => {
    const available = product.sizes.filter((size) => size.inStock).map((size) => size.price);
    if (!available.length) return null;
    const min = Math.min(...available);
    const max = Math.max(...available);
    return min === max ? formatPrice(min) : `${formatPrice(min)} – ${formatPrice(max)}`;
  }, [product.sizes]);

  const add = (mode: "cart" | "buy") => {
    if (pending || soldOut) return;
    if (product.sizes.length && !selectedSize) {
      setSizeError(true);
      document.getElementById("size-picker")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setPending(mode);
    shop.addToCart(listItem, {
      sizeId: selectedSize?.id ?? null,
      sizeLabel: selectedSize?.label ?? null,
      colorId: selectedColor?.id ?? null,
      colorName: selectedColor?.name ?? null,
      unitPrice,
      quantity,
    });
    window.setTimeout(() => {
      setPending(null);
      if (mode === "buy") router.push(ROUTES.checkout);
      else shop.setCartOpen(true);
    }, 320);
  };

  return (
    <>
      <div className={`container ${styles.page}`}>
        <nav className={styles.breadcrumbs} aria-label="مسار التصفح">
          <Link href={ROUTES.home}>الرئيسية</Link><ChevronLeft size={12} />
          <Link href={ROUTES.category(product.categorySlug)}>{product.categoryName}</Link><ChevronLeft size={12} />
          <span aria-current="page">{product.title}</span>
        </nav>

        <div className={styles.layout}>
          <Gallery images={images} title={product.title} activeIndex={activeIndex} onChange={setActiveIndex} onOpen={() => setLightbox(true)} />

          <div className={styles.info}>
            <div className={styles.meta}>
              {product.brand ? <Link href={ROUTES.brand(product.brand.slug)} className={styles.brand}>{product.brand.name}</Link> : <span className={styles.brand}>Rival Edit</span>}
              <span className={soldOut ? styles.stockOut : styles.stockIn}>{soldOut ? "غير متوفر حاليًا" : product.sizes.length ? "متوفر" : product.stock <= 3 ? `بقي ${product.stock} فقط` : "متوفر"}</span>
            </div>
            <h1 className={styles.title}>{product.title}</h1>
            <div className={styles.price}>
              <strong>{selectedSize || !priceRange ? formatPrice(unitPrice) : priceRange}</strong>
              {hasDiscount && <del>{formatPrice(product.price)}</del>}
              {hasDiscount && <span className="badge">وفّري {formatPrice(product.price - unitPrice)}</span>}
            </div>
            <p className={styles.lead}>{product.description.split("\n")[0]}</p>

            {product.colors.length > 0 && (
              <div className={styles.option}>
                <strong>اللون{selectedColor ? <span> · {selectedColor.name}</span> : null}</strong>
                <div className={styles.swatches}>
                  {product.colors.map((color) => (
                    <button type="button" key={color.id} className={colorId === color.id ? styles.chosen : ""} style={{ background: color.hex }} onClick={() => setColorId(color.id)} aria-label={color.name} aria-pressed={colorId === color.id}>
                      {colorId === color.id && <Check size={14} />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {product.sizes.length > 0 && (
              <div className={styles.option} id="size-picker">
                <strong>المقاس <span>· لكل مقاس سعره</span></strong>
                <div className={styles.sizes} role="radiogroup" aria-label="المقاس" aria-invalid={sizeError}>
                  {product.sizes.map((size) => (
                    <button
                      type="button"
                      role="radio"
                      aria-checked={sizeId === size.id}
                      key={size.id}
                      className={sizeId === size.id ? styles.chosen : ""}
                      disabled={!size.inStock}
                      onClick={() => { setSizeId(size.id); setSizeError(false); }}
                    >
                      <span>{size.label}</span>
                      <small>{size.inStock ? formatPrice(size.price) : "نفد"}</small>
                    </button>
                  ))}
                </div>
                {sizeError && <span className="field-error" role="alert">اختاري المقاس أولًا</span>}
              </div>
            )}

            <div className={styles.buyRow}>
              <div className={styles.qty} aria-label="الكمية">
                <button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))} aria-label="تقليل الكمية"><Minus size={15} /></button>
                <span>{quantity}</span>
                <button type="button" onClick={() => setQuantity((value) => Math.min(MAX_LINE_QUANTITY, value + 1))} aria-label="زيادة الكمية"><Plus size={15} /></button>
              </div>
              <button type="button" className="button" disabled={soldOut || pending !== null} onClick={() => add("cart")}>
                {pending === "cart" ? <Spinner size={16} tone="inverse" /> : <ShoppingBag size={17} />}
                {soldOut ? "غير متوفر" : "أضيفي للحقيبة"}
              </button>
            </div>
            <button type="button" className="button secondary block" disabled={soldOut || pending !== null} onClick={() => add("buy")}>
              {pending === "buy" ? <Spinner size={16} /> : null} اشترِي الآن — الدفع عند الاستلام
            </button>

            <div className={styles.secondary}>
              <button type="button" onClick={() => shop.toggleWishlist(product.id)} aria-pressed={liked}>
                <Heart size={16} fill={liked ? "currentColor" : "none"} /> {liked ? "في المفضلة" : "أضيفي للمفضلة"}
              </button>
              <button type="button" onClick={() => shop.toggleCompare(product.id)} aria-pressed={compared}>
                <Scale size={16} /> {compared ? "في المقارنة" : "قارني"}
              </button>
            </div>

            <ProductAccordions product={product} />
          </div>
        </div>
      </div>

      <ProductReviews productId={product.id} />
      <RelatedProducts ids={product.relatedProductIds} />

      {lightbox && <Lightbox images={images} title={product.title} index={activeIndex} onChange={setActiveIndex} onClose={() => setLightbox(false)} />}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  Gallery                                                                    */
/* -------------------------------------------------------------------------- */

function sortImages(images: ProductImage[]): ProductImage[] {
  return [...images].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.sortOrder - b.sortOrder);
}

function useSwipe(onSwipe: (direction: 1 | -1) => void) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (event: React.PointerEvent) => { start.current = { x: event.clientX, y: event.clientY }; };
  const onPointerUp = (event: React.PointerEvent) => {
    if (!start.current) return;
    const dx = event.clientX - start.current.x;
    const dy = event.clientY - start.current.y;
    start.current = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) onSwipe(dx < 0 ? 1 : -1);
  };
  return { onPointerDown, onPointerUp };
}

function Gallery({ images, title, activeIndex, onChange, onOpen }: { images: ProductImage[]; title: string; activeIndex: number; onChange: (index: number) => void; onOpen: () => void }) {
  const count = images.length;
  const step = useCallback((direction: 1 | -1) => onChange((activeIndex + direction + count) % count), [activeIndex, count, onChange]);
  const swipe = useSwipe(step);
  const active = images[activeIndex] ?? images[0];

  return (
    <div className={styles.gallery}>
      <div className={styles.mainImage} {...swipe}>
        {active && <SmartImage src={active.url} alt={title} fill sizes="(max-width: 900px) 100vw, 55vw" priority />}
        <button type="button" className={styles.zoom} onClick={onOpen} aria-label="تكبير الصورة"><ZoomIn size={18} /></button>
        {count > 1 && (
          <>
            <button type="button" className={`${styles.arrow} ${styles.arrowPrev}`} onClick={() => step(-1)} aria-label="الصورة السابقة"><ChevronRight size={20} /></button>
            <button type="button" className={`${styles.arrow} ${styles.arrowNext}`} onClick={() => step(1)} aria-label="الصورة التالية"><ChevronLeft size={20} /></button>
            <span className={styles.counter}>{activeIndex + 1} / {count}</span>
          </>
        )}
      </div>
      {count > 1 && (
        <div className={styles.thumbs} role="tablist" aria-label="صور المنتج">
          {images.map((image, index) => (
            <button type="button" role="tab" aria-selected={index === activeIndex} key={image.url} className={index === activeIndex ? styles.thumbActive : ""} onClick={() => onChange(index)} aria-label={`صورة ${index + 1}`}>
              <SmartImage src={image.url} alt="" fill sizes="90px" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Lightbox({ images, title, index, onChange, onClose }: { images: ProductImage[]; title: string; index: number; onChange: (index: number) => void; onClose: () => void }) {
  const count = images.length;
  const step = useCallback((direction: 1 | -1) => onChange((index + direction + count) % count), [count, index, onChange]);
  const swipe = useSwipe(step);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") step(1);
      if (event.key === "ArrowRight") step(-1);
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, step]);

  const image = images[index] ?? images[0];
  return (
    <div className={styles.lightbox} data-scroll-lock role="dialog" aria-modal="true" aria-label={`معرض صور ${title}`} onMouseDown={onClose}>
      <button type="button" className={styles.lightboxClose} onClick={onClose} aria-label="إغلاق"><X size={22} /></button>
      {count > 1 && (
        <>
          <button type="button" className={`${styles.lightboxArrow} ${styles.lightboxPrev}`} onMouseDown={(event) => event.stopPropagation()} onClick={() => step(-1)} aria-label="السابقة"><ChevronRight size={26} /></button>
          <button type="button" className={`${styles.lightboxArrow} ${styles.lightboxNext}`} onMouseDown={(event) => event.stopPropagation()} onClick={() => step(1)} aria-label="التالية"><ChevronLeft size={26} /></button>
        </>
      )}
      <div className={styles.lightboxImage} onMouseDown={(event) => event.stopPropagation()} {...swipe}>
        {image && <SmartImage src={image.url} alt={title} fill sizes="100vw" priority />}
      </div>
      <span className={styles.lightboxCounter}>{index + 1} / {count}</span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Accordions                                                                 */
/* -------------------------------------------------------------------------- */

function Accordion({ title, children, defaultOpen = false }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={styles.accordion}>
      <button type="button" className={styles.accordionHead} onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <span>{title}</span>
        <ChevronDown size={18} className={open ? styles.rotated : ""} />
      </button>
      {open && <div className={styles.accordionBody}>{children}</div>}
    </div>
  );
}

function PolicyExcerpt({ policyKey, fallback }: { policyKey: PolicyKey; fallback: string }) {
  const { data, isPending } = usePolicies();
  const policy = data?.find((item) => item.key === policyKey);
  if (isPending) return <SkeletonList rows={1} />;
  const paragraphs = (policy?.content ?? fallback)
    .split(/\n{2,}/)
    .filter((block) => block.trim() && !block.trim().startsWith("## "))
    .slice(0, 2);
  return (
    <>
      {paragraphs.map((paragraph) => <p key={paragraph.slice(0, 32)}>{paragraph.trim()}</p>)}
      <Link href={POLICY_ROUTES[policyKey]} className="text-link">اقرئي السياسة كاملة <ChevronLeft size={14} /></Link>
    </>
  );
}

function ProductAccordions({ product }: { product: ProductDetailsData }) {
  const { totalItems, averageRating } = useReviews({ productId: product.id, pageSize: 3 });
  return (
    <div className={styles.accordions}>
      <Accordion title="الوصف والتفاصيل" defaultOpen>
        {product.description.split("\n").filter(Boolean).map((line) => <p key={line.slice(0, 40)}>{line}</p>)}
      </Accordion>
      <Accordion title="الاستبدال والإرجاع"><PolicyExcerpt policyKey="returns" fallback="يمكنكِ طلب الاستبدال خلال ثلاثة أيام من الاستلام بشرط بقاء القطعة بحالتها الأصلية." /></Accordion>
      <Accordion title="الشحن والتوصيل"><PolicyExcerpt policyKey="shipping" fallback="نوصّل إلى جميع مناطق الضفة والقدس والداخل، والدفع عند الاستلام." /></Accordion>
      <Accordion title="إلغاء الطلب"><PolicyExcerpt policyKey="cancellation" fallback="يمكنكِ إلغاء الطلب قبل تأكيده عبر واتساب دون أي رسوم." /></Accordion>
      <Accordion title={totalItems ? `التقييمات (${totalItems}) · ${averageRating}/5` : "التقييمات"}>
        <p>{totalItems ? "اطّلعي على تجارب العميلات مع هذه القطعة أسفل الصفحة." : "لا توجد تقييمات لهذه القطعة بعد — كوني الأولى بعد استلام طلبكِ."}</p>
        {totalItems > 0 && <a href="#product-reviews" className="text-link">الانتقال إلى التقييمات <ChevronDown size={14} /></a>}
      </Accordion>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Reviews + related                                                          */
/* -------------------------------------------------------------------------- */

function ProductReviews({ productId }: { productId: string }) {
  const { items, isPending, isError, error, refetch, isRefetching, hasNextPage, fetchNextPage, isFetchingNextPage, averageRating, totalItems } = useReviews({ productId, pageSize: 3 });
  if (!isPending && !isError && items.length === 0) return null;
  return (
    <section className={`container section ${styles.reviews}`} id="product-reviews">
      <SectionHead
        size="compact"
        eyebrow="آراء العميلات"
        title={totalItems ? `${totalItems} تقييمات لهذه القطعة` : "التقييمات"}
        description={averageRating ? <span className={styles.ratingLine}><Star size={14} fill="currentColor" /> {averageRating} من 5</span> : undefined}
      />
      {isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} retrying={isRefetching} />
      ) : isPending ? (
        <SkeletonList rows={2} />
      ) : (
        <>
          <div className={styles.reviewGrid}>{items.map((review) => <ReviewCard review={review} key={review.id} />)}</div>
          {hasNextPage && (
            <div className={styles.moreReviews}>
              <button type="button" className="button secondary small" onClick={() => void fetchNextPage()} disabled={isFetchingNextPage}>
                {isFetchingNextPage ? <Spinner size={14} /> : null} عرض المزيد
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function RelatedProducts({ ids }: { ids: string[] }) {
  const { items, isLoading, error, refetch } = useProductsByIds(ids.slice(0, 4));
  if (!ids.length) return null;
  return (
    <section className={`container section ${styles.related}`}>
      <SectionHead eyebrow="قد يعجبكِ أيضًا" title="قطع تكمل إطلالتكِ" />
      {error ? <ErrorState error={error} onRetry={refetch} /> : isLoading ? <SkeletonProductGrid count={4} /> : <ProductGrid products={items} />}
    </section>
  );
}
