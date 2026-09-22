"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/ErrorState";

export default function ShopError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Keep diagnostics in the console only — the UI shows customer-safe copy.
    console.error(error);
  }, [error]);

  return (
    <div className="container">
      <ErrorState variant="page" error={error} onRetry={reset} />
    </div>
  );
}
