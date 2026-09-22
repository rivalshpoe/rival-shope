import type { Metadata } from "next";
import OtpLogin from "@/components/admin/OtpLogin";

export const metadata: Metadata = { title: "دخول الإدارة" };

export default function AdminLoginPage() {
  return <OtpLogin />;
}
