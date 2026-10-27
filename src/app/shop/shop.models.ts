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
 * are not what anyone is charged. Checkout sends identifiers and quantities,
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
  /** Display-only catalogue snapshot. Neither field is sent to checkout. */
  imageUrl?: string | null;
  imageAlt?: string;
  /** Advisory client-side cap. The server always re-checks live availability. */
  availableQuantity?: number;
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

export interface PincodeLookup {
  found: boolean;
  city?: string;
  district?: string;
  state?: string;
  postOffices?: string[];
  unavailable?: boolean;
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
    discountPaise: number;
    promotionCode: string | null;
    promotionLabel: string | null;
    shippingPaise: number;
    shippingSource?: "shiprocket" | "fallback" | null;
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

/** The server's delivery quote for a PIN code. Display only: checkout re-quotes. */
export interface ShippingQuoteResponse {
  serviceable: boolean;
  shippingPaise?: number;
  /** "fallback" means the flat charge, used when the live courier rate was unavailable. */
  source?: "shiprocket" | "fallback";
  courier?: string | null;
  error?: string;
}

export interface OrderView {
  orderNumber: string;
  status: string;
  /** Separate from status: a partly refunded order is still being fulfilled. */
  refundState?: "none" | "partially_refunded" | "refunded";
  refundedPaise?: number;
  placedAt: string;
  lines: Array<{
    title: string;
    variantName: string | null;
    unitPricePaise: number;
    quantity: number;
    lineTotalPaise: number;
  }>;
  subtotalPaise: number;
  discountPaise: number;
  promotionCode: string | null;
  promotionLabel: string | null;
  shippingPaise: number;
  taxPaise: number;
  totalPaise: number;
  currency: string;
  shippingAddress: CheckoutAddress;
  tracking: { courier: string | null; awb: string | null; trackingUrl: string | null };
}
