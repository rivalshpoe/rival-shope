import type { Metadata } from "next";
import { CategoriesPage } from "@/components/admin/CategoriesPage";

export const metadata: Metadata = { title: "الأقسام" };

export default function Page() {
  return <CategoriesPage />;
}
