import { Injectable, PLATFORM_ID, computed, inject, signal } from "@angular/core";
import { isPlatformBrowser } from "@angular/common";
import { CartItem, CatalogueProduct, CatalogueUnit } from "./shop.models";
import { firstDropDiscountFor } from "./shop-promotions";

const STORAGE_KEY = "iod.shop.cart.v1";
const PENDING_CHECKOUT_KEY = "iod.shop.pendingCheckout.v1";

/**
 * The cart, held in the browser.
 *
 * There are no customer accounts, so there is nothing on the server to attach a
 * cart to. It lives in `localStorage`, survives a refresh, and never reaches the
 * server except as identifiers and quantities at checkout.
 *
 * ⚠️ Every storage access is wrapped: `localStorage` throws in a private window
 * with site data blocked, and it is absent entirely during server-side
 * rendering. A cart that cannot be saved must still work for the session, not
 * take the page down.
 */
@Injectable({ providedIn: "root" })
export class CartService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser: boolean = isPlatformBrowser(this.platformId);

  private readonly itemsSignal = signal<CartItem[]>(this.load());

  readonly items = this.itemsSignal.asReadonly();

  readonly count = computed(() =>
    this.itemsSignal().reduce((total, item) => total + item.quantity, 0),
  );

  /** Advisory only. The server decides what is actually charged. */
  readonly subtotalPaise = computed(() =>
    this.itemsSignal().reduce((total, item) => total + item.unitPricePaise * item.quantity, 0),
  );

  /** Advisory preview. The server independently applies and snapshots the offer. */
  readonly discountPaise = computed(() => firstDropDiscountFor(this.itemsSignal()));

  readonly merchandiseTotalPaise = computed(() =>
    this.subtotalPaise() - this.discountPaise(),
  );

  private keyOf(productId: string, variantId: string | null): string {
    return `${productId}::${variantId ?? ""}`;
  }

  add(product: CatalogueProduct, unit: CatalogueUnit, quantity = 1): void {
    if (!Number.isInteger(quantity) || quantity < 1) return
    /* A product that has not launched can never enter the cart, even if a
     * component forgets to disable its button. The server refuses it too. */
    if (product.comingSoon) return;

    const key: string = this.keyOf(product.id, unit.variantId);
    const existing = this.itemsSignal().find(
      (item) => this.keyOf(item.productId, item.variantId) === key,
    );

    const alreadyHeld: number = existing?.quantity ?? 0;
    /* Clamp to what the catalogue says is available. The server checks again at
     * checkout. This only avoids letting someone fill a cart that is certain to
     * be rejected. */
    const room: number = Math.max(0, unit.availableQuantity - alreadyHeld);
    const toAdd: number = Math.min(quantity, room);
    if (toAdd === 0) return;

    if (existing) {
      this.setQuantity(product.id, unit.variantId, existing.quantity + toAdd);
      return;
    }

    this.commit([
      ...this.itemsSignal(),
      {
        productId: product.id,
        variantId: unit.variantId,
        slug: product.slug,
        title: product.title,
        variantName: unit.variantName,
        unitPricePaise: unit.unitPricePaise,
        quantity: toAdd,
        imageUrl: product.images.find((image) => image.url)?.url ?? null,
        imageAlt: product.images.find((image) => image.url)?.alt ?? product.title,
        availableQuantity: unit.availableQuantity,
      },
    ]);
  }

  setQuantity(productId: string, variantId: string | null, quantity: number): void {
    if (!Number.isInteger(quantity)) return;
    if (quantity < 1) {
      this.remove(productId, variantId);
      return;
    }

    const key: string = this.keyOf(productId, variantId);
    this.commit(
      this.itemsSignal().map((item) =>
        this.keyOf(item.productId, item.variantId) === key
          ? {
              ...item,
              quantity:
                typeof item.availableQuantity === "number"
                  ? Math.min(quantity, item.availableQuantity)
                  : quantity,
            }
          : item,
      ),
    );
  }

  remove(productId: string, variantId: string | null): void {
    const key: string = this.keyOf(productId, variantId);
    this.commit(
      this.itemsSignal().filter((item) => this.keyOf(item.productId, item.variantId) !== key),
    );
  }

  clear(): void {
    this.commit([]);
  }

  /** Remember which order may clear this cart after Razorpay returns. */
  markCheckoutStarted(lookupToken: string): void {
    if (!this.isBrowser) return;
    try {
      sessionStorage.setItem(PENDING_CHECKOUT_KEY, lookupToken);
    } catch {
      /* A blocked session store should not prevent payment. */
    }
  }

  /** Clear only the cart that created this order, never a later shopping session. */
  completeCheckout(lookupToken: string): void {
    if (!this.isBrowser) return;
    try {
      if (sessionStorage.getItem(PENDING_CHECKOUT_KEY) !== lookupToken) return;
      sessionStorage.removeItem(PENDING_CHECKOUT_KEY);
      this.clear();
    } catch {
      /* The order still succeeds if browser storage is unavailable. */
    }
  }

  /** What checkout sends: identifiers and quantities, never prices. */
  toCheckoutLines(): Array<{ productId: string; variantId: string | null; quantity: number }> {
    return this.itemsSignal().map((item) => ({
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
    }));
  }

  private commit(items: CartItem[]): void {
    this.itemsSignal.set(items);
    this.save(items);
  }

  private load(): CartItem[] {
    if (!this.isBrowser) return [];
    try {
      const raw: string | null = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (item): item is CartItem =>
          typeof item?.productId === "string" && Number.isInteger(item?.quantity),
      );
    } catch {
      /* Corrupt or unavailable storage must not break the shop. */
      return [];
    }
  }

  private save(items: CartItem[]): void {
    if (!this.isBrowser) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* Quota exceeded or storage blocked. The cart still works in memory. */
    }
  }
}
