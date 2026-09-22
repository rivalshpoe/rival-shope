import type { Metadata } from "next";
import { OrderDetailPage } from "@/components/admin/OrderDetailPage";

export const metadata: Metadata = { title: "تفاصيل الطلب" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrderDetailPage orderId={id} />;
}
