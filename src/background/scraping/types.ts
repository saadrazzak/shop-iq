import type { ProductCategory } from "../../shared/types";

/** Structured attributes parsed from a product title, used for match scoring. */
export interface ProductAttributes {
  brand?: string;
  model?: string;
  storage?: string;
  ram?: string;
  color?: string;
  variant?: string;
  category?: string;
}

/** What the pricing service needs to run a comparison (mirrors the old backend input). */
export interface PriceComparisonInput {
  title: string;
  url: string;
  price?: string;
  mrp?: string;
  image?: string;
  category?: ProductCategory;
}
