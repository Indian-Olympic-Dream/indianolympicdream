import { HttpClient, HttpResponse } from "@angular/common/http";
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
  PincodeLookup,
} from "./shop.models";
import { isLaunchProduct, sortLaunchProducts, withLaunchMedia } from "./shop-product-media";

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
      .pipe(
        map((response) =>
          sortLaunchProducts(response.products.filter(isLaunchProduct).map(withLaunchMedia)),
        ),
      );
  }

  getProduct(slug: string): Observable<CatalogueProduct> {
    return this.http
      .get<{ product: CatalogueProduct }>(`${this.base}/catalogue`, { params: { slug } })
      .pipe(
        map((response) => {
          if (!response.product || !isLaunchProduct(response.product)) {
            throw new Error("Product is not part of the V3.1 launch catalogue.");
          }
          return withLaunchMedia(response.product);
        }),
      );
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

  lookupPincode(pincode: string): Observable<PincodeLookup> {
    return this.http.get<PincodeLookup>(`${this.base}/pincode/${pincode}`);
  }

  /**
   * Confirm payment after Razorpay hands control back.
   *
   * The server re-checks with Razorpay rather than trusting this call, so a
   * failure here is a display problem, not a payment problem. The webhook and
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

  /**
   * The invoice PDF for a paid order. Goes through the same /api/shop proxy as
   * everything else; the token in the path is the only credential (ADR-009).
   * Resolves with the response so the caller can read the file name the server chose.
   */
  downloadInvoice(token: string): Observable<HttpResponse<Blob>> {
    return this.http.get(`${this.base}/orders/${token}/invoice`, {
      observe: "response",
      responseType: "blob",
    });
  }

  getOrder(token: string): Observable<OrderView> {
    return this.http.get<OrderView>(`${this.base}/orders/${token}`);
  }
}
