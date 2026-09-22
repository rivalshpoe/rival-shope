import type { Metadata } from "next";
import { WishlistPage } from "@/components/product/SavedLists";

export const metadata: Metadata = { title: "المفضلة", robots: { index: false, follow: false } };

export default function Page() {
  return <WishlistPage />;
}
