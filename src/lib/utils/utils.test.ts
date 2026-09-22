import { beforeEach, describe, expect, it } from "vitest";
import { formatCurrency } from "./formatCurrency";
import { formatPhone, normalizePhoneNumber } from "./formatPhone";
import { safeGetJson, safeSetJson } from "./safeStorage";

describe("Rival utilities", () => {
  beforeEach(() => window.localStorage.clear());

  it("normalizes Palestinian phone numbers", () => {
    expect(normalizePhoneNumber("0599 123-456")).toBe("599123456");
    expect(formatPhone("0599123456", "970")).toBe("+970599123456");
  });

  it("persists JSON without exposing storage errors", () => {
    safeSetJson("rival-test", { items: 2 });
    expect(safeGetJson("rival-test", { items: 0 })).toEqual({ items: 2 });
  });

  it("returns a localized currency label", () => {
    expect(formatCurrency(249)).toMatch(/₪|ILS/);
  });
});
