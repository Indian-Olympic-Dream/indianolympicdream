/**
 * Shop types shared across the storefront.
 *
 * Every monetary value here is integer paise, matching the API. Rupees exist
 * only in what `formatPaise` renders.
 */

export interface CatalogueUnit {
  variantId: string | null;
  variantName: string | null;
  unitPricePaise: number;
  availableQuantity: number;
}

export interface CatalogueProduct {
  id: string;
  slug: string;
  title: string;
  type: "infographic" | "merch";
  /** Listed in the shop but not yet on sale. Never purchasable. */
  comingSoon: boolean;
  images: Array<{ url: string | null; alt: string }>;
  metadata: { dimensions?: string; resolution?: string } | null;
  units: CatalogueUnit[];
}

/**
 * A line in the browser's cart.
 *
 * Title and price are kept for display only. They are NOT sent to the server and
 * are not what anyone is charged — checkout sends identifiers and quantities,
 * and the server prices the order itself.
 */
export interface CartItem {
  productId: string;
  variantId: string | null;
  slug: string;
  title: string;
  variantName: string | null;
  unitPricePaise: number;
  quantity: number;
}

export interface CheckoutContact {
  name: string;
  email: string;
  phone: string;
}

export interface CheckoutAddress {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface CheckoutResponse {
  orderNumber: string;
  lookupToken: string;
  razorpayOrderId: string;
  razorpayKeyId: string;
  amountPaise: number;
  currency: string;
  summary: {
    subtotalPaise: number;
    shippingPaise: number;
    taxPaise: number;
    totalPaise: number;
    lines: Array<{
      title: string;
      variantName: string | null;
      unitPricePaise: number;
      quantity: number;
      lineTotalPaise: number;
    }>;
  };
}

export interface OrderView {
  orderNumber: string;
  status: string;
  placedAt: string;
  lines: Array<{
    title: string;
    variantName: string | null;
    unitPricePaise: number;
    quantity: number;
    lineTotalPaise: number;
  }>;
  subtotalPaise: number;
  shippingPaise: number;
  taxPaise: number;
  totalPaise: number;
  currency: string;
  shippingAddress: CheckoutAddress;
  tracking: { courier: string | null; awb: string | null; trackingUrl: string | null };
}
