import { CommonModule } from "@angular/common";
import { Component, inject, signal } from "@angular/core";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { ShopService } from "./shop.service";
import { OrderView } from "./shop.models";
import { formatPaise } from "./shop-money";
import { ShopChromeComponent } from "./shop-chrome.component";
import { CartService } from "./cart.service";

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
  imports: [CommonModule, RouterLink, MatButtonModule, MatIconModule, ShopChromeComponent],
  templateUrl: "./order-lookup.component.html",
  styleUrl: "./order-lookup.component.scss",
})
export class OrderLookupComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly shop = inject(ShopService);
  private readonly cart = inject(CartService);

  readonly order = signal<OrderView | null>(null);
  readonly loading = signal<boolean>(true);
  readonly error = signal<string | null>(null);
  readonly formatPaise = formatPaise;
  readonly invoiceBusy = signal<boolean>(false);
  readonly invoiceError = signal<string | null>(null);
  private readonly token: string = this.route.snapshot.paramMap.get("token") ?? "";

  constructor() {
    const token: string = this.token;
    this.shop.getOrder(token).subscribe({
      next: (order) => {
        this.order.set(order);
        if (["paid", "processing", "shipped", "delivered", "refunded"].includes(order.status)) {
          this.cart.completeCheckout(token);
        }
        this.loading.set(false);
      },
      error: () => {
        this.error.set("We could not find that order. Please check the link in your email.");
        this.loading.set(false);
      },
    });
  }

  /** An invoice exists once money has been taken; the server enforces the same rule. */
  canDownloadInvoice(status: string): boolean {
    return ["paid", "processing", "shipped", "delivered", "rto"].includes(status);
  }

  downloadInvoice(orderNumber: string): void {
    if (this.invoiceBusy()) return;
    this.invoiceBusy.set(true);
    this.invoiceError.set(null);
    this.shop.downloadInvoice(this.token).subscribe({
      next: (response) => {
        const blob: Blob | null = response.body;
        if (!blob) {
          this.invoiceError.set("The invoice came back empty. Please try again.");
        } else {
          const disposition: string = response.headers.get("content-disposition") ?? "";
          const name: string =
            /filename="([^"]+)"/.exec(disposition)?.[1] ?? `invoice-${orderNumber}.pdf`;
          this.saveFile(blob, name);
        }
        this.invoiceBusy.set(false);
      },
      error: () => {
        this.invoiceError.set("We could not prepare your invoice. Please try again in a moment.");
        this.invoiceBusy.set(false);
      },
    });
  }

  private saveFile(blob: Blob, name: string): void {
    const url: string = URL.createObjectURL(blob);
    const link: HTMLAnchorElement = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  /** Plain-English status, because internal state names are not for customers. */
  statusLabel(status: string): string {
    switch (status) {
      case "created":
        return "Awaiting payment";
      case "paid":
        return "Paid. Preparing your order";
      case "processing":
        return "Preparing for dispatch";
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

  statusMessage(status: string): string {
    switch (status) {
      case "created":
        return "Your order is saved and waiting for payment confirmation.";
      case "paid":
        return "Payment is confirmed. We are getting your order ready.";
      case "processing":
        return "Your order is with our dispatch team and will be on its way soon.";
      case "shipped":
        return "Your parcel is moving. Use the tracking link for its latest scan.";
      case "delivered":
        return "Your parcel has been marked as delivered.";
      case "refunded":
        return "The payment for this order has been refunded.";
      case "rto":
        return "The courier is returning this parcel to us. We will contact you.";
      case "failed":
        return "Payment was not completed. No successful charge is recorded on this order.";
      default:
        return "The latest status for your order is shown here.";
    }
  }

  statusStep(status: string): number {
    const steps: Record<string, number> = { created: 0, paid: 1, processing: 2, shipped: 3, delivered: 4 };
    return steps[status] ?? 0;
  }

  isTerminalException(status: string): boolean {
    return ["failed", "refunded", "rto"].includes(status);
  }

  placedDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(date);
  }
}
