import type { Metadata } from "next";
import { ProductFormPage } from "@/components/admin/ProductForm";

export const metadata: Metadata = { title: "تعديل المنتج" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProductFormPage productId={id} />;
}
