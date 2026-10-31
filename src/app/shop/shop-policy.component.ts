import { Component, inject } from "@angular/core";
import { ActivatedRoute, RouterLink, RouterLinkActive } from "@angular/router";
import { Title } from "@angular/platform-browser";
import { MatIconModule } from "@angular/material/icon";
import { ShopChromeComponent } from "./shop-chrome.component";
import { ShopPolicyFooterComponent } from "./shop-policy-footer.component";

type PolicyKey = "terms" | "shipping" | "returns" | "privacy" | "contact";

interface PolicySection {
  title: string;
  paragraphs: string[];
  bullets?: string[];
  note?: string;
}

interface PolicyPage {
  eyebrow: string;
  title: string;
  intro: string;
  sections: PolicySection[];
}

const POLICY_PAGES: Record<PolicyKey, PolicyPage> = {
  terms: {
    eyebrow: "THE AGREEMENT",
    title: "Terms of Sale",
    intro: "The straightforward terms that apply when you buy an IOD original.",
    sections: [
      {
        title: "About IOD Shop",
        paragraphs: [
          "IOD Shop is operated by Indian Olympic Dream Sports Pvt. Ltd. We currently accept orders for delivery within India. Products are sold for personal use and may not be purchased for unauthorised resale.",
          "The Golden Shot and The Golden Throw are independent IOD original artworks inspired by Indian sporting history. They are not official merchandise and are not affiliated with or endorsed by any athlete, federation, organising committee, the Indian Olympic Association or the International Olympic Committee.",
        ],
      },
      {
        title: "Products and fit",
        paragraphs: [
          "We try to show each product accurately. Screen colour and brightness can make the physical garment look slightly different. Please check the description, available sizes, care information and size chart before ordering.",
          "Our fit tip is guidance, not a guarantee. The garment measurements in the size chart are the best way to select a size.",
        ],
      },
      {
        title: "Price, stock and the First Drop",
        paragraphs: [
          "The product price, any applicable tax and delivery charge shown in the final order summary are the amounts charged. Availability is confirmed at checkout. Adding an item to the cart does not reserve it.",
          "The First Drop offer applies when one Golden Shot tee and one Golden Throw tee are purchased in the same order. Their separate-item total is ₹1,098 and the pair price is ₹999, before delivery and any applicable tax. Additional units are charged at their normal product price.",
        ],
      },
      {
        title: "Payment and order acceptance",
        paragraphs: [
          "Payments are processed securely by Razorpay. IOD does not receive or store your complete card, UPI or bank credentials.",
          "Your order is confirmed after payment succeeds and the items remain available. We send the order confirmation and secure order link to the email address supplied at checkout. If payment succeeds but we cannot fulfil the order, we will contact you and refund the affected amount to the original payment method.",
        ],
      },
      {
        title: "Cancellation",
        paragraphs: [
          "Contact us as soon as possible if you need to cancel. A paid order may be cancelled for a full refund until it has been dispatched. Once dispatched, it is handled under our returns and delivery policies.",
        ],
      },
      {
        title: "Your information",
        paragraphs: [
          "Please provide a complete name, phone number, email address, street address and valid six-digit PIN code. Check the city and state suggested from the PIN code before payment. Incorrect information can delay delivery.",
          "These terms do not remove any rights available under applicable Indian consumer law.",
        ],
      },
    ],
  },
  shipping: {
    eyebrow: "FROM IOD TO YOU",
    title: "Shipping",
    intro: "What happens between payment confirmation and the parcel reaching your door.",
    sections: [
      {
        title: "Where we deliver",
        paragraphs: [
          "We currently deliver only to PIN codes we can serve within India. Delivery availability at checkout does not guarantee an arrival date.",
        ],
      },
      {
        title: "Delivery charge",
        paragraphs: [
          "IOD requests a delivery quote using your destination PIN code. The final delivery charge is shown before payment and is not increased afterwards.",
          "If a live courier rate is temporarily unavailable, checkout may show a standard delivery charge of ₹150. That amount is clearly identified before payment.",
        ],
      },
      {
        title: "Dispatch and tracking",
        paragraphs: [
          "We aim to dispatch paid orders within two business days. Business days exclude Sundays and public holidays at the dispatch location.",
          "When tracking is available, it is sent to the email address supplied at checkout. Your secure order link also shows the latest update from IOD. Keep that link private because anyone with it can view your order information.",
        ],
      },
      {
        title: "Delivery estimates",
        paragraphs: [
          "Courier timelines are estimates, not guaranteed arrival dates. Severe weather, service disruption, regional restrictions and other events outside IOD's control may cause delay. We will help trace a delayed parcel.",
        ],
      },
      {
        title: "Incorrect address or refused parcel",
        paragraphs: [
          "Contact us before dispatch if an address needs correction. If a parcel returns because the supplied address was incomplete or incorrect, or because delivery was refused, we may ask you to pay the new courier charge before re-dispatch.",
          "Any deduction from a refund is limited to costs disclosed in advance and actually incurred, subject to applicable law.",
        ],
      },
      {
        title: "Marked delivered but not received",
        paragraphs: [
          "Contact us promptly with your order number. We will raise a trace with the courier. Please also check with household members, neighbours, reception or building security where applicable.",
        ],
      },
    ],
  },
  returns: {
    eyebrow: "WE WILL MAKE IT RIGHT",
    title: "Returns & Exchanges",
    intro: "Clear rules for damaged items, size exchanges, cancellations and refunds.",
    sections: [
      {
        title: "Wrong, damaged or defective item",
        paragraphs: [
          "Contact us within seven calendar days of delivery if an item is wrong, damaged, defective or materially different from its description. Include the order number, a short explanation and clear photographs that help us understand the issue.",
          "Once confirmed, IOD will arrange an appropriate replacement or refund. We bear reasonable return and replacement-delivery costs for a confirmed wrong, damaged, defective or materially misdescribed item.",
        ],
        note: "Photographs help us resolve the issue. They do not remove your statutory consumer rights.",
      },
      {
        title: "Size exchange",
        paragraphs: [
          "One size exchange may be requested within seven calendar days of delivery, subject to stock. The tee must be unused, unwashed, unworn other than for a brief fit check, and returned in its original condition.",
          "For a voluntary size exchange, you pay the return courier charge and IOD pays the delivery charge for one replacement. If the requested size is unavailable, we will explain the available options before you return the item.",
        ],
      },
      {
        title: "Change of mind",
        paragraphs: [
          "We do not offer a cash refund only because you changed your mind. The size-exchange promise and all remedies for wrong, damaged, defective or materially misdescribed products still apply.",
        ],
      },
      {
        title: "First Drop pair",
        paragraphs: [
          "The First Drop is a discounted pair. If one item needs an approved refund, the refund is based on that item's share of the ₹999 pair price, not its separate-item price. An exchange does not remove the offer.",
        ],
      },
      {
        title: "Refund timing",
        paragraphs: [
          "IOD initiates an approved refund to the original payment method within three business days after the returned item is received and checked, or after approval where no return is required.",
          "Razorpay and your bank or payment provider may take additional time to credit the amount. We send confirmation when the refund has been initiated. A refund cannot be redirected to a different bank account, card or UPI ID.",
        ],
      },
      {
        title: "Start a request",
        paragraphs: [
          "Email contact@iodsports.com with your order number and the email address or phone number used for the order, or call +91 87800 33861 during support hours.",
        ],
      },
    ],
  },
  privacy: {
    eyebrow: "YOUR INFORMATION",
    title: "Privacy Notice",
    intro: "What IOD Shop collects, why we need it and who helps us fulfil your order.",
    sections: [
      {
        title: "Information we collect",
        paragraphs: ["When you visit or buy from IOD Shop, we may receive:"],
        bullets: [
          "Your name, email address and phone number",
          "Your billing and delivery address, city, state and PIN code",
          "Order, product, size, price, delivery and refund information",
          "Razorpay payment, order and transaction identifiers and payment status",
          "Shiprocket or courier shipment, tracking and delivery information",
          "Support messages and information supplied to resolve a request",
          "Basic technical and security information such as IP address, browser details and access logs",
        ],
        note: "IOD does not receive or store complete card, UPI or bank credentials entered in Razorpay Checkout.",
      },
      {
        title: "Why we use it",
        paragraphs: ["We use this information to:"],
        bullets: [
          "Take payment, confirm and fulfil your order",
          "Reserve stock, calculate delivery and prevent duplicate orders",
          "Create invoices and maintain accounting records",
          "Arrange delivery and communicate tracking information",
          "Provide cancellations, exchanges, returns, refunds and support",
          "Detect abuse, secure the service and meet legal or regulatory requirements",
        ],
      },
      {
        title: "Who receives it",
        paragraphs: [
          "Information is shared only as needed with service providers such as Razorpay, Shiprocket, the selected courier, email infrastructure, website hosting and professional advisers, and with public authorities where required by law. Their own privacy terms may also apply to their services.",
          "IOD does not sell customer personal information.",
        ],
      },
      {
        title: "Retention",
        paragraphs: [
          "Order, invoice and transaction records are retained for the period required for accounting, tax, fraud prevention and legal purposes. Delivery and support information is retained only while reasonably needed for fulfilment, dispute handling and those record-keeping duties.",
        ],
      },
      {
        title: "Your choices and requests",
        paragraphs: [
          "You may ask IOD to provide information about, correct or erase personal data, or may raise a privacy complaint, subject to records we must retain by law. Email contact@iodsports.com from the address used for your order and include the order number where relevant. We may need to verify the request before acting.",
        ],
      },
      {
        title: "Saved cart and order links",
        paragraphs: [
          "IOD Shop saves your cart and unfinished checkout on your device. Clearing browser data may remove them. Your order can be viewed through a secure, unique link without creating an account. Anyone with that link can view the order, so keep it private.",
        ],
      },
    ],
  },
  contact: {
    eyebrow: "WE ARE HERE TO HELP",
    title: "Contact IOD Shop",
    intro: "Order help, delivery questions and grievance redressal in one place.",
    sections: [
      {
        title: "Customer care",
        paragraphs: [
          "Email contact@iodsports.com at any time or call +91 87800 33861 from Monday to Friday, 10:00 AM to 6:00 PM IST, excluding public holidays.",
          "Include your order number when asking about payment, delivery, exchange, return or refund. Never send card details, UPI PINs, OTPs or banking passwords.",
        ],
      },
      {
        title: "Grievance Officer",
        paragraphs: [
          "Ankush Agrawal, Grievance Officer",
          "Email: contact@iodsports.com | Mobile: +91 87800 33861",
          "A grievance is acknowledged within 48 hours. We provide a copy of the complaint as recorded and aim to resolve it within one month from receipt, subject to any shorter period required by applicable law.",
        ],
      },
      {
        title: "Seller details",
        paragraphs: [
          "Indian Olympic Dream Sports Pvt. Ltd.",
          "AT & PO Ambaji, Behind Mayur Marble, Ambaji, Banaskantha, Danta, Gujarat, India, 385110",
          "CIN: U93110GJ2025PTC169746 | Website: iodsports.com",
        ],
      },
      {
        title: "National Consumer Helpline",
        paragraphs: [
          "If your concern remains unresolved, you may also approach the Government of India's National Consumer Helpline at consumerhelpline.gov.in or call 1915 or 1800 11 4000.",
        ],
      },
    ],
  },
};

@Component({
  selector: "app-shop-policy",
  standalone: true,
  imports: [RouterLink, RouterLinkActive, MatIconModule, ShopChromeComponent, ShopPolicyFooterComponent],
  templateUrl: "./shop-policy.component.html",
  styleUrl: "./shop-policy.component.scss",
})
export class ShopPolicyComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly title = inject(Title);

  readonly links: Array<{ key: PolicyKey; label: string }> = [
    { key: "terms", label: "Terms" },
    { key: "shipping", label: "Shipping" },
    { key: "returns", label: "Returns" },
    { key: "privacy", label: "Privacy" },
    { key: "contact", label: "Contact" },
  ];

  readonly key = (this.route.snapshot.data["policy"] as PolicyKey | undefined) ?? "terms";
  readonly page = POLICY_PAGES[this.key];

  constructor() {
    this.title.setTitle(`${this.page.title} | IOD Shop`);
  }
}
