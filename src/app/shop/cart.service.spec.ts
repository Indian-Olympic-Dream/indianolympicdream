import { TestBed } from "@angular/core/testing";
import { CartService } from "./cart.service";
import { CatalogueProduct, CatalogueUnit } from "./shop.models";

const product: CatalogueProduct = {
  id: "p1",
  slug: "poster",
  title: "Poster",
  type: "infographic",
  comingSoon: false,
  images: [],
  metadata: null,
  units: [],
};

function unit(overrides: Partial<CatalogueUnit> = {}): CatalogueUnit {
  return {
    variantId: null,
    variantName: null,
    unitPricePaise: 49900,
    availableQuantity: 5,
    ...overrides,
  };
}

describe("CartService", () => {
  let service: CartService;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(CartService);
    service.clear();
  });

  it("adds an item and reports the count", () => {
    service.add(product, unit(), 2);
    expect(service.count()).toBe(2);
    expect(service.items().length).toBe(1);
  });

  it("merges a repeat add of the same unit instead of duplicating the line", () => {
    service.add(product, unit(), 1);
    service.add(product, unit(), 2);
    expect(service.items().length).toBe(1);
    expect(service.count()).toBe(3);
  });

  it("treats a variant as a separate line", () => {
    service.add(product, unit(), 1);
    service.add(product, unit({ variantId: "v1", variantName: "Framed" }), 1);
    expect(service.items().length).toBe(2);
  });

  it("will not add more than the catalogue says is available", () => {
    service.add(product, unit({ availableQuantity: 2 }), 99);
    expect(service.count()).toBe(2);
  });

  it("will not exceed availability across repeated adds", () => {
    service.add(product, unit({ availableQuantity: 3 }), 2);
    service.add(product, unit({ availableQuantity: 3 }), 5);
    expect(service.count()).toBe(3);
  });

  it("will not exceed remembered availability from the cart controls", () => {
    service.add(product, unit({ availableQuantity: 2 }), 1);
    service.setQuantity("p1", null, 99);
    expect(service.count()).toBe(2);
  });

  it("keeps a display-only product image without sending it to checkout", () => {
    service.add(
      { ...product, images: [{ url: "/api/media/tee.png", alt: "Black tee" }] },
      unit(),
      1,
    );
    expect(service.items()[0].imageUrl).toBe("/api/media/tee.png");
    expect(JSON.stringify(service.toCheckoutLines())).not.toContain("tee.png");
  });

  it("computes an advisory subtotal", () => {
    service.add(product, unit({ unitPricePaise: 25000 }), 3);
    expect(service.subtotalPaise()).toBe(75000);
  });

  it("previews the First Drop offer when both original tees are present", () => {
    service.add(
      { ...product, id: "shot", slug: "the-golden-shot-tee", title: "The Golden Shot" },
      unit({ variantId: "shot-m", variantName: "M", unitPricePaise: 54900 }),
      1,
    );
    service.add(
      { ...product, id: "throw", slug: "the-golden-throw-tee", title: "The Golden Throw" },
      unit({ variantId: "throw-l", variantName: "L", unitPricePaise: 54900 }),
      1,
    );

    expect(service.subtotalPaise()).toBe(109800);
    expect(service.discountPaise()).toBe(9900);
    expect(service.merchandiseTotalPaise()).toBe(99900);
  });

  it("does not preview the First Drop offer with only one original tee", () => {
    service.add(
      { ...product, id: "shot", slug: "the-golden-shot-tee" },
      unit({ variantId: "shot-m", variantName: "M", unitPricePaise: 54900 }),
      1,
    );

    expect(service.discountPaise()).toBe(0);
    expect(service.merchandiseTotalPaise()).toBe(54900);
  });

  it("removes a line when quantity drops below one", () => {
    service.add(product, unit(), 2);
    service.setQuantity("p1", null, 0);
    expect(service.items().length).toBe(0);
  });

  it("sends identifiers and quantities only, never prices", () => {
    service.add(product, unit(), 2);
    const lines = service.toCheckoutLines();
    expect(lines).toEqual([{ productId: "p1", variantId: null, quantity: 2 }]);
    expect(JSON.stringify(lines)).not.toContain("49900");
  });

  it("survives corrupt stored data", () => {
    localStorage.setItem("iod.shop.cart.v1", "{not json");
    const fresh = TestBed.inject(CartService);
    expect(fresh.items()).toEqual([]);
  });

  it("persists across service instances", () => {
    service.add(product, unit(), 2);
    const raw = localStorage.getItem("iod.shop.cart.v1");
    expect(raw).toContain("p1");
  });

  it("keeps the cart while payment is pending and clears it for the matching return", () => {
    service.add(product, unit(), 1);
    service.markCheckoutStarted("order-token");
    expect(service.count()).toBe(1);

    service.completeCheckout("another-token");
    expect(service.count()).toBe(1);

    service.completeCheckout("order-token");
    expect(service.count()).toBe(0);
  });
})

describe("CartService: coming soon", () => {
  let service: CartService;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(CartService);
    service.clear();
  });

  it("refuses to add a product that has not launched", () => {
    service.add({ ...product, comingSoon: true }, unit(), 1);
    expect(service.count()).toBe(0);
  });

  it("still adds one that has launched", () => {
    service.add({ ...product, comingSoon: false }, unit(), 1);
    expect(service.count()).toBe(1);
  });
});
