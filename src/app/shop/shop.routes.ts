import { Routes } from "@angular/router";

export const SHOP_ROUTES: Routes = [
  {
    path: "",
    loadComponent: () =>
      import("./shop-list.component").then((m) => m.ShopListComponent),
  },
  {
    path: "cart",
    loadComponent: () => import("./cart.component").then((m) => m.CartComponent),
  },
  {
    path: "checkout",
    loadComponent: () =>
      import("./checkout.component").then((m) => m.CheckoutComponent),
  },
  {
    /*
     * Order lookup lives under the shop so the whole feature is one lazy chunk.
     * The token in the URL is the only credential (ADR-009), so this route must
     * never be logged with its parameter intact.
     */
    path: "orders/:token",
    loadComponent: () =>
      import("./order-lookup.component").then((m) => m.OrderLookupComponent),
  },
  {
    path: ":slug",
    loadComponent: () =>
      import("./product-detail.component").then((m) => m.ProductDetailComponent),
  },
];
