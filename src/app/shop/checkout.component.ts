import { CommonModule, isPlatformBrowser } from "@angular/common";
import { Component, PLATFORM_ID, inject, signal } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { Router, RouterLink } from "@angular/router";
import { MatButtonModule } from "@angular/material/button";
import { CartService } from "./cart.service";
import { ShopService } from "./shop.service";
import { CheckoutResponse } from "./shop.models";
import { formatPaise } from "./shop-money";

/** Razorpay's checkout widget, loaded on demand from their CDN. */
declare const Razorpay: new (options: Record<string, unknown>) => { open: () => void };

const RAZORPAY_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";

@Component({
  selector: "app-checkout",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, MatButtonModule],
  templateUrl: "./checkout.component.html",
  styleUrl: "./checkout.component.scss",
})
export class CheckoutComponent {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly shop = inject(ShopService);
  readonly cart = inject(CartService);

  readonly submitting = signal<boolean>(false);
  readonly error = signal<string | null>(null);
  readonly formatPaise = formatPaise;

  readonly form = this.fb.nonNullable.group({
    name: ["", [Validators.required, Validators.maxLength(120)]],
    email: ["", [Validators.required, Validators.email]],
    /* Ten digits. Deliberately permissive about spacing, strict about length:
     * the courier needs a number that can actually be dialled. */
    phone: ["", [Validators.required, Validators.pattern(/^[0-9+\-\s]{10,15}$/)]],
    line1: ["", [Validators.required, Validators.maxLength(200)]],
    line2: [""],
    city: ["", [Validators.required]],
    state: ["", [Validators.required]],
    postalCode: ["", [Validators.required, Validators.pattern(/^[1-9][0-9]{5}$/)]],
    country: ["India", [Validators.required]],
  });

  /**
   * Load Razorpay's script once, on demand.
   *
   * Not in index.html: it would run on every page of the site for the benefit of
   * one, and it is a third-party script on a page that handles payment.
   */
  private loadRazorpay(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      return Promise.reject(new Error("Checkout is only available in the browser"));
    }
    if (typeof (window as unknown as { Razorpay?: unknown }).Razorpay !== "undefined") {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = RAZORPAY_SCRIPT;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Could not load the payment window"));
      document.body.appendChild(script);
    });
  }

  async submit(): Promise<void> {
    if (this.form.invalid || this.cart.items().length === 0) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    const value = this.form.getRawValue();

    try {
      await this.loadRazorpay();

      this.shop
        .startCheckout(
          this.cart.toCheckoutLines(),
          { name: value.name, email: value.email, phone: value.phone },
          {
            line1: value.line1,
            line2: value.line2 || undefined,
            city: value.city,
            state: value.state,
            postalCode: value.postalCode,
            country: value.country,
          },
        )
        .subscribe({
          next: (response) => this.openPaymentWindow(response),
          error: (response) => {
            /* The server's message is shown as-is when it is one of the
             * customer-facing cart codes — "only 2 available" is far more useful
             * than a generic failure. */
            this.error.set(
              response?.error?.error ?? "Checkout could not be started. Please try again.",
            );
            this.submitting.set(false);
          },
        });
    } catch (loadError) {
      this.error.set((loadError as Error).message);
      this.submitting.set(false);
    }
  }

  private openPaymentWindow(checkout: CheckoutResponse): void {
    const value = this.form.getRawValue();

    const razorpay = new Razorpay({
      key: checkout.razorpayKeyId,
      amount: checkout.amountPaise,
      currency: checkout.currency,
      order_id: checkout.razorpayOrderId,
      name: "Indian Olympic Dream",
      description: `Order ${checkout.orderNumber}`,
      prefill: { name: value.name, email: value.email, contact: value.phone },
      handler: (result: {
        razorpay_payment_id: string;
        razorpay_signature: string;
      }) => {
        /*
         * Tell the server, but do not depend on it. If this call fails, the
         * webhook and the reconciliation sweep still settle the order (ADR-006),
         * so the customer is sent to their order page either way rather than
         * being shown an error about money they have already paid.
         */
        this.shop
          .verifyPayment(
            checkout.lookupToken,
            result.razorpay_payment_id,
            result.razorpay_signature,
          )
          .subscribe({
            next: () => this.finish(checkout.lookupToken),
            error: () => this.finish(checkout.lookupToken),
          });
      },
      modal: {
        ondismiss: () => {
          /* They closed the payment window. The order exists and its stock is
           * held for a few minutes; the sweep releases it if they never return. */
          this.submitting.set(false);
          this.error.set("Payment was cancelled. Your cart has been kept.");
        },
      },
    });

    razorpay.open();
  }

  private finish(token: string): void {
    this.cart.clear();
    this.submitting.set(false);
    void this.router.navigate(["/shop/orders", token]);
  }
}
