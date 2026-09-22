"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { LoadMore } from "@/components/home/HomeExperience";
import { ProductGrid } from "@/components/product/ProductCard";
import { ErrorState } from "@/components/ui/ErrorState";
import { SectionHead } from "@/components/ui/SectionHead";
import { SkeletonProductGrid } from "@/components/ui/Skeleton";
import { Spinner } from "@/components/ui/Spinner";
import { SEARCH_MAX_LENGTH } from "@/lib/api/endpoints/search";
import { ROUTES } from "@/lib/constants/routes";
import { useCategoryTree, useSearch } from "@/lib/hooks/queries";
import { useDebounce } from "@/lib/hooks/useDebounce";
import styles from "./SearchExperience.module.css";

const SUGGESTIONS = ["حقيبة كتف", "نظارة شمسية", "مشد", "حرير", "Gucci", "Prada"];

export function SearchExperience() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initial = searchParams.get("q") ?? "";
  const [value, setValue] = useState(initial);
  const debounced = useDebounce(value.trim(), 350);
  const search = useSearch(debounced);
  const { tree } = useCategoryTree();

  useEffect(() => {
    // Keep the URL shareable without pushing history for every keystroke.
    const current = searchParams.get("q") ?? "";
    if (debounced === current) return;
    router.replace(debounced ? `${pathname}?q=${encodeURIComponent(debounced)}` : pathname, { scroll: false });
  }, [debounced, pathname, router, searchParams]);

  const progress = search.totalItems ? Math.min(100, Math.round((search.items.length / search.totalItems) * 100)) : 0;
  const searching = debounced.length > 0;
  const waitingForDebounce = value.trim() !== debounced;

  return (
    <div className={`container ${styles.page}`}>
      <div className="page-hero">
        <SectionHead as="h1" eyebrow="ابحثي" title="ما الذي تبحثين عنه اليوم؟" description="اكتبي اسم القطعة، الماركة أو القسم، ونعرض لكِ النتائج فورًا." />
      </div>

      <form className={styles.form} role="search" onSubmit={(event) => event.preventDefault()}>
        <Search size={20} className={styles.icon} aria-hidden="true" />
        <input
          type="search"
          className={styles.input}
          value={value}
          maxLength={SEARCH_MAX_LENGTH}
          autoFocus
          placeholder="ابحثي عن حقيبة، نظارة، ماركة..."
          aria-label="البحث في المتجر"
          onChange={(event) => setValue(event.target.value)}
        />
        {(waitingForDebounce || (search.isFetching && !search.isFetchingNextPage)) && searching && <Spinner size={18} className={styles.spinner} />}
        {value && <button type="button" className={styles.clear} onClick={() => setValue("")} aria-label="مسح البحث"><X size={16} /></button>}
      </form>

      {!searching ? (
        <div className={styles.idle}>
          <div className={styles.chips}>
            {SUGGESTIONS.map((suggestion) => <button type="button" key={suggestion} onClick={() => setValue(suggestion)}>{suggestion}</button>)}
          </div>
          {tree.length > 0 && (
            <div className={styles.quickLinks}>
              <span className="eyebrow">أو تصفّحي الأقسام</span>
              <div>{tree.map((category) => <Link href={ROUTES.category(category.slug)} key={category.id}>{category.name}</Link>)}</div>
            </div>
          )}
        </div>
      ) : search.isError ? (
        <ErrorState error={search.error} onRetry={() => void search.refetch()} retrying={search.isRefetching} />
      ) : search.isPending ? (
        <SkeletonProductGrid count={4} />
      ) : search.items.length === 0 ? (
        <div className="empty-state">
          <Search size={36} strokeWidth={1.2} />
          <h2>لا نتائج لـ «{debounced}»</h2>
          <p>جرّبي كلمة أقصر أو اسم الماركة، أو تصفّحي كل المنتجات.</p>
          <Link className="button" href={ROUTES.products}>كل المنتجات</Link>
        </div>
      ) : (
        <>
          <p className={styles.count}>{search.totalItems} نتيجة لـ «{debounced}»</p>
          <ProductGrid products={search.items} />
          <LoadMore shown={search.items.length} total={search.totalItems} progress={progress} hasMore={Boolean(search.hasNextPage)} loading={search.isFetchingNextPage} onLoad={() => void search.fetchNextPage()} />
        </>
      )}
    </div>
  );
}
