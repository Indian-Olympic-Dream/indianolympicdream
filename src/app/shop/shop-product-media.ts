import { CatalogueProduct } from "./shop.models";

/**
 * The V3.1 launch catalogue is intentionally limited to the two physical tees
 * that IOD already has in hand. Keeping their approved storefront photography
 * here prevents design proofs and unfinished concepts from leaking into the
 * public shop while Payload remains the source of truth for price and stock.
 */
const LAUNCH_MEDIA: Record<string, CatalogueProduct["images"]> = {
  "the-golden-shot-tee": [
    {
      url: "/assets/shop/products/golden-shot-front.jpg",
      alt: "Front of The Golden Shot black IOD T-shirt",
    },
    {
      url: "/assets/shop/products/golden-shot-back.jpg",
      alt: "Back of The Golden Shot black IOD T-shirt with the IOD neck mark",
    },
    {
      url: "/assets/shop/products/golden-shot-artwork.png",
      alt: "The locked Golden Shot vector artwork used for production",
    },
  ],
  "the-golden-throw-tee": [
    {
      url: "/assets/shop/products/golden-throw-front.jpg",
      alt: "Front of The Golden Throw natural ivory IOD T-shirt",
    },
    {
      url: "/assets/shop/products/golden-throw-back.jpg",
      alt: "Back of The Golden Throw natural ivory IOD T-shirt with the IOD neck mark",
    },
    {
      url: "/assets/shop/products/golden-throw-artwork.png",
      alt: "The locked Golden Throw natural ivory vector artwork used for production",
    },
  ],
};

const LAUNCH_TITLES: Record<string, string> = {
  "the-golden-shot-tee": "The Golden Shot",
  "the-golden-throw-tee": "The Golden Throw",
};

export function isLaunchProduct(product: CatalogueProduct): boolean {
  return !product.comingSoon && Object.prototype.hasOwnProperty.call(LAUNCH_MEDIA, product.slug);
}

export function withLaunchMedia(product: CatalogueProduct): CatalogueProduct {
  const images = LAUNCH_MEDIA[product.slug];
  return images ? { ...product, title: LAUNCH_TITLES[product.slug] ?? product.title, images } : product;
}
