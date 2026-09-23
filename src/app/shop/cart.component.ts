import { CommonModule } from "@angular/common";
import { Component, inject } from "@angular/core";
import { RouterLink } from "@angular/router";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { CartService } from "./cart.service";
import { CartItem } from "./shop.models";
import { formatPaise } from "./shop-money";

@Component({
  selector: "app-cart",
  standalone: true,
  imports: [CommonModule, RouterLink, MatButtonModule, MatIconModule],
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
}
