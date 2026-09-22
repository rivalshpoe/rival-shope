import type { Metadata } from "next";
import { Suspense } from "react";
import { CatalogExperience } from "@/components/product/CatalogExperience";
import { SkeletonProductGrid } from "@/components/ui/Skeleton";

export const metadata: Metadata = {
  title: "المتجر",
  description: "تصفّحي جميع اختيارات ريفال: حقائب، نظارات، مشدات كولومبية، إكسسوارات وحرير.",
};
export const revalidate = 60;

export default function ProductsPage() {
  return (
    <Suspense fallback={<div className="container section"><SkeletonProductGrid /></div>}>
      <CatalogExperience />
    </Suspense>
  );
}
