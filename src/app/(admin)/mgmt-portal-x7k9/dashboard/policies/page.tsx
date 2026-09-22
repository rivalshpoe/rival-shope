import type { Metadata } from "next";
import { PoliciesPage } from "@/components/admin/PoliciesPage";

export const metadata: Metadata = { title: "السياسات" };

export default function Page() {
  return <PoliciesPage />;
}
