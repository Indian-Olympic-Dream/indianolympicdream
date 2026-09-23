import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { environment } from "../../environments/environment";
import {
  CatalogueProduct,
  CheckoutAddress,
  CheckoutContact,
  CheckoutResponse,
  OrderView,
} from "./shop.models";

@Injectable({ providedIn: "root" })
export class ShopService {
  private readonly http = inject(HttpClient);
  private readonly base: string = `${environment.payload_url}/api/shop`;

  /**
   * The catalogue, with real availability.
   *
   * Deliberately not `/api/products`: stock left is the stored figure minus live
   * checkout holds, and those holds are not public. Reading the collection
   * directly would show the last item as available while someone is paying for it.
   */
  listProducts(): Observable<CatalogueProduct[]> {
    return this.http
      .get<{ products: CatalogueProduct[] }>(`${this.base}/catalogue`)
      .pipe(map((response) => response.products));
  }

  getProduct(slug: string): Observable<CatalogueProduct> {
    return this.http
      .get<{ product: CatalogueProduct }>(`${this.base}/catalogue`, { params: { slug } })
      .pipe(map((response) => response.product));
  }

  /**
   * Start a checkout.
   *
   * Sends identifiers and quantities only. The response carries the
   * authoritative amount, which the page displays but never computes.
   */
  startCheckout(
    lines: Array<{ productId: string; variantId: string | null; quantity: number }>,
    contact: CheckoutContact,
    shippingAddress: CheckoutAddress,
  ): Observable<CheckoutResponse> {
    return this.http.post<CheckoutResponse>(`${this.base}/checkout`, {
      lines,
      contact,
      shippingAddress,
    });
  }

  /**
   * Confirm payment after Razorpay hands control back.
   *
   * The server re-checks with Razorpay rather than trusting this call, so a
   * failure here is a display problem, not a payment problem — the webhook and
   * the sweep will still settle the order.
   */
  verifyPayment(
    token: string,
    razorpayPaymentId: string,
    razorpaySignature: string,
  ): Observable<{ status: string; paid: boolean }> {
    return this.http.post<{ status: string; paid: boolean }>(
      `${this.base}/orders/${token}/verify`,
      { razorpayPaymentId, razorpaySignature },
    );
  }

  getOrder(token: string): Observable<OrderView> {
    return this.http.get<OrderView>(`${this.base}/orders/${token}`);
  }
}
