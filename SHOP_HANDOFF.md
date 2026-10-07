# Shop — handoff (storefront)

The full handoff lives in the backend repo, on its `feat/shop` branch:
`iod-content` → [`docs/SHOP_HANDOFF.md`](https://github.com/Indian-Olympic-Dream/iod-content/blob/feat/shop/docs/SHOP_HANDOFF.md).
Read that first; it covers both repos, the rules, and what is left.

This branch (`feat/shop-storefront`) holds the storefront:

| Path | What |
|---|---|
| `src/app/shop/shop.routes.ts` | `/shop`, `/shop/:slug`, `/shop/cart`, `/shop/checkout`, `/shop/orders/:token` |
| `src/app/shop/cart.service.ts` | Cart in `localStorage`; the server re-prices every checkout, so nothing here is trusted |
| `src/app/shop/checkout.component.ts` | Form → `POST /api/shop/checkout` → Razorpay popup → Razorpay redirects back to the backend |
| `src/app/shop/order-lookup.component.ts` | The order page, reached by an unguessable token (no customer accounts) |
| `src/app/shop/shop-money.ts` | Paise formatting; amounts arrive in integer paise |
| `proxy.conf.js` | Dev proxy: `/api/shop/*` and media go to the local backend on `:3000` |

Run: `npm install && npm run dev` → http://localhost:4200/shop, with the backend running on `:3000`.

**Not merged and not deployed on purpose.** Do not merge to `master` or deploy until the directors
say so. Still to come here: showing the GST lines (CGST+SGST or IGST) at checkout once the backend
computes them.
