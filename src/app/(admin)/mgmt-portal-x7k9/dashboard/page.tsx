import type { Metadata } from "next";
import { DashboardPage } from "@/components/admin/DashboardPage";

export const metadata: Metadata = { title: "نظرة عامة" };

export default function Page() {
  return <DashboardPage />;
}
