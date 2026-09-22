import type { Metadata } from "next";
import { CheckoutExperience } from "@/components/checkout/CheckoutExperience";

export const metadata: Metadata = { title: "إتمام الطلب", robots: { index: false, follow: false } };

export default function CheckoutPage() {
  return <CheckoutExperience />;
}
