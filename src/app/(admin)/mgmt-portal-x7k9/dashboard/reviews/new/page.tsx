import type { Metadata } from "next";
import { ReviewFormPage } from "@/components/admin/ReviewForm";

export const metadata: Metadata = { title: "تقييم جديد" };

export default function Page() {
  return <ReviewFormPage />;
}
