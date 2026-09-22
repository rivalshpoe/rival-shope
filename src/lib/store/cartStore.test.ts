import { beforeEach, describe, expect, it } from "vitest";
import { mockProducts } from "@/lib/mock/data";
import { useCartStore } from "./cartStore";

describe("cart store", () => {
  beforeEach(() => useCartStore.setState({ items: [] }));

  it("merges identical variants and preserves separate selections", () => {
    const product = mockProducts[0];
    useCartStore.getState().addItem({
      product,
      sizeId: null,
      colorId: "black",
      quantity: 1,
    });
    useCartStore.getState().addItem({
      product,
      sizeId: null,
      colorId: "black",
      quantity: 2,
    });
    useCartStore.getState().addItem({
      product,
      sizeId: null,
      colorId: "ivory",
      quantity: 1,
    });

    expect(useCartStore.getState().items).toHaveLength(2);
    expect(useCartStore.getState().items[0].quantity).toBe(3);
  });
});
