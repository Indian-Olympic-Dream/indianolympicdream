
import { Component, computed, inject, signal } from "@angular/core";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { ShopService } from "./shop.service";
import { CartService } from "./cart.service";
import { CatalogueProduct, CatalogueUnit } from "./shop.models";
import { formatPaise } from "./shop-money";
import { ShopChromeComponent } from "./shop-chrome.component";
import { ShopPolicyFooterComponent } from "./shop-policy-footer.component";
import { ShopSizeGuideComponent } from "./shop-size-guide.component";

interface ProductStory {
  chapter: string;
  date: string;
  stat: string;
  statLabel: string;
  headline: string;
  intro: string;
  detail: string;
  design: string;
}

const PRODUCT_STORIES: Record<string, ProductStory> = {
  "the-golden-shot-tee": {
    chapter: "IOD Original · 01",
    date: "Beijing · 11 August 2008",
    stat: "10.8",
    statLabel: "The final shot",
    headline: "One final shot. A first for India.",
    intro: "Abhinav Bindra shot a 10.8 when it mattered most and won India’s first individual Olympic gold.",
    detail:
      "The final was level. Bindra had one shot left. He hit 10.8 and became India’s first individual Olympic champion. This T-shirt is about that calm, that pressure and the moment the wait ended.",
    design:
      "We brought Bindra, the target and the score together in gold on black. The design keeps the focus where it belongs: on the shot.",
  },
  "the-golden-throw-tee": {
    chapter: "IOD Original · 02",
    date: "Tokyo · 7 August 2021",
    stat: "87.58m",
    statLabel: "The winning throw",
    headline: "The throw that changed Indian athletics.",
    intro: "Neeraj Chopra threw 87.58m and won India’s first Olympic gold in athletics.",
    detail:
      "His second throw landed at 87.58m. Nobody passed it. By the end of the night, India had its first Olympic champion in athletics. This T-shirt holds on to the movement, the distance and the feeling of that night.",
    design:
      "The javelin runs across the map of India while Neeraj stays in motion. The distance sits beside him because 87.58m is the number we remember.",
  },
};

@Component({
  selector: "app-product-detail",
  standalone: true,
  imports: [RouterLink, MatButtonModule, MatIconModule, ShopChromeComponent, ShopPolicyFooterComponent, ShopSizeGuideComponent],
  templateUrl: "./product-detail.component.html",
  styleUrl: "./product-detail.component.scss",
})
export class ProductDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly shop = inject(ShopService);
  readonly cart = inject(CartService);

  readonly product = signal<CatalogueProduct | null>(null);
  readonly selectedIndex = signal<number>(0);
  readonly selectedImageIndex = signal<number>(0);
  readonly quantity = signal<number>(1);
  readonly loading = signal<boolean>(true);
  readonly error = signal<string | null>(null);
  readonly added = signal<boolean>(false);

  readonly formatPaise = formatPaise;

  readonly story = computed<ProductStory | null>(() => {
    const current = this.product();
    return current ? PRODUCT_STORIES[current.slug] ?? null : null;
  });

  readonly selectedUnit = computed<CatalogueUnit | null>(() => {
    const current = this.product();
    if (!current) return null;
    return current.units[this.selectedIndex()] ?? null;
  });

  readonly inCart = computed<number>(() => {
    const unit = this.selectedUnit();
    const current = this.product();
    if (!unit || !current) return 0;
    return (
      this.cart
        .items()
        .find((item) => item.productId === current.id && item.variantId === unit.variantId)
        ?.quantity ?? 0
    );
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

    return Math.max(0, unit.availableQuantity - this.inCart());
  });

  constructor() {
    const slug: string = this.route.snapshot.paramMap.get("slug") ?? "";
    this.shop.getProduct(slug).subscribe({
      next: (product) => {
        this.product.set(product);
        const firstAvailable = product.units.findIndex((unit) => unit.availableQuantity > 0);
        this.selectedIndex.set(firstAvailable >= 0 ? firstAvailable : 0);
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
    this.quantity.set(1);
    this.added.set(false);
  }

  selectImage(index: number): void {
    this.selectedImageIndex.set(index);
  }

  changeQuantity(delta: number): void {
    this.quantity.set(Math.min(Math.max(1, this.quantity() + delta), this.remaining()));
    this.added.set(false);
  }

  addToCart(): void {
    const product = this.product();
    const unit = this.selectedUnit();
    if (!product || product.comingSoon || !unit || this.remaining() < 1) return;

    this.cart.add(product, unit, this.quantity());
    this.added.set(true);
  }

  buyNow(): void {
    const product = this.product();
    const unit = this.selectedUnit();
    if (!product || product.comingSoon || !unit || this.remaining() < 1) return;

    this.cart.add(product, unit, this.quantity());
    void this.router.navigate(["/shop/checkout"]);
  }

  imageFor(product: CatalogueProduct): string | null {
    const availableImages = product.images.filter((image) => image.url);
    return availableImages[this.selectedImageIndex()]?.url ?? availableImages[0]?.url ?? null;
  }

  imageAltFor(product: CatalogueProduct): string {
    const availableImages = product.images.filter((image) => image.url);
    return availableImages[this.selectedImageIndex()]?.alt || product.title;
  }

  availableImages(product: CatalogueProduct): Array<{ url: string; alt: string }> {
    return product.images.filter((image): image is { url: string; alt: string } => Boolean(image.url));
  }

  productTypeLabel(product: CatalogueProduct): string {
    if (product.comingSoon) {
      return product.type === "merch" ? "IOD future apparel" : "IOD future print";
    }
    return product.type === "merch" ? "IOD original apparel" : "IOD Legends print";
  }

  variantLegend(product: CatalogueProduct): string {
    return product.type === "merch" ? "Select size" : "Choose an option";
  }
}
