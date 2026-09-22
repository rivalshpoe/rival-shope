import type { Metadata } from "next";
import { Suspense } from "react";
import { SearchExperience } from "@/components/search/SearchExperience";
import { SectionLoader } from "@/components/ui/Spinner";

export const metadata: Metadata = { title: "البحث", robots: { index: false, follow: true } };

export default function SearchPage() {
  return (
    <Suspense fallback={<SectionLoader />}>
      <SearchExperience />
    </Suspense>
  );
}
