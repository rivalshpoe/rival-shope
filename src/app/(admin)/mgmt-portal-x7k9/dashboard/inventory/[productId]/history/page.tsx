import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminSkeleton } from "@/components/admin/AdminFeedback";
import { InventoryHistoryPage } from "@/components/admin/InventoryHistoryPage";

export const metadata: Metadata = { title: "سجل المخزون" };

export default async function Page({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  return (
    <Suspense fallback={<AdminSkeleton variant="detail" rows={2} />}>
      <InventoryHistoryPage productId={productId} />
    </Suspense>
  );
}
