"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getCategories, getCategoryPath, getMainCategories, getSubCategories } from "@/lib/api/endpoints/categories";
import { queryKeys, STALE_TIMES } from "@/lib/constants/query";
import type { Category } from "@/types/api.types";

export const categoriesQueryOptions = {
  queryKey: queryKeys.categories,
  queryFn: ({ signal }: { signal: AbortSignal }) => getCategories(signal),
  staleTime: STALE_TIMES.categories,
};

/** All active categories (main + sub). */
export function useCategories() {
  return useQuery(categoriesQueryOptions);
}

export interface CategoryTreeNode extends Category {
  children: Category[];
}

/** Main categories with their children attached, ready for menus and grids. */
export function useCategoryTree() {
  const query = useCategories();
  const tree = useMemo<CategoryTreeNode[]>(() => {
    const categories = query.data ?? [];
    return getMainCategories(categories)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((category) => ({
        ...category,
        children: getSubCategories(categories, category.id).sort((a, b) => a.sortOrder - b.sortOrder),
      }));
  }, [query.data]);
  return { ...query, tree };
}

/** Resolves a category by slug together with its breadcrumb path and children. */
export function useCategoryBySlug(slug: string | undefined) {
  const query = useCategories();
  const resolved = useMemo(() => {
    const categories = query.data ?? [];
    const category = slug ? categories.find((candidate) => candidate.slug === slug) : undefined;
    return {
      category,
      path: category ? getCategoryPath(categories, category.id) : [],
      children: category ? getSubCategories(categories, category.id) : [],
    };
  }, [query.data, slug]);
  return { ...query, ...resolved };
}
