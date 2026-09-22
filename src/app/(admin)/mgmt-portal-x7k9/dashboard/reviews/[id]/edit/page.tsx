import type { Metadata } from "next";
import { ReviewFormPage } from "@/components/admin/ReviewForm";

export const metadata: Metadata = { title: "تعديل التقييم" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReviewFormPage reviewId={id} />;
}
