import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  extractAmazonProduct,
  extractAmazonReviewPageReviews,
  isAmazonProductPage,
  isAmazonReviewPage
} from "./amazon";

// Amazon ASINs are exactly 10 chars (the URL pattern captures `[A-Z0-9]{10}`).
const ASIN = "B0CXYZ1234";
const PRODUCT_URL = `https://www.amazon.in/Some-Product/dp/${ASIN}/`;
const REVIEW_URL = `https://www.amazon.in/product-reviews/${ASIN}/`;
const OTHER_URL = "https://www.amazon.in/gp/cart/view.html";

/** Points `window.location` at `href` for URL-pattern-dependent scrapers. */
function setUrl(href: string): void {
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: new URL(href)
  });
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("page detection", () => {
  it("recognizes product (dp) pages", () => {
    setUrl(PRODUCT_URL);
    expect(isAmazonProductPage()).toBe(true);
    expect(isAmazonReviewPage()).toBe(false);
  });

  it("recognizes review (product-reviews) pages", () => {
    setUrl(REVIEW_URL);
    expect(isAmazonReviewPage()).toBe(true);
    expect(isAmazonProductPage()).toBe(false);
  });

  it("treats other Amazon pages as neither", () => {
    setUrl(OTHER_URL);
    expect(isAmazonProductPage()).toBe(false);
    expect(isAmazonReviewPage()).toBe(false);
  });
});

describe("extractAmazonProduct", () => {
  beforeEach(() => setUrl(PRODUCT_URL));

  it("returns undefined off a product page", () => {
    setUrl(OTHER_URL);
    expect(extractAmazonProduct()).toBeUndefined();
  });

  it("returns undefined when there is no product title", () => {
    document.body.innerHTML = `<div class="a-price"><span class="a-offscreen">₹999</span></div>`;
    expect(extractAmazonProduct()).toBeUndefined();
  });

  it("scrapes the core product fields and visible reviews", () => {
    document.body.innerHTML = `
      <span id="productTitle">Wireless Headphones</span>
      <div class="a-price"><span class="a-offscreen">₹2,499</span></div>
      <div id="acrPopover"><span class="a-icon-alt">4.3 out of 5 stars</span></div>
      <span id="acrCustomerReviewText">1,204 ratings</span>
      <div id="landingImage-wrap"><img id="landingImage" src="https://img/headphones.jpg" /></div>
      <div id="localTopReviewsList">
        <div data-hook="review" id="R1">
          <span data-hook="review-title">Great sound</span>
          <span data-hook="review-body">Crisp audio and deep bass.</span>
          <i data-hook="review-star-rating">5.0 out of 5 stars</i>
          <span class="a-profile-name">Asha</span>
        </div>
        <div data-hook="review" id="R2">
          <span data-hook="review-body"></span>
        </div>
      </div>
    `;

    const product = extractAmazonProduct();
    expect(product).toBeDefined();
    expect(product?.title).toBe("Wireless Headphones");
    expect(product?.asin).toBe(ASIN);
    expect(product?.price).toBe("₹2,499");
    expect(product?.rating).toBe("4.3 out of 5 stars");
    expect(product?.reviewCount).toBe("1,204 ratings");
    expect(product?.imageUrl).toBe("https://img/headphones.jpg");
    expect(product?.url).toBe(PRODUCT_URL);
    // R2 has an empty body and is filtered out; only R1 survives.
    expect(product?.reviews).toHaveLength(1);
    expect(product?.reviews[0]).toMatchObject({ title: "Great sound", rating: 5, author: "Asha" });
  });
});

describe("extractAmazonReviewPageReviews", () => {
  it("returns [] off a review page", () => {
    setUrl(PRODUCT_URL);
    expect(extractAmazonReviewPageReviews()).toEqual([]);
  });

  it("extracts non-empty reviews from a review listing page", () => {
    setUrl(REVIEW_URL);
    document.body.innerHTML = `
      <div data-hook="review">
        <span data-hook="review-title">Worth it</span>
        <span data-hook="review-body">Battery lasts all day.</span>
        <i data-hook="review-star-rating">4.0 out of 5 stars</i>
      </div>
      <div data-hook="review">
        <span data-hook="review-body">   </span>
      </div>
    `;
    const reviews = extractAmazonReviewPageReviews();
    expect(reviews).toHaveLength(1);
    expect(reviews[0]).toMatchObject({ title: "Worth it", rating: 4, source: "review-page" });
  });
});
