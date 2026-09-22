import { apiClient } from "@/lib/api/client";
import { isMockApi, publicHandlers } from "@/lib/mock/adapter";
import type { ApiSuccess, Category } from "@/types/api.types";

/** `GET /categories` — active categories (main + sub) sorted by `sortOrder`. */
export async function getCategories(signal?: AbortSignal): Promise<Category[]> {
  if (isMockApi) return publicHandlers.getCategories();
  const response = await apiClient.get<ApiSuccess<Category[]>>("/categories", { signal });
  return response.data.data;
}

export function findCategoryBySlug(categories: Category[], slug: string): Category | undefined {
  return categories.find((category) => category.slug === slug);
}

export function getMainCategories(categories: Category[]): Category[] {
  return categories.filter((category) => category.parentId === null);
}

export function getSubCategories(categories: Category[], parentId: string): Category[] {
  return categories.filter((category) => category.parentId === parentId);
}

/** Root → leaf chain for breadcrumbs. */
export function getCategoryPath(categories: Category[], categoryId: string): Category[] {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const path: Category[] = [];
  let current = byId.get(categoryId);
  while (current) {
    path.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return path;
}
