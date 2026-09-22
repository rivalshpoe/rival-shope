import type { Metadata } from "next";
import { DiscountCodesPage } from "@/components/admin/DiscountCodesPage";

export const metadata: Metadata = { title: "أكواد الخصم" };

export default function Page() {
  return <DiscountCodesPage />;
}
