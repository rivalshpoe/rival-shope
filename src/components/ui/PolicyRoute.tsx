import type { Metadata } from "next";
import { getPolicy } from "@/lib/api/endpoints/policies";
import type { Policy, PolicyKey } from "@/types/api.types";
import { PolicyPage } from "./PolicyPage";

const FALLBACK_TITLES: Record<PolicyKey, string> = {
  order: "سياسة الطلب والتوصيل",
  cancellation: "سياسة إلغاء الطلب",
  returns: "سياسة الاستبدال والإرجاع",
  shipping: "سياسة الشحن والتوصيل",
  privacy: "سياسة الخصوصية",
};

async function loadPolicy(key: PolicyKey): Promise<Policy | undefined> {
  try {
    return await getPolicy(key);
  } catch {
    return undefined; // the client component retries and shows ErrorState
  }
}

/** Metadata for a policy route (server). */
export async function policyMetadata(key: PolicyKey): Promise<Metadata> {
  const policy = await loadPolicy(key);
  const firstParagraph = policy?.content.split(/\n{2,}/).find((block) => block.trim() && !block.startsWith("## "));
  return {
    title: policy?.title ?? FALLBACK_TITLES[key],
    description: firstParagraph?.trim().slice(0, 160) ?? "سياسات ريفال الواضحة لتجربة تسوّق مطمئنة.",
  };
}

/** Server wrapper: fetches the policy (ISR) and hands it to the client `PolicyPage`. */
export async function PolicyRoute({ policyKey }: { policyKey: PolicyKey }) {
  const policy = await loadPolicy(policyKey);
  return <PolicyPage policyKey={policyKey} initialPolicy={policy} />;
}
