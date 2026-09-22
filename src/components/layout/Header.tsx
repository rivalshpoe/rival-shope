"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, Heart, Home, LayoutGrid, Menu, Scale, Search, ShoppingBag, WifiOff, X } from "lucide-react";
import { useBrands, useCategoryTree } from "@/lib/hooks/queries";
import { useOnlineStatus } from "@/lib/hooks/useOnlineStatus";
import { ROUTES } from "@/lib/constants/routes";
import { SmartImage } from "@/components/ui/SmartImage";
import { Skeleton } from "@/components/ui/Skeleton";
import { useShop } from "./ShopProvider";
import styles from "./Header.module.css";

const LOGO = "/brand/rival-logo.png";
const LOGO_SMALL = "/brand/rival-logo-sm.webp";
const LOGO_RATIO = { width: 1178, height: 591 };

function Count({ value }: { value: number }) {
  if (value <= 0) return null;
  return <span className={styles.count} aria-label={`${value} عناصر`}>{value > 9 ? "9+" : value}</span>;
}

export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div className={styles.offline} role="status" aria-live="assertive">
      <WifiOff size={14} /> لا يوجد اتصال بالإنترنت — نحتفظ باختياراتكِ حتى يعود الاتصال
    </div>
  );
}

export function Header() {
  const pathname = usePathname();
  const shop = useShop();
  const { tree, isPending } = useCategoryTree();
  const mainCategories = tree.slice(0, 4);
  const { setMenuOpen, setBrandOpen } = shop;

  useEffect(() => {
    // Close overlays whenever the route changes.
    setMenuOpen(false);
    setBrandOpen(false);
  }, [pathname, setMenuOpen, setBrandOpen]);

  return (
    <>
      <OfflineBanner />
      <header className={styles.header}>
        <div className={`${styles.bar} glass`}>
          <div className={styles.start}>
            <button type="button" className={`icon-button ${styles.mobileOnly}`} onClick={() => shop.setMenuOpen(true)} aria-label="فتح القائمة" aria-expanded={shop.menuOpen}>
              <Menu size={20} />
            </button>
            <nav className={styles.nav} aria-label="التنقل الرئيسي">
              <Link className={pathname === ROUTES.products ? styles.active : ""} href={ROUTES.products}>المتجر</Link>
              {isPending
                ? Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className={styles.navSkeleton} />)
                : mainCategories.map((category) => (
                    <Link
                      key={category.id}
                      href={ROUTES.category(category.slug)}
                      className={pathname.startsWith(ROUTES.category(category.slug)) ? styles.active : ""}
                    >
                      {category.name}
                    </Link>
                  ))}
              <BrandMenuTrigger />
            </nav>
          </div>

          <Link href={ROUTES.home} className={styles.logo} aria-label="ريفال - الرئيسية">
            <SmartImage src={LOGO} alt="Rival" width={LOGO_RATIO.width} height={LOGO_RATIO.height} sizes="190px" priority />
          </Link>

          <div className={styles.end}>
            <Link className={`icon-button ${styles.desktopOnly}`} href={ROUTES.search} aria-label="البحث"><Search size={19} /></Link>
            <Link className={`icon-button ${styles.desktopOnly} ${styles.relative}`} href={ROUTES.wishlist} aria-label="المفضلة">
              <Heart size={19} /><Count value={shop.wishlist.length} />
            </Link>
            <Link className={`icon-button ${styles.desktopOnly} ${styles.relative}`} href={ROUTES.compare} aria-label="المقارنة">
              <Scale size={19} /><Count value={shop.compare.length} />
            </Link>
            <button type="button" className={`icon-button ${styles.relative}`} onClick={() => shop.setCartOpen(true)} aria-label="فتح الحقيبة">
              <ShoppingBag size={19} /><Count value={shop.cartCount} />
            </button>
          </div>
        </div>
        <BrandMegaMenu />
      </header>
      <MobileDrawer />
      <MobileNavigation />
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  Brands mega menu                                                           */
/* -------------------------------------------------------------------------- */

function BrandMenuTrigger() {
  const { brandOpen, setBrandOpen } = useShop();
  return (
    <button
      type="button"
      className={`${styles.navButton} ${brandOpen ? styles.active : ""}`}
      onClick={() => setBrandOpen(!brandOpen)}
      onMouseEnter={() => setBrandOpen(true)}
      aria-expanded={brandOpen}
      aria-controls="brand-mega-menu"
      aria-haspopup="true"
    >
      الماركات <ChevronDown size={14} className={styles.chevron} />
    </button>
  );
}

function BrandMegaMenu() {
  const { brandOpen, setBrandOpen } = useShop();
  const { data: brands, isPending, isError } = useBrands();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!brandOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) setBrandOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [brandOpen, setBrandOpen]);

  return (
    <div
      id="brand-mega-menu"
      ref={panelRef}
      className={`${styles.mega} ${brandOpen ? styles.megaOpen : ""}`}
      onMouseLeave={() => setBrandOpen(false)}
      aria-hidden={!brandOpen}
    >
      <div className={styles.megaInner}>
        <div className={styles.megaHead}>
          <div>
            <span className="eyebrow">دليل الماركات</span>
            <h2>أسماء صنعت الأناقة</h2>
          </div>
          <Link href={ROUTES.products} className="text-link" onClick={() => setBrandOpen(false)}>كل المنتجات <ChevronLeft size={14} /></Link>
        </div>
        {isError ? (
          <p className={styles.megaEmpty}>تعذّر تحميل الماركات حاليًا.</p>
        ) : (
          <div className={styles.brandGrid}>
            {isPending
              ? Array.from({ length: 8 }, (_, index) => <Skeleton key={index} className={styles.brandSkeleton} />)
              : brands?.map((brand) => (
                  <Link href={ROUTES.brand(brand.slug)} key={brand.id} className={styles.brandCard} onClick={() => setBrandOpen(false)} tabIndex={brandOpen ? 0 : -1}>
                    <SmartImage src={brand.imageUrl} alt="" fill sizes="(max-width: 900px) 40vw, 16vw" />
                    <span>{brand.name}</span>
                  </Link>
                ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Mobile drawer                                                              */
/* -------------------------------------------------------------------------- */

function MobileDrawer() {
  const { menuOpen, setMenuOpen } = useShop();
  const { tree, isPending } = useCategoryTree();
  const { data: brands } = useBrands();
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!menuOpen) return null;
  return (
    <div className="drawer-backdrop" data-scroll-lock onMouseDown={() => setMenuOpen(false)}>
      <aside className={`drawer ${styles.drawer}`} role="dialog" aria-modal="true" aria-label="قائمة الموقع" onMouseDown={(event) => event.stopPropagation()}>
        <div className="drawer-head">
          <Link href={ROUTES.home} className={styles.drawerLogo} onClick={() => setMenuOpen(false)} aria-label="ريفال - الرئيسية">
            <SmartImage src={LOGO_SMALL} alt="Rival" width={LOGO_RATIO.width} height={LOGO_RATIO.height} sizes="120px" />
          </Link>
          <button type="button" className="icon-button" onClick={() => setMenuOpen(false)} aria-label="إغلاق القائمة"><X size={19} /></button>
        </div>

        <nav className={styles.drawerNav} aria-label="أقسام المتجر">
          <Link href={ROUTES.products} onClick={() => setMenuOpen(false)}>كل المنتجات <ChevronLeft size={18} /></Link>
          {isPending
            ? Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className={styles.drawerSkeleton} />)
            : tree.map((category) => (
                <div key={category.id} className={styles.drawerGroup}>
                  <div className={styles.drawerRow}>
                    <Link href={ROUTES.category(category.slug)} onClick={() => setMenuOpen(false)}>{category.name}</Link>
                    {category.children.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setExpanded(expanded === category.id ? null : category.id)}
                        aria-expanded={expanded === category.id}
                        aria-label={`عرض أقسام ${category.name}`}
                      >
                        <ChevronDown size={16} className={expanded === category.id ? styles.rotated : ""} />
                      </button>
                    )}
                  </div>
                  {expanded === category.id && (
                    <div className={styles.drawerChildren}>
                      {category.children.map((child) => (
                        <Link key={child.id} href={ROUTES.subCategory(category.slug, child.slug)} onClick={() => setMenuOpen(false)}>{child.name}</Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
        </nav>

        {brands && brands.length > 0 && (
          <div className={styles.drawerBrands}>
            <span className="eyebrow">الماركات</span>
            <div>
              {brands.map((brand) => (
                <Link href={ROUTES.brand(brand.slug)} key={brand.id} onClick={() => setMenuOpen(false)}>{brand.name}</Link>
              ))}
            </div>
          </div>
        )}

        <div className={styles.drawerFooter}>
          <Link href={ROUTES.wishlist} onClick={() => setMenuOpen(false)}><Heart size={16} /> المفضلة</Link>
          <Link href={ROUTES.compare} onClick={() => setMenuOpen(false)}><Scale size={16} /> المقارنة</Link>
        </div>
      </aside>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Mobile bottom navigation                                                   */
/* -------------------------------------------------------------------------- */

function MobileNavigation() {
  const pathname = usePathname();
  const { cartCount, wishlist } = useShop();
  const items = [
    { href: ROUTES.home, label: "الرئيسية", icon: Home, count: 0 },
    { href: ROUTES.products, label: "المتجر", icon: LayoutGrid, count: 0 },
    { href: ROUTES.search, label: "البحث", icon: Search, count: 0 },
    { href: ROUTES.wishlist, label: "المفضلة", icon: Heart, count: wishlist.length },
    { href: ROUTES.cart, label: "الحقيبة", icon: ShoppingBag, count: cartCount },
  ];
  return (
    <nav className={`${styles.bottomNav} glass`} aria-label="التنقل السريع">
      {items.map(({ href, label, icon: Icon, count }) => (
        <Link href={href} key={href} className={pathname === href ? styles.bottomActive : ""} aria-current={pathname === href ? "page" : undefined}>
          <span className={styles.relative}><Icon size={19} /><Count value={count} /></span>
          <small>{label}</small>
        </Link>
      ))}
    </nav>
  );
}
