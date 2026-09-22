import type { Metadata } from "next";
import { DevicesPage } from "@/components/admin/DevicesPage";

export const metadata: Metadata = { title: "الأجهزة" };

export default function Page() {
  return <DevicesPage />;
}
