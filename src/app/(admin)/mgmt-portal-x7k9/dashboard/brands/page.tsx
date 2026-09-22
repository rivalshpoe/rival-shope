import type { Metadata } from "next";
import { BrandsPage } from "@/components/admin/BrandsPage";

export const metadata: Metadata = { title: "الماركات" };

export default function Page() {
  return <BrandsPage />;
}
