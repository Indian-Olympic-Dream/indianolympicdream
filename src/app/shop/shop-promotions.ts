import { CartItem } from "./shop.models";

export const FIRST_DROP = {
  code: "FIRST_DROP_999",
  label: "First Drop offer",
  productSlugs: ["the-golden-shot-tee", "the-golden-throw-tee"] as const,
  pairPricePaise: 99_900,
} as const;

/** Advisory storefront preview. Checkout always recomputes this on the server. */
export function firstDropDiscountFor(items: CartItem[]): number {
  const pair = FIRST_DROP.productSlugs.map((slug) =>
    items.find((item) => item.slug === slug && item.quantity > 0),
  );
  if (pair.some((item) => !item)) return 0;

  const cataloguePricePaise = pair.reduce(
    (total, item) => total + (item?.unitPricePaise ?? 0),
    0,
  );
  return Math.max(0, cataloguePricePaise - FIRST_DROP.pairPricePaise);
}
