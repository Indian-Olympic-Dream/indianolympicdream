import { isPlatformBrowser } from "@angular/common";
import { Component, DestroyRef, PLATFORM_ID, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { of, timer } from "rxjs";
import { catchError, distinctUntilChanged, switchMap, tap } from "rxjs/operators";
import { CartService } from "./cart.service";
import { ShopService } from "./shop.service";
import { CheckoutResponse, PincodeLookup, ShippingQuoteResponse } from "./shop.models";
import { formatPaise } from "./shop-money";
import { ShopChromeComponent } from "./shop-chrome.component";
import { ShopPolicyFooterComponent } from "./shop-policy-footer.component";

/** Razorpay's checkout widget, loaded on demand from their CDN. */
declare const Razorpay: new (options: Record<string, unknown>) => { open: () => void };

const RAZORPAY_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";
const CHECKOUT_DRAFT_KEY = "iod.shop.checkout-draft.v1";

@Component({
  selector: "app-checkout",
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    ShopChromeComponent,
    ShopPolicyFooterComponent
],
  templateUrl: "./checkout.component.html",
  styleUrl: "./checkout.component.scss",
})
export class CheckoutComponent {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly shop = inject(ShopService);
  readonly cart = inject(CartService);

  readonly submitting = signal<boolean>(false);
  readonly error = signal<string | null>(null);
  readonly draftRestored = signal<boolean>(false);
  readonly pincodeStatus = signal<"idle" | "looking" | "found" | "not-found" | "unavailable">("idle");
  readonly pincodeArea = signal<string | null>(null);
  /**
   * Delivery for the PIN currently entered. "unavailable" means the quote call
   * itself failed; checkout still works and the server prices delivery then.
   */
  readonly deliveryQuote = signal<
    | { state: "idle" | "loading" | "unavailable" | "unserviceable" }
    | { state: "ready"; shippingPaise: number; estimated: boolean }
  >({ state: "idle" });
  /** Shown when checkout re-quoted delivery and the price differs from what was displayed. */
  readonly priceNotice = signal<string | null>(null);
  private lastResolvedAddress: { city: string; state: string } | null = null;
  readonly formatPaise = formatPaise;
  readonly states: string[] = [
    "Andaman and Nicobar Islands",
    "Andhra Pradesh",
    "Arunachal Pradesh",
    "Assam",
    "Bihar",
    "Chandigarh",
    "Chhattisgarh",
    "Dadra and Nagar Haveli and Daman and Diu",
    "Delhi",
    "Goa",
    "Gujarat",
    "Haryana",
    "Himachal Pradesh",
    "Jammu and Kashmir",
    "Jharkhand",
    "Karnataka",
    "Kerala",
    "Ladakh",
    "Lakshadweep",
    "Madhya Pradesh",
    "Maharashtra",
    "Manipur",
    "Meghalaya",
    "Mizoram",
    "Nagaland",
    "Odisha",
    "Puducherry",
    "Punjab",
    "Rajasthan",
    "Sikkim",
    "Tamil Nadu",
    "Telangana",
    "Tripura",
    "Uttar Pradesh",
    "Uttarakhand",
    "West Bengal",
  ];

  readonly form = this.fb.nonNullable.group({
    name: ["", [Validators.required, Validators.maxLength(120)]],
    email: ["", [Validators.required, Validators.email]],
    /* India-only delivery: keep the courier number to a dialable mobile. */
    phone: ["", [Validators.required, Validators.pattern(/^[6-9][0-9]{9}$/)]],
    line1: ["", [Validators.required, Validators.maxLength(200)]],
    line2: [""],
    city: ["", [Validators.required]],
    state: ["", [Validators.required]],
    postalCode: ["", [Validators.required, Validators.pattern(/^[1-9][0-9]{5}$/)]],
    country: ["India", [Validators.required]],
    acceptedTerms: [false, [Validators.requiredTrue]],
  });

  private readonly requiredFields = [
    "name",
    "email",
    "phone",
    "line1",
    "city",
    "state",
    "postalCode",
  ] as const;

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;

    try {
      const stored = sessionStorage.getItem(CHECKOUT_DRAFT_KEY);
      if (stored) {
        const draft = JSON.parse(stored) as Record<string, unknown>;
        const controls = this.form.controls;
        const savedTextFields = [
          "name",
          "email",
          "phone",
          "line1",
          "line2",
          "city",
          "state",
          "postalCode",
          "country",
        ] as const;
        for (const key of savedTextFields) {
          const value = draft[key];
          if (typeof value === "string") controls[key].setValue(value, { emitEvent: false });
        }
        this.draftRestored.set(this.requiredCompleted > 0);
      }
    } catch {
      sessionStorage.removeItem(CHECKOUT_DRAFT_KEY);
    }

    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => sessionStorage.setItem(CHECKOUT_DRAFT_KEY, JSON.stringify(value)));

    this.form.controls.postalCode.valueChanges
      .pipe(
        tap((pincode) => {
          this.pincodeStatus.set("idle");
          this.pincodeArea.set(null);

          const resolved = this.lastResolvedAddress;
          if (resolved) {
            if (this.form.controls.city.value === resolved.city) {
              this.form.controls.city.setValue("");
            }
            if (this.form.controls.state.value === resolved.state) {
              this.form.controls.state.setValue("");
            }
            this.lastResolvedAddress = null;
          }
        }),
        distinctUntilChanged(),
        switchMap((pincode) => {
          if (!/^[1-9][0-9]{5}$/.test(pincode)) return of(null);

          return timer(250).pipe(
            tap(() => this.pincodeStatus.set("looking")),
            switchMap(() =>
              this.shop.lookupPincode(pincode).pipe(
                catchError(() =>
                  of({ found: false, unavailable: true } satisfies PincodeLookup),
                ),
              ),
            ),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((lookup) => {
        if (lookup) this.applyPincodeLookup(lookup);
      });

    this.form.controls.postalCode.valueChanges
      .pipe(
        distinctUntilChanged(),
        switchMap((pincode) => {
          if (!/^[1-9][0-9]{5}$/.test(pincode)) {
            this.deliveryQuote.set({ state: "idle" });
            return of(null);
          }
          this.deliveryQuote.set({ state: "loading" });
          return this.shop.quoteShipping(pincode).pipe(
            catchError(() => of({ serviceable: true, unavailable: true } as const)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((quote) => {
        if (quote) this.applyShippingQuote(quote);
      });

    const restoredPincode = this.form.controls.postalCode.value;
    if (/^[1-9][0-9]{5}$/.test(restoredPincode)) {
      this.form.controls.postalCode.setValue(restoredPincode);
    }
  }

  get requiredCompleted(): number {
    return this.requiredFields.filter((key) => {
      const control = this.form.controls[key];
      return control.valid && control.value.trim().length > 0;
    }).length;
  }

  get requiredTotal(): number {
    return this.requiredFields.length;
  }

  get contactComplete(): boolean {
    return ["name", "email", "phone"].every((key) => this.form.get(key)?.valid);
  }

  get deliveryComplete(): boolean {
    return ["line1", "city", "state", "postalCode"].every((key) => this.form.get(key)?.valid);
  }

  /** Keep pasted Indian mobile numbers predictable without making people retype them. */
  onPhoneInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    let digits = input.value.replace(/\D/g, "");
    if (digits.length > 10 && digits.startsWith("91")) digits = digits.slice(2);
    digits = digits.slice(0, 10);
    this.form.controls.phone.setValue(digits);
  }

  /** PIN codes are digits only; silently discard spaces often introduced by autofill. */
  onPostalCodeInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.form.controls.postalCode.setValue(input.value.replace(/\D/g, "").slice(0, 6));
  }

  private applyShippingQuote(quote: ShippingQuoteResponse | { serviceable: true; unavailable: true }): void {
    if (!quote.serviceable) {
      this.deliveryQuote.set({ state: "unserviceable" });
    } else if ("unavailable" in quote || quote.shippingPaise === undefined) {
      this.deliveryQuote.set({ state: "unavailable" });
    } else {
      this.deliveryQuote.set({
        state: "ready",
        shippingPaise: quote.shippingPaise,
        estimated: quote.source === "fallback",
      });
    }
  }

  get readyShippingPaise(): number {
    const quote = this.deliveryQuote();
    return quote.state === "ready" ? quote.shippingPaise : 0;
  }

  get shippingEstimated(): boolean {
    const quote = this.deliveryQuote();
    return quote.state === "ready" && quote.estimated;
  }

  /**
   * Checkout re-quotes delivery from scratch, so its figure is the one charged.
   * Show it before the payment window opens, and say so if it moved.
   */
  private adoptServerDelivery(response: CheckoutResponse): void {
    const charged = response.summary.shippingPaise;
    const shown = this.deliveryQuote();
    const before = shown.state === "ready" ? shown.shippingPaise : null;
    this.deliveryQuote.set({
      state: "ready",
      shippingPaise: charged,
      estimated: response.summary.shippingSource === "fallback",
    });
    this.priceNotice.set(
      before !== null && before !== charged
        ? `Delivery has been updated to ${formatPaise(charged)}. Please review your total before paying.`
        : null,
    );
  }

  /** Cart total plus delivery, once delivery is known; null before that. */
  get payableTotalPaise(): number | null {
    const quote = this.deliveryQuote();
    return quote.state === "ready" ? this.cart.merchandiseTotalPaise() + quote.shippingPaise : null;
  }

  private applyPincodeLookup(lookup: PincodeLookup): void {
    if (!lookup.found || !lookup.city || !lookup.state) {
      this.pincodeStatus.set(lookup.unavailable ? "unavailable" : "not-found");
      this.pincodeArea.set(null);
      return;
    }

    this.form.controls.city.setValue(lookup.city);
    if (this.states.includes(lookup.state)) this.form.controls.state.setValue(lookup.state);
    this.lastResolvedAddress = { city: lookup.city, state: lookup.state };
    this.pincodeArea.set(`${lookup.city}, ${lookup.state}`);
    this.pincodeStatus.set("found");
  }

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
      script.onerror = () => reject(new Error("The secure payment page could not be opened. Please try again."));
      document.body.appendChild(script);
    });
  }


  /**
   * The message for a field, or null when there is nothing to say.
   *
   * Written out per field rather than generated from the validator name,
   * because "pattern mismatch" is not something a customer can act on. Each
   * message says what to do, not what is wrong.
   *
   * Shown only once a field has been touched, so the form does not greet
   * someone with a wall of red before they have typed anything.
   */
  errorFor(field: string): string | null {
    const control = this.form.get(field);
    if (!control || !control.errors || !(control.touched || control.dirty)) return null;

    const messages: Record<string, Record<string, string>> = {
      name: { required: "Please enter your name." },
      email: {
        required: "We need an email address. Your order link is sent there.",
        email: "That does not look like an email address.",
      },
      phone: {
        required: "The courier needs a phone number.",
        pattern: "Enter a valid 10-digit Indian mobile number.",
      },
      line1: { required: "Please enter the street address." },
      city: { required: "Please enter the city or district." },
      state: { required: "Please enter the state." },
      postalCode: {
        required: "Please enter the PIN code.",
        pattern: "A PIN code is 6 digits and cannot start with 0.",
      },
      country: { required: "Please enter the country." },
      acceptedTerms: { required: "Please accept the shop terms before continuing." },
    };

    const forField = messages[field] ?? {};
    for (const key of Object.keys(control.errors)) {
      if (forField[key]) return forField[key];
    }
    if (control.errors["maxlength"]) return "Please shorten this entry.";
    return "Please check this field.";
  }

  /** Turn stable API error codes into instructions a customer can act on. */
  private checkoutErrorMessage(response: unknown): string {
    const httpError = response as {
      status?: unknown;
      error?: { code?: unknown; error?: unknown };
    };
    const code = typeof httpError?.error?.code === "string" ? httpError.error.code : "";
    const serverMessage =
      typeof httpError?.error?.error === "string" ? httpError.error.error : "";

    switch (code) {
      case "EMPTY_CART":
        return "Your cart is empty. Add an item before checking out.";
      case "DUPLICATE_LINE":
        return "Your cart changed unexpectedly. Please review it and try again.";
      case "INVALID_QUANTITY":
        return "One item has an invalid quantity. Please review your cart.";
      case "UNKNOWN_UNIT":
      case "INACTIVE_UNIT":
        return "One item in your cart is no longer available.";
      case "COMING_SOON":
        return "One item in your cart is not available to buy yet.";
      case "INSUFFICIENT_STOCK": {
        const available = /only\s+(\d+)\s+available/i.exec(serverMessage)?.[1];
        return available
          ? `Only ${available} left for one selection. Please update the quantity.`
          : "There is not enough stock for one selection. Please update the quantity.";
      }
      case "INVALID_PINCODE":
        return "Please enter a valid 6-digit PIN code.";
      case "UNSERVICEABLE_PINCODE":
        return "We can’t deliver to this PIN code yet.";
      default:
        if (httpError?.status === 429) {
          return "You’ve tried several times. Please wait a minute and try again.";
        }
        return "We couldn’t open secure payment. Please try again.";
    }
  }

  /** True once the customer has pressed Pay and the form was not usable. */
  readonly showSummary = signal<boolean>(false);

  get invalidCount(): number {
    return Object.keys(this.form.controls).filter((k) => this.form.get(k)?.invalid).length;
  }

  async submit(): Promise<void> {
    if (this.deliveryQuote().state === "unserviceable") return;
    if (this.form.invalid || this.cart.items().length === 0) {
      /* Touch everything so every message appears at once, rather than making
       * someone discover the problems one submit at a time. */
      this.form.markAllAsTouched();
      this.showSummary.set(true);
      const firstInvalidKey = Object.keys(this.form.controls).find(
        (key) => this.form.get(key)?.invalid,
      );
      if (firstInvalidKey && isPlatformBrowser(this.platformId)) {
        requestAnimationFrame(() => {
          document
            .querySelector<HTMLElement>(`[formControlName="${firstInvalidKey}"]`)
            ?.focus();
        });
      }
      return;
    }
    this.showSummary.set(false);
    this.priceNotice.set(null);

    this.submitting.set(true);
    this.error.set(null);

    const raw = this.form.getRawValue();
    const value = {
      ...raw,
      name: raw.name.trim(),
      email: raw.email.trim(),
      phone: raw.phone.trim(),
      line1: raw.line1.trim(),
      line2: raw.line2.trim(),
      city: raw.city.trim(),
    };

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
          next: (response) => {
            this.adoptServerDelivery(response);
            this.openPaymentWindow(response);
          },
          error: (response) => {
            this.error.set(this.checkoutErrorMessage(response));
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

    /*
     * Redirect flow, not the JavaScript handler.
     *
     * The handler only runs if the browser is still on this page when payment
     * finishes, and a card paid through 3-D Secure leaves the page entirely
     * (a bank OTP screen in production, the Success/Failure simulation in test
     * mode). When it comes back it lands on Razorpay's own callback URL with
     * this page gone, so the handler never fires and the server is never told.
     *
     * That is not hypothetical: it happened on the very first real payment.
     * Razorpay captured the money and the order stayed unpaid until the
     * reconciliation sweep found it.
     *
     * Setting callback_url makes Razorpay always redirect, so there is one path
     * instead of two and it does not depend on what Razorpay chooses to do
     * internally. The cart is cleared by the matching paid order page, not here:
     * clearing it before the window opens would leave a customer who dismisses
     * Razorpay with an empty cart and no way to retry.
     */
    const returnUrl = `${window.location.origin}/api/shop/orders/${checkout.lookupToken}/return`;

    this.cart.markCheckoutStarted(checkout.lookupToken);

    const razorpay = new Razorpay({
      key: checkout.razorpayKeyId,
      amount: checkout.amountPaise,
      currency: checkout.currency,
      order_id: checkout.razorpayOrderId,
      name: "Indian Olympic Dream",
      description: `Order ${checkout.orderNumber}`,
      prefill: { name: value.name, email: value.email, contact: value.phone },
      callback_url: returnUrl,
      redirect: true,
      modal: {
        ondismiss: () => {
          /* They closed the payment window without paying. The order exists and
           * its stock is held for a few minutes; the sweep releases it if they
           * never come back. */
          this.submitting.set(false);
          this.error.set("Payment was cancelled. You can try again when you’re ready.");
        },
      },
    });

    razorpay.open();
  }

}
