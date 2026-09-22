import type { Metadata } from "next";
import { ReviewsPage } from "@/components/admin/ReviewsPage";

export const metadata: Metadata = { title: "التقييمات" };

export default function Page() {
  return <ReviewsPage />;
}
