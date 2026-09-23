import { CommonModule } from "@angular/common";
import { Component, inject, signal } from "@angular/core";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { MatButtonModule } from "@angular/material/button";
import { ShopService } from "./shop.service";
import { OrderView } from "./shop.models";
import { formatPaise } from "./shop-money";

/**
 * The customer's view of their own order.
 *
 * Reached only by the token in the URL, which is the credential (ADR-009). The
 * server returns a trimmed view, so nothing sensitive beyond what the buyer
 * already knows is exposed if the link is shared.
 */
@Component({
  selector: "app-order-lookup",
  standalone: true,
  imports: [CommonModule, RouterLink, MatButtonModule],
  templateUrl: "./order-lookup.component.html",
  styleUrl: "./order-lookup.component.scss",
})
export class OrderLookupComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly shop = inject(ShopService);

  readonly order = signal<OrderView | null>(null);
  readonly loading = signal<boolean>(true);
  readonly error = signal<string | null>(null);
  readonly formatPaise = formatPaise;

  constructor() {
    const token: string = this.route.snapshot.paramMap.get("token") ?? "";
    this.shop.getOrder(token).subscribe({
      next: (order) => {
        this.order.set(order);
        this.loading.set(false);
      },
      error: () => {
        this.error.set("We could not find that order. Please check the link in your email.");
        this.loading.set(false);
      },
    });
  }

  /** Plain-English status, because internal state names are not for customers. */
  statusLabel(status: string): string {
    switch (status) {
      case "created":
        return "Awaiting payment";
      case "paid":
        return "Paid — preparing your order";
      case "processing":
        return "Packed and handed to the courier";
      case "shipped":
        return "On its way";
      case "delivered":
        return "Delivered";
      case "rto":
        return "Returned to us";
      case "refunded":
        return "Refunded";
      case "failed":
        return "Payment did not go through";
      default:
        return status;
    }
  }
}
