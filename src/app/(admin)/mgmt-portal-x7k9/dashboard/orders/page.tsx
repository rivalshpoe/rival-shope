import type { Metadata } from "next";
import { OrdersPage } from "@/components/admin/OrdersPage";

export const metadata: Metadata = { title: "الطلبات" };

export default function Page() {
  return <OrdersPage />;
}
