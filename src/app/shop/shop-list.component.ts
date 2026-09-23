import { CommonModule } from "@angular/common";
import { Component, inject, signal } from "@angular/core";
import { RouterLink } from "@angular/router";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { ShopService } from "./shop.service";
import { CartService } from "./cart.service";
import { CatalogueProduct } from "./shop.models";
import { formatPaise } from "./shop-money";

@Component({
  selector: "app-shop-list",
  standalone: true,
  imports: [CommonModule, RouterLink, MatButtonModule, MatIconModule],
  templateUrl: "./shop-list.component.html",
  styleUrl: "./shop-list.component.scss",
})
export class ShopListComponent {
  private readonly shop = inject(ShopService);
  readonly cart = inject(CartService);

  readonly products = signal<CatalogueProduct[]>([]);
  readonly loading = signal<boolean>(true);
  readonly error = signal<string | null>(null);

  readonly formatPaise = formatPaise;

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
  fromPricePaise(product: CatalogueProduct): number {
    return product.units.reduce(
      (lowest, unit) => Math.min(lowest, unit.unitPricePaise),
      Number.POSITIVE_INFINITY,
    );
  }

  /** True when every purchasable unit of this product is unavailable. */
  isSoldOut(product: CatalogueProduct): boolean {
    return product.units.every((unit) => unit.availableQuantity < 1);
  }

  imageFor(product: CatalogueProduct): string | null {
    return product.images.find((image) => image.url)?.url ?? null;
  }
}
