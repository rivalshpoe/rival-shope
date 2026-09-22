import type { Metadata } from "next";
import { CartPage } from "@/components/cart/CartExperience";

export const metadata: Metadata = { title: "حقيبة التسوق", robots: { index: false, follow: false } };

export default function Page() {
  return <CartPage />;
}
