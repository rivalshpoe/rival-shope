import type { Metadata } from "next";
import { ComparePage } from "@/components/product/SavedLists";

export const metadata: Metadata = { title: "مقارنة المنتجات", robots: { index: false, follow: false } };

export default function Page() {
  return <ComparePage />;
}
