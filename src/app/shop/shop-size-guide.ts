export interface ShopSizeMeasurement {
  readonly size: string;
  readonly length: string;
  readonly shoulder: string;
  readonly chest: string;
  readonly bodyChest: string;
}

/** Garment measurements shared by the product page and storefront size guide. */
export const SHOP_SIZE_GUIDE: readonly ShopSizeMeasurement[] = [
  { size: "M", length: "27", shoulder: "18.5", chest: "20", bodyChest: "40" },
  { size: "L", length: "28", shoulder: "19.5", chest: "21", bodyChest: "42" },
  { size: "XL", length: "29", shoulder: "20.5", chest: "22", bodyChest: "44" },
  { size: "XXL", length: "30", shoulder: "21.5", chest: "23", bodyChest: "46" },
] as const;
