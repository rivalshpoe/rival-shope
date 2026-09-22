import type { MetadataRoute } from "next";
import { getCategories } from "@/lib/api/endpoints/categories";
import { getProducts } from "@/lib/api/endpoints/products";
import { POLICY_ROUTES, ROUTES } from "@/lib/constants/routes";
import type { Category, ProductListItem } from "@/types/api.types";

const baseUrl = "https://rival.ps";

async function loadCatalog(): Promise<{ categories: Category[]; products: ProductListItem[] }> {
  try {
    const [categories, firstPage] = await Promise.all([getCategories(), getProducts({ page: 1, pageSize: 100 })]);
    const products = [...firstPage.items];
    for (let page = 2; page <= firstPage.pagination.totalPages && page <= 10; page += 1) {
      const next = await getProducts({ page, pageSize: 100 });
      products.push(...next.items);
    }
    return { categories, products };
  } catch {
    return { categories: [], products: [] };
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const { categories, products } = await loadCatalog();
  const byId = new Map(categories.map((category) => [category.id, category]));

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${baseUrl}${ROUTES.home}`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${baseUrl}${ROUTES.products}`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}${ROUTES.search}`, lastModified: now, changeFrequency: "weekly", priority: 0.5 },
    ...Object.values(POLICY_ROUTES).map((route) => ({
      url: `${baseUrl}${route}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.4,
    })),
  ];

  const categoryRoutes: MetadataRoute.Sitemap = categories.map((category) => {
    const parent = category.parentId ? byId.get(category.parentId) : undefined;
    return {
      url: `${baseUrl}${parent ? ROUTES.subCategory(parent.slug, category.slug) : ROUTES.category(category.slug)}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: parent ? 0.7 : 0.8,
    };
  });

  const productRoutes: MetadataRoute.Sitemap = products.map((product) => ({
    url: `${baseUrl}${ROUTES.product(product.id)}`,
    lastModified: now,
    changeFrequency: "daily",
    priority: 0.8,
  }));

  return [...staticRoutes, ...categoryRoutes, ...productRoutes];
}
