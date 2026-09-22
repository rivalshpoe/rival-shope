const currencyFormatter = new Intl.NumberFormat("ar-PS", {
  style: "currency",
  currency: "ILS",
  minimumFractionDigits: 2,
});

export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

const priceFormatter = new Intl.NumberFormat("ar-PS", {
  style: "currency",
  currency: "ILS",
  maximumFractionDigits: 0,
});

/** Storefront price label without decimals (e.g. "‏480 ₪"). */
export function formatPrice(value: number): string {
  return priceFormatter.format(value);
}
