import { Component, inject } from "@angular/core";
import { RouterLink, RouterLinkActive } from "@angular/router";
import { MatIconModule } from "@angular/material/icon";
import { CartService } from "./cart.service";

/** A small, consistent shop header that keeps the cart reachable on every step. */
@Component({
  selector: "app-shop-chrome",
  standalone: true,
  imports: [RouterLink, RouterLinkActive, MatIconModule],
  template: `
    <nav class="storebar" aria-label="Shop navigation">
      <a
        class="storebar__brand"
        routerLink="/shop"
        routerLinkActive="storebar__brand--active"
        [routerLinkActiveOptions]="{ exact: true }"
      >
        <span class="storebar__mark" aria-hidden="true">
          <img src="assets/shop/iod-shop-symbol.svg" alt="" />
        </span>
        <span class="storebar__wordmark"><strong>IOD</strong><span>Shop</span></span>
      </a>

      <p class="storebar__promise">
        <span aria-hidden="true"></span>
        Original Indian sportswear
      </p>

      <a
        class="storebar__cart"
        routerLink="/shop/cart"
        routerLinkActive="storebar__cart--active"
        [attr.aria-label]="'Cart, ' + cart.count() + (cart.count() === 1 ? ' item' : ' items')"
      >
        <mat-icon aria-hidden="true">local_mall</mat-icon>
        <span>Cart</span>
        @if (cart.count() > 0) {
          <span class="storebar__count" aria-hidden="true">{{ cart.count() }}</span>
        }
      </a>
    </nav>
  `,
  styleUrl: "./shop-chrome.component.scss",
})
export class ShopChromeComponent {
  readonly cart = inject(CartService);
}
