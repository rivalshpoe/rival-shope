"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CopyInvoiceButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard unavailable (insecure context / permissions) — nothing to surface to the customer.
    }
  };
  return (
    <button type="button" className="icon-button" onClick={() => void copy()} aria-label={copied ? "تم النسخ" : "نسخ رقم الطلب"}>
      {copied ? <Check size={16} /> : <Copy size={16} />}
    </button>
  );
}
