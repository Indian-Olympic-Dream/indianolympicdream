import { CommonModule } from "@angular/common";
import { Component, computed, inject, signal } from "@angular/core";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { ShopService } from "./shop.service";
import { CartService } from "./cart.service";
import { CatalogueProduct, CatalogueUnit } from "./shop.models";
import { formatPaise } from "./shop-money";

@Component({
  selector: "app-product-detail",
  standalone: true,
  imports: [CommonModule, RouterLink, MatButtonModule, MatIconModule],
  templateUrl: "./product-detail.component.html",
  styleUrl: "./product-detail.component.scss",
})
export class ProductDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly shop = inject(ShopService);
  readonly cart = inject(CartService);

  readonly product = signal<CatalogueProduct | null>(null);
  readonly selectedIndex = signal<number>(0);
  readonly loading = signal<boolean>(true);
  readonly error = signal<string | null>(null);
  readonly added = signal<boolean>(false);

  readonly formatPaise = formatPaise;

  readonly selectedUnit = computed<CatalogueUnit | null>(() => {
    const current = this.product();
    if (!current) return null;
    return current.units[this.selectedIndex()] ?? null;
  });

  /**
   * How many more of the selected unit this visitor may add.
   *
   * Availability already excludes other people's live checkout holds, and the
   * cart's own quantity is subtracted so the button disables at the real limit
   * rather than letting someone build a cart that checkout will reject.
   */
  readonly remaining = computed<number>(() => {
    const unit = this.selectedUnit();
    const current = this.product();
    if (!unit || !current) return 0;

    const inCart: number =
      this.cart
        .items()
        .find((item) => item.productId === current.id && item.variantId === unit.variantId)
        ?.quantity ?? 0;

    return Math.max(0, unit.availableQuantity - inCart);
  });

  constructor() {
    const slug: string = this.route.snapshot.paramMap.get("slug") ?? "";
    this.shop.getProduct(slug).subscribe({
      next: (product) => {
        this.product.set(product);
        this.loading.set(false);
      },
      error: () => {
        this.error.set("That product could not be found.");
        this.loading.set(false);
      },
    });
  }

  selectUnit(index: number): void {
    this.selectedIndex.set(index);
    this.added.set(false);
  }

  addToCart(): void {
    const product = this.product();
    const unit = this.selectedUnit();
    if (!product || !unit || this.remaining() < 1) return;

    this.cart.add(product, unit, 1);
    this.added.set(true);
  }

  imageFor(product: CatalogueProduct): string | null {
    return product.images.find((image) => image.url)?.url ?? null;
  }
}
