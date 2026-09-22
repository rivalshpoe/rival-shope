import type { Metadata } from "next";
import { DeliveryZonesPage } from "@/components/admin/DeliveryZonesPage";

export const metadata: Metadata = { title: "مناطق التوصيل" };

export default function Page() {
  return <DeliveryZonesPage />;
}
