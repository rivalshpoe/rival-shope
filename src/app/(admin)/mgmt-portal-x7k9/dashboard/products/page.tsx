import type { Metadata } from "next";
import { ProductsPage } from "@/components/admin/ProductsPage";

export const metadata: Metadata = { title: "المنتجات" };

export default function Page() {
  return <ProductsPage />;
}
