# Shop storefront — current handoff

> Reconciled: 29 October 2026<br>
> Branch: `feat/shop-storefront`<br>
> Pull request: [Indian-Olympic-Dream/indianolympicdream#91](https://github.com/Indian-Olympic-Dream/indianolympicdream/pull/91)<br>
> Release state: **feature-complete branch; core local UAT passed; not merged or deployed**

The full handoff lives in the backend repo, on its `feat/shop` branch:
`iod-content` → [`docs/SHOP_HANDOFF.md`](https://github.com/Indian-Olympic-Dream/iod-content/blob/feat/shop/docs/SHOP_HANDOFF.md).
Read that first; it covers both repos, the rules, and what is left.

This branch (`feat/shop-storefront`) holds the storefront:

| Path | What |
|---|---|
| `src/app/shop/shop.routes.ts` | `/shop`, `/shop/:slug`, `/shop/cart`, `/shop/checkout`, `/shop/orders/:token` |
| `src/app/shop/cart.service.ts` | Cart in `localStorage`; the server re-prices every checkout, so nothing here is trusted |
| `src/app/shop/shop-list.component.ts` | Collection story, both product cards, image carousels, size selection and the First Drop pair offer |
| `src/app/shop/product-detail.component.ts` | Product story, gallery, size guide, fit tip and add-to-cart flow |
| `src/app/shop/cart.component.ts` | Cart quantities, line totals, pair savings and checkout hand-off |
| `src/app/shop/checkout.component.ts` | PIN-first address form, delivery quote, policy acknowledgement, order creation and Razorpay Checkout |
| `src/app/shop/order-lookup.component.ts` | The order page, reached by an unguessable token (no customer accounts) |
| `src/app/shop/shop-policy.component.ts` | Customer-facing shipping, cancellation, returns/refunds, privacy and terms pages |
| `src/app/shop/shop-money.ts` | Paise formatting; amounts arrive in integer paise |
| `proxy.conf.js` | Dev proxy: `/api/shop/*` and media go to the local backend on `:3000` |

## Verified baseline — 28 October 2026

- Frontend unit tests: **91/91 passed** again on 29 October.
- Production build: **passed locally** again on 29 October.
- The complete Test Mode journey was exercised against the backend: catalogue, cart, PIN/address,
  Shiprocket delivery quote, checkout, Razorpay payment, private order page, invoice and email.
- The pair offer was exercised at **₹999 plus delivery**.
- The browser policy links and required checkout acknowledgement were exercised.

## Run locally

1. Start `iod-content` on `http://localhost:3000`.
2. In this repository run `npm install && npm run dev`.
3. Open `http://localhost:4200/shop`.

Use `localhost:3000` for the Payload admin as well. Mixing `127.0.0.1` and `localhost` can make
admin relationship fields behave as cross-origin requests.

## What remains before release

This branch is intentionally not merged into `master` and is not deployed. Remaining work is
release work rather than another storefront redesign:

1. deploy the reviewed backend and frontend commits together;
2. seed the production catalogue and inventory;
3. configure permanent Live Mode Razorpay webhook and scheduled jobs;
4. run one controlled real-money purchase/refund smoke test; and
5. verify the first manual Shiprocket fulfilment end to end.

The launch is currently documented as **non-GST**. GST calculation and CGST/SGST/IGST display are
a future release after registration and tax treatment are confirmed; they are not unfinished work
for this launch.
