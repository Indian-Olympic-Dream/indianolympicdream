import { CommonModule } from "@angular/common";
import { Component, inject } from "@angular/core";
import { RouterLink } from "@angular/router";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { CartService } from "./cart.service";
import { CartItem } from "./shop.models";
import { formatPaise } from "./shop-money";
import { ShopChromeComponent } from "./shop-chrome.component";

@Component({
  selector: "app-cart",
  standalone: true,
  imports: [CommonModule, RouterLink, MatButtonModule, MatIconModule, ShopChromeComponent],
  templateUrl: "./cart.component.html",
  styleUrl: "./cart.component.scss",
})
export class CartComponent {
  readonly cart = inject(CartService);
  readonly formatPaise = formatPaise;

  increase(item: CartItem): void {
    this.cart.setQuantity(item.productId, item.variantId, item.quantity + 1);
  }

  decrease(item: CartItem): void {
    this.cart.setQuantity(item.productId, item.variantId, item.quantity - 1);
  }

  remove(item: CartItem): void {
    this.cart.remove(item.productId, item.variantId);
  }

  canIncrease(item: CartItem): boolean {
    return typeof item.availableQuantity !== "number" || item.quantity < item.availableQuantity;
  }

  momentFor(item: CartItem): string {
    if (item.slug === "the-golden-shot-tee") return "10.8";
    if (item.slug === "the-golden-throw-tee") return "87.58m";
    return "IOD";
  }

  chapterFor(item: CartItem): string {
    if (item.slug === "the-golden-shot-tee") return "01";
    if (item.slug === "the-golden-throw-tee") return "02";
    return "IOD";
  }
}
