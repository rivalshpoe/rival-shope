import type { Metadata } from "next";
import { CollectionsPage } from "@/components/admin/CollectionsPage";

export const metadata: Metadata = { title: "تحصيل الفواتير" };

export default function Page() {
  return <CollectionsPage />;
}
