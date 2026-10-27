import { Component } from "@angular/core";
import { RouterLink } from "@angular/router";

@Component({
  selector: "app-shop-policy-footer",
  standalone: true,
  imports: [RouterLink],
  template: `
    <footer class="shop-footer" aria-label="IOD Shop information">
      <div class="shop-footer__inner">
        <div class="shop-footer__identity">
          <a routerLink="/shop" aria-label="IOD Shop home">
            <img src="assets/shop/iod-shop-symbol.svg" alt="" />
            <span><strong>IOD</strong> Shop</span>
          </a>
          <p>Independent originals inspired by Indian sporting history.</p>
        </div>

        <nav class="shop-footer__links" aria-label="Shop policies">
          <a routerLink="/shop/policies/terms">Terms</a>
          <a routerLink="/shop/policies/shipping">Shipping</a>
          <a routerLink="/shop/policies/returns">Returns</a>
          <a routerLink="/shop/policies/privacy">Privacy</a>
          <a routerLink="/shop/policies/contact">Contact</a>
        </nav>

        <address class="shop-footer__support">
          <span>Need help with an order?</span>
          <a href="mailto:contact&#64;iodsports.com">contact&#64;iodsports.com</a>
          <a href="tel:+918780033861">+91 87800 33861</a>
          <small>Mon to Fri, 10 AM to 6 PM IST</small>
        </address>

        <div class="shop-footer__legal">
          <span>Indian Olympic Dream Sports Pvt. Ltd.</span>
          <span>CIN U93110GJ2025PTC169746</span>
          <span>© 2026 IOD Sports</span>
        </div>
      </div>
    </footer>
  `,
  styleUrl: "./shop-policy-footer.component.scss",
})
export class ShopPolicyFooterComponent {}
