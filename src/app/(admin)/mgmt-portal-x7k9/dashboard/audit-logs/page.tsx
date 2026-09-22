import type { Metadata } from "next";
import { AuditLogsPage } from "@/components/admin/AuditLogsPage";

export const metadata: Metadata = { title: "سجل العمليات" };

export default function Page() {
  return <AuditLogsPage />;
}
