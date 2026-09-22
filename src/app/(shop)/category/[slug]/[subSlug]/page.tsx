import type { Metadata } from "next";
import { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { CatalogExperience } from "@/components/product/CatalogExperience";
import { SkeletonProductGrid } from "@/components/ui/Skeleton";
import { findCategoryBySlug, getCategories } from "@/lib/api/endpoints/categories";
import { queryKeys } from "@/lib/constants/query";
import { getQueryClient } from "@/providers/queryClient";

type Props = { params: Promise<{ slug: string; subSlug: string }> };

export const revalidate = 60;

async function loadCategories() {
  const queryClient = getQueryClient();
  const categories = await queryClient.fetchQuery({ queryKey: queryKeys.categories, queryFn: () => getCategories() }).catch(() => []);
  return { queryClient, categories };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, subSlug } = await params;
  const { categories } = await loadCategories();
  const parent = findCategoryBySlug(categories, slug);
  const child = findCategoryBySlug(categories, subSlug);
  return {
    title: child && parent ? `${child.name} · ${parent.name}` : (child?.name ?? "القسم"),
    description: child ? `${child.productCount} قطعة في ${child.name} من ريفال.` : "مجموعة مختارة بعناية من ريفال.",
    openGraph: child ? { images: [child.imageUrl] } : undefined,
  };
}

export default async function SubCategoryPage({ params }: Props) {
  const { slug, subSlug } = await params;
  const { queryClient } = await loadCategories();
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense fallback={<div className="container section"><SkeletonProductGrid /></div>}>
        <CatalogExperience categorySlug={slug} subCategorySlug={subSlug} />
      </Suspense>
    </HydrationBoundary>
  );
}
