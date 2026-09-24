"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Check, Eye, Heart, Minus, Plus, ShoppingBag, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useShop } from "@/components/layout/ShopProvider";
import { ErrorState } from "@/components/ui/ErrorState";
import { SmartImage } from "@/components/ui/SmartImage";
import { Spinner } from "@/components/ui/Spinner";
import { getEffectivePrice, toListItem } from "@/lib/api/endpoints/products";
import { MAX_LINE_QUANTITY } from "@/lib/constants/categories";
import { ROUTES } from "@/lib/constants/routes";
import { useProduct } from "@/lib/hooks/queries";
import { swatchInk } from "@/lib/utils/color";
import { formatPrice } from "@/lib/utils/formatCurrency";
import type { ProductDetails, ProductListItem } from "@/types/api.types";
import styles from "./ProductCard.module.css";

type ProductCardProps = {
  product: ProductListItem;
  /** Marks the first above-the-fold card so its image is preloaded. */
  priority?: boolean;
};

export function ProductCard({ product, priority = false }: ProductCardProps) {
  const router = useRouter();
  const shop = useShop();
  const [adding, setAdding] = useState<"cart" | "buy" | null>(null);
  const liked = shop.wishlist.includes(product.id);
  const compared = shop.compare.includes(product.id);
  const price = getEffectivePrice(product);
  const hasDiscount = product.isDiscountActive && product.discountPrice !== null;

  const add = (mode: "cart" | "buy") => {
    if (adding) return;
    // Sized products need a size choice — route through the quick view.
    if (product.hasSizes) {
      shop.setQuickViewId(product.id);
      return;
    }
    setAdding(mode);
    shop.addToCart(product);
    window.setTimeout(() => {
      setAdding(null);
      if (mode === "buy") router.push(ROUTES.checkout);
      else shop.setCartOpen(true);
    }, 320);
  };

  return (
    <article className={styles.card}>
      <div className={styles.media}>
        <Link href={ROUTES.product(product.id)} aria-label={`عرض ${product.title}`} className={styles.mediaLink}>
          <SmartImage src={product.primaryImageUrl} alt={product.title} fill sizes="(max-width: 680px) 50vw, (max-width: 1000px) 33vw, 25vw" priority={priority} />
        </Link>
        {hasDiscount && <span className={styles.badge}>خصم {Math.round(((product.price - price) / product.price) * 100)}%</span>}
        <div className={styles.tools}>
          <button type="button" onClick={() => shop.setQuickViewId(product.id)} aria-label={`معاينة سريعة لـ ${product.title}`}><Eye size={17} /></button>
          <button type="button" className={liked ? styles.selected : ""} onClick={() => shop.toggleWishlist(product.id)} aria-label={liked ? "إزالة من المفضلة" : "إضافة للمفضلة"} aria-pressed={liked}>
            <Heart size={17} fill={liked ? "currentColor" : "none"} />
          </button>
          <button type="button" className={compared ? styles.selected : ""} onClick={() => shop.toggleCompare(product.id)} aria-label={compared ? "إزالة من المقارنة" : "إضافة للمقارنة"} aria-pressed={compared}>
            <ArrowUpRight size={17} />
          </button>
        </div>
      </div>

      <div className={styles.copy}>
        <span className={styles.brand}>{product.brandName ?? "Rival Edit"}</span>
        <h3 className={styles.title}><Link href={ROUTES.product(product.id)}>{product.title}</Link></h3>
        <div className={styles.price}>
          <strong>{formatPrice(price)}</strong>
          {hasDiscount && <del>{formatPrice(product.price)}</del>}
          {product.hasSizes && <small>حسب المقاس</small>}
        </div>
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.addButton} disabled={adding !== null} onClick={() => add("cart")}>
          {adding === "cart" ? <Spinner size={16} tone="inverse" /> : <ShoppingBag size={16} />}
          {adding === "cart" ? "تتم الإضافة..." : product.hasSizes ? "اختاري المقاس" : "أضيفي للحقيبة"}
        </button>
        <button type="button" className={styles.buyButton} disabled={adding !== null} onClick={() => add("buy")}>
          {adding === "buy" ? <Spinner size={14} /> : null} اشترِي الآن
        </button>
      </div>
    </article>
  );
}

export function ProductGrid({ products, priorityCount = 0 }: { products: ProductListItem[]; priorityCount?: number }) {
  return (
    <div className={styles.grid}>
      {products.map((product, index) => <ProductCard product={product} key={product.id} priority={index < priorityCount} />)}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Quick view                                                                 */
/* -------------------------------------------------------------------------- */

export function QuickViewModal() {
  const shop = useShop();
  const id = shop.quickViewId;
  if (!id) return null;
  return (
    <div className="modal-backdrop" data-scroll-lock onMouseDown={() => shop.setQuickViewId(null)} role="presentation">
      <div className={`modal-card ${styles.quick}`} role="dialog" aria-modal="true" aria-labelledby="quick-title" onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className={`icon-button ${styles.quickClose}`} onClick={() => shop.setQuickViewId(null)} aria-label="إغلاق المعاينة"><X /></button>
        <QuickViewContent id={id} />
      </div>
    </div>
  );
}

function QuickViewContent({ id }: { id: string }) {
  const { data, isPending, isError, error, refetch, isRefetching } = useProduct(id);
  if (isPending) {
    return (
      <div className={styles.quickLoading} role="status" aria-live="polite">
        <Spinner size={34} tone="champagne" />
        <span>نجهّز المعاينة...</span>
      </div>
    );
  }
  if (isError || !data) {
    return <div className={styles.quickLoading}><ErrorState error={error} onRetry={() => void refetch()} retrying={isRefetching} /></div>;
  }
  // Keyed by id so option state resets when a different product is previewed.
  return <QuickViewBody key={data.id} product={data} />;
}

function QuickViewBody({ product }: { product: ProductDetails }) {
  const router = useRouter();
  const shop = useShop();
  const listItem = useMemo(() => toListItem(product), [product]);
  const [colorId, setColorId] = useState(product.colors[0]?.id ?? null);
  const [sizeId, setSizeId] = useState(product.sizes.find((size) => size.inStock)?.id ?? null);
  const [quantity, setQuantity] = useState(1);
  const [imageIndex, setImageIndex] = useState(0);
  const [pending, setPending] = useState<"cart" | "buy" | null>(null);

  const selectedSize = product.sizes.find((size) => size.id === sizeId) ?? null;
  const selectedColor = product.colors.find((color) => color.id === colorId) ?? null;
  const unitPrice = selectedSize ? selectedSize.price : getEffectivePrice(product);
  const needsSize = product.sizes.length > 0 && !selectedSize;
  const soldOut = product.sizes.length ? product.sizes.every((size) => !size.inStock) : product.stock <= 0;

  const add = (mode: "cart" | "buy") => {
    if (needsSize || soldOut || pending) return;
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
      shop.setQuickViewId(null);
      if (mode === "buy") router.push(ROUTES.checkout);
      else shop.setCartOpen(true);
    }, 300);
  };

  const image = product.images[imageIndex] ?? product.images[0];

  return (
    <div className={styles.quickGrid}>
      <div className={styles.quickMedia}>
        <div className={styles.quickImage}>
          {image && <SmartImage src={image.url} alt={product.title} fill sizes="(max-width: 700px) 100vw, 50vw" priority />}
        </div>
        {product.images.length > 1 && (
          <div className={styles.quickThumbs}>
            {product.images.map((item, index) => (
              <button type="button" key={item.url} className={index === imageIndex ? styles.thumbActive : ""} onClick={() => setImageIndex(index)} aria-label={`صورة ${index + 1}`}>
                <SmartImage src={item.url} alt="" fill sizes="64px" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className={styles.quickCopy}>
        <span className="eyebrow">{product.brand?.name ?? product.categoryName}</span>
        <h2 id="quick-title" className={styles.quickTitle}>{product.title}</h2>
        <div className={styles.quickPrice}>
          <strong>{formatPrice(unitPrice)}</strong>
          {!selectedSize && product.isDiscountActive && product.discountPrice !== null && <del>{formatPrice(product.price)}</del>}
        </div>
        <p className={styles.quickDescription}>{product.description}</p>

        {product.colors.length > 0 && (
          <div className={styles.option}>
            <strong>اللون{selectedColor ? <span> · {selectedColor.name}</span> : null}</strong>
            <div className={styles.swatches}>
              {product.colors.map((color) => (
                <button type="button" key={color.id} className={colorId === color.id ? styles.chosen : ""} style={{ background: color.hex, color: swatchInk(color.hex) }} onClick={() => setColorId(color.id)} aria-label={color.name} aria-pressed={colorId === color.id}>
                  {colorId === color.id && <Check size={13} />}
                </button>
              ))}
            </div>
          </div>
        )}

        {product.sizes.length > 0 && (
          <div className={styles.option}>
            <strong>المقاس</strong>
            <div className={styles.sizes}>
              {product.sizes.map((size) => (
                <button type="button" key={size.id} className={sizeId === size.id ? styles.chosen : ""} disabled={!size.inStock} onClick={() => setSizeId(size.id)} aria-pressed={sizeId === size.id}>
                  <span>{size.label}</span>
                  <small>{size.inStock ? formatPrice(size.price) : "نفد"}</small>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className={styles.quickActions}>
          <div className={styles.qty} aria-label="الكمية">
            <button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))} aria-label="تقليل الكمية"><Minus size={14} /></button>
            <span>{quantity}</span>
            <button type="button" onClick={() => setQuantity((value) => Math.min(MAX_LINE_QUANTITY, value + 1))} aria-label="زيادة الكمية"><Plus size={14} /></button>
          </div>
          <button type="button" className="button" disabled={needsSize || soldOut || pending !== null} onClick={() => add("cart")}>
            {pending === "cart" ? <Spinner size={16} tone="inverse" /> : <ShoppingBag size={17} />}
            {soldOut ? "غير متوفر حاليًا" : "أضيفي للحقيبة"}
          </button>
        </div>
        <button type="button" className="button secondary block" disabled={needsSize || soldOut || pending !== null} onClick={() => add("buy")}>
          {pending === "buy" ? <Spinner size={16} /> : null} اشترِي الآن
        </button>
        <Link href={ROUTES.product(product.id)} onClick={() => shop.setQuickViewId(null)} className={styles.detailsLink}>عرض جميع التفاصيل</Link>
      </div>
    </div>
  );
}
