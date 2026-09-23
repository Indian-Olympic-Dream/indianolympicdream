import { TestBed } from "@angular/core/testing";
import { CartService } from "./cart.service";
import { CatalogueProduct, CatalogueUnit } from "./shop.models";

const product: CatalogueProduct = {
  id: "p1",
  slug: "poster",
  title: "Poster",
  type: "infographic",
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

  it("computes an advisory subtotal", () => {
    service.add(product, unit({ unitPricePaise: 25000 }), 3);
    expect(service.subtotalPaise()).toBe(75000);
  });

  it("removes a line when quantity drops below one", () => {
    service.add(product, unit(), 2);
    service.setQuantity("p1", null, 0);
    expect(service.items().length).toBe(0);
  });

  it("sends identifiers and quantities only — never prices", () => {
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
})
