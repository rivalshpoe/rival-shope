import styles from "./Skeleton.module.css";

type BoxProps = { className?: string; style?: React.CSSProperties };

/** Generic shimmering block. */
export function Skeleton({ className, style }: BoxProps) {
  return <span className={["skeleton", styles.box, className].filter(Boolean).join(" ")} style={style} aria-hidden="true" />;
}

/** Mirrors `ProductCard` proportions. */
export function SkeletonProductCard() {
  return (
    <div className={styles.card} aria-hidden="true">
      <span className={`skeleton ${styles.media}`} />
      <span className={`skeleton ${styles.lineShort}`} />
      <span className={`skeleton ${styles.line}`} />
      <span className={`skeleton ${styles.lineShort}`} />
      <span className={`skeleton ${styles.button}`} />
    </div>
  );
}

/** Grid of card skeletons matching `ProductGrid` breakpoints. */
export function SkeletonProductGrid({ count = 8 }: { count?: number }) {
  return (
    <div className={styles.grid} role="status" aria-label="جارٍ تحميل المنتجات" aria-busy="true">
      {Array.from({ length: count }, (_, index) => <SkeletonProductCard key={index} />)}
    </div>
  );
}

/** Product page skeleton: gallery + info column. */
export function SkeletonProductPage() {
  return (
    <div className={`container ${styles.productPage}`} role="status" aria-label="جارٍ تحميل تفاصيل المنتج" aria-busy="true">
      <div className={styles.gallery}>
        <span className={`skeleton ${styles.mainImage}`} />
        <div className={styles.thumbs}>
          {Array.from({ length: 4 }, (_, index) => <span className={`skeleton ${styles.thumb}`} key={index} />)}
        </div>
      </div>
      <div className={styles.info}>
        <span className={`skeleton ${styles.lineShort}`} />
        <span className={`skeleton ${styles.title}`} />
        <span className={`skeleton ${styles.lineShort}`} />
        <span className={`skeleton ${styles.paragraph}`} />
        <span className={`skeleton ${styles.paragraph}`} />
        <span className={`skeleton ${styles.button}`} />
        <span className={`skeleton ${styles.button}`} />
      </div>
    </div>
  );
}

/** Generic list skeleton (reviews, cart lines, zones...). */
export function SkeletonList({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={[styles.list, className].filter(Boolean).join(" ")} role="status" aria-busy="true" aria-label="جارٍ التحميل">
      {Array.from({ length: rows }, (_, index) => (
        <div className={styles.row} key={index}>
          <span className={`skeleton ${styles.avatar}`} />
          <div className={styles.rowLines}>
            <span className={`skeleton ${styles.line}`} />
            <span className={`skeleton ${styles.lineShort}`} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Category tiles skeleton for the home grid / menus. */
export function SkeletonTiles({ count = 6 }: { count?: number }) {
  return (
    <div className={styles.tiles} role="status" aria-busy="true" aria-label="جارٍ التحميل">
      {Array.from({ length: count }, (_, index) => <span className={`skeleton ${styles.tile}`} key={index} />)}
    </div>
  );
}
