import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  if (!cookieStore.get("rival_admin_session")) {
    redirect("/mgmt-portal-x7k9");
  }
  return <AdminShell>{children}</AdminShell>;
}
