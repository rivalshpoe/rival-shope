import type { Metadata } from "next";
import { InventoryPage } from "@/components/admin/InventoryPage";

export const metadata: Metadata = { title: "المخزون" };

export default function Page() {
  return <InventoryPage />;
}
