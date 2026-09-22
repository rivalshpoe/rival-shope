import type { Metadata } from "next";
import { PolicyRoute, policyMetadata } from "@/components/ui/PolicyRoute";

export const revalidate = 60;

export function generateMetadata(): Promise<Metadata> {
  return policyMetadata("cancellation");
}

export default function CancellationPolicyPage() {
  return <PolicyRoute policyKey="cancellation" />;
}
