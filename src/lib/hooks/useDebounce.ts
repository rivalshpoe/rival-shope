"use client";

import { useEffect, useState } from "react";

export function useDebounce<T>(value: T, delayMilliseconds = 300): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedValue(value), delayMilliseconds);
    return () => window.clearTimeout(timer);
  }, [value, delayMilliseconds]);

  return debouncedValue;
}
