import type { Metadata } from "next";
import { PolicyRoute, policyMetadata } from "@/components/ui/PolicyRoute";

export const revalidate = 60;

export function generateMetadata(): Promise<Metadata> {
  return policyMetadata("returns");
}

export default function ReturnsPolicyPage() {
  return <PolicyRoute policyKey="returns" />;
}
