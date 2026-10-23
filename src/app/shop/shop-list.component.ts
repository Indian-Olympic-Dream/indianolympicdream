import { CommonModule } from "@angular/common";
import { Component, inject, signal } from "@angular/core";
import { Router, RouterLink } from "@angular/router";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { ShopService } from "./shop.service";
import { CartService } from "./cart.service";
import { CatalogueProduct, CatalogueUnit } from "./shop.models";
import { formatPaise } from "./shop-money";
import { ShopChromeComponent } from "./shop-chrome.component";
import { FIRST_DROP } from "./shop-promotions";

@Component({
  selector: "app-shop-list",
  standalone: true,
  imports: [CommonModule, RouterLink, MatButtonModule, MatIconModule, ShopChromeComponent],
  templateUrl: "./shop-list.component.html",
  styleUrl: "./shop-list.component.scss",
})
export class ShopListComponent {
  private readonly shop = inject(ShopService);
  private readonly router = inject(Router);
  readonly cart = inject(CartService);

  readonly products = signal<CatalogueProduct[]>([]);
  readonly loading = signal<boolean>(true);
  readonly error = signal<string | null>(null);
  readonly selectedUnits = signal<Record<string, number>>({});
  readonly activeImageIndexes = signal<Record<string, number>>({});
  readonly addedProductId = signal<string | null>(null);
  readonly firstDropAdded = signal<boolean>(false);

  private swipeStart: { productId: string; x: number } | null = null;

  readonly formatPaise = formatPaise;
  readonly firstDrop = FIRST_DROP;

  constructor() {
    this.shop.listProducts().subscribe({
      next: (products) => {
        this.products.set(products);
        this.loading.set(false);
      },
      error: () => {
        this.error.set("The shop could not be loaded. Please try again shortly.");
        this.loading.set(false);
      },
    });
  }

  /** Cheapest unit, which is what a listing card should advertise. */
  fromPricePaise(product: CatalogueProduct): number | null {
    if (product.units.length === 0) return null;
    return Math.min(...product.units.map((unit) => unit.unitPricePaise));
  }

  hasVariablePricing(product: CatalogueProduct): boolean {
    return new Set(product.units.map((unit) => unit.unitPricePaise)).size > 1;
  }

  /** True when every purchasable unit of this product is unavailable. */
  isSoldOut(product: CatalogueProduct): boolean {
    return product.units.every((unit) => unit.availableQuantity < 1);
  }

  imagesFor(product: CatalogueProduct): Array<{ url: string; alt: string }> {
    return product.images.filter((image): image is { url: string; alt: string } => Boolean(image.url));
  }

  activeImageIndex(product: CatalogueProduct): number {
    const imageCount = this.imagesFor(product).length;
    if (imageCount === 0) return 0;

    return Math.min(this.activeImageIndexes()[product.id] ?? 0, imageCount - 1);
  }

  activeImageFor(product: CatalogueProduct): { url: string; alt: string } | null {
    return this.imagesFor(product)[this.activeImageIndex(product)] ?? null;
  }

  selectImage(product: CatalogueProduct, index: number): void {
    const imageCount = this.imagesFor(product).length;
    if (index < 0 || index >= imageCount) return;

    this.activeImageIndexes.update((current) => ({ ...current, [product.id]: index }));
  }

  moveImage(product: CatalogueProduct, direction: -1 | 1): void {
    const imageCount = this.imagesFor(product).length;
    if (imageCount < 2) return;

    const nextIndex = (this.activeImageIndex(product) + direction + imageCount) % imageCount;
    this.selectImage(product, nextIndex);
  }

  onMediaTouchStart(product: CatalogueProduct, event: TouchEvent): void {
    const touch = event.changedTouches[0];
    if (!touch) return;

    this.swipeStart = { productId: product.id, x: touch.clientX };
  }

  onMediaTouchEnd(product: CatalogueProduct, event: TouchEvent): void {
    const touch = event.changedTouches[0];
    if (!touch || this.swipeStart?.productId !== product.id) return;

    const distance = touch.clientX - this.swipeStart.x;
    this.swipeStart = null;
    if (Math.abs(distance) < 42) return;

    this.moveImage(product, distance < 0 ? 1 : -1);
  }

  typeLabel(product: CatalogueProduct): string {
    if (product.comingSoon) {
      return product.type === "merch" ? "Apparel concept" : "Print concept";
    }
    return product.type === "merch" ? "IOD original" : "Legends print";
  }

  storyFor(product: CatalogueProduct): string {
    const stories: Record<string, string> = {
      "the-golden-shot-tee": "One last shot. A 10.8. The wait for India’s first individual Olympic gold was over.",
      "the-golden-throw-tee": "87.58m held. The tricolour rose over an Olympic athletics champion for the first time.",
    };

    return stories[product.slug] ?? "An original story from Indian sporting history";
  }

  firstDropProducts(): CatalogueProduct[] {
    const bySlug = new Map(this.products().map((product) => [product.slug, product]));
    return FIRST_DROP.productSlugs
      .map((slug) => bySlug.get(slug))
      .filter((product): product is CatalogueProduct => Boolean(product));
  }

  firstDropRegularPricePaise(): number {
    return this.firstDropProducts().reduce(
      (total, product) => total + (this.fromPricePaise(product) ?? 0),
      0,
    );
  }

  firstDropSavingsPaise(): number {
    return Math.max(0, this.firstDropRegularPricePaise() - FIRST_DROP.pairPricePaise);
  }

  canBuyFirstDrop(): boolean {
    const products = this.firstDropProducts();
    return products.length === FIRST_DROP.productSlugs.length &&
      products.every((product) => this.canQuickBuy(product));
  }

  addFirstDropToCart(): void {
    const products = this.firstDropProducts();
    if (!this.canBuyFirstDrop()) return;

    for (const product of products) {
      const unit = this.selectedUnit(product);
      if (unit) this.cart.add(product, unit);
    }
    this.firstDropAdded.set(true);
    this.addedProductId.set(null);
  }

  buyFirstDrop(): void {
    this.addFirstDropToCart();
    if (this.firstDropAdded()) void this.router.navigate(["/shop/checkout"]);
  }

  selectedUnit(product: CatalogueProduct): CatalogueUnit | null {
    const index = this.selectedUnits()[product.id];
    return typeof index === "number" ? product.units[index] ?? null : null;
  }

  selectUnit(product: CatalogueProduct, index: number): void {
    const unit = product.units[index];
    if (!unit || unit.availableQuantity < 1) return;

    this.selectedUnits.update((current) => ({ ...current, [product.id]: index }));
    this.addedProductId.set(null);
    this.firstDropAdded.set(false);
  }

  isUnitSelected(product: CatalogueProduct, index: number): boolean {
    return this.selectedUnits()[product.id] === index;
  }

  remaining(product: CatalogueProduct, unit: CatalogueUnit): number {
    const inCart =
      this.cart
        .items()
        .find((item) => item.productId === product.id && item.variantId === unit.variantId)
        ?.quantity ?? 0;

    return Math.max(0, unit.availableQuantity - inCart);
  }

  canQuickBuy(product: CatalogueProduct): boolean {
    const unit = this.selectedUnit(product);
    return Boolean(unit && !product.comingSoon && this.remaining(product, unit) > 0);
  }

  addToCart(product: CatalogueProduct): void {
    const unit = this.selectedUnit(product);
    if (!unit || !this.canQuickBuy(product)) return;

    this.cart.add(product, unit);
    this.addedProductId.set(product.id);
  }

  buyNow(product: CatalogueProduct): void {
    const unit = this.selectedUnit(product);
    if (!unit || !this.canQuickBuy(product)) return;

    this.cart.add(product, unit);
    void this.router.navigate(["/shop/checkout"]);
  }

  selectionLabel(product: CatalogueProduct): string {
    if (!this.selectedUnit(product)) return product.type === "merch" ? "Select a size" : "Choose an option";
    if (!this.canQuickBuy(product)) return "Maximum in cart";
    return `Buy now · ${formatPaise(this.selectedUnit(product)?.unitPricePaise ?? 0)}`;
  }

  shopListReload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.shop.listProducts().subscribe({
      next: (products) => {
        this.products.set(products);
        this.loading.set(false);
      },
      error: () => {
        this.error.set("The shop could not be loaded. Please try again shortly.");
        this.loading.set(false);
      },
    });
  }
}
