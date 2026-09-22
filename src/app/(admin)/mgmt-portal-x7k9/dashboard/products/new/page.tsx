import type { Metadata } from "next";
import { ProductFormPage } from "@/components/admin/ProductForm";

export const metadata: Metadata = { title: "إضافة منتج" };

export default function Page() {
  return <ProductFormPage />;
}
