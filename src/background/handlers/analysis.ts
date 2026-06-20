import type { ProductState } from "../../shared/types";
import { analyzeAndStore, fetchComparisons, fetchPrices } from "../api";
import { getProductState, setProductState } from "../state";
import type { HandlerContext, MessageOf } from "./types";

/** Analyzes a product on demand (the "Analyze" button), using the provided product or the tab's current one. */
export async function handleAnalyzeProduct(
  ctx: HandlerContext,
  message: MessageOf<"SHOPIQ_ANALYZE_PRODUCT">
): Promise<void> {
  const { tabId, sendResponse } = ctx;
  const current = await getProductState(tabId);
  const product = message.product ?? current?.product;

  if (!product) {
    const state: ProductState = {
      status: "error",
      error: "No Amazon India product data found on this tab."
    };
    await setProductState(tabId, state);
    sendResponse({ state });
    return;
  }

  await setProductState(tabId, { status: "analyzing", product, analysis: current?.analysis });

  try {
    const state = await analyzeAndStore(tabId, product);
    sendResponse({ state });
  } catch (error) {
    const state: ProductState = {
      status: "error",
      product,
      error: error instanceof Error ? error.message : "Unknown analysis error."
    };
    await setProductState(tabId, state);
    sendResponse({ state });
  }
}

/** Fetches retailer prices + Reddit/YouTube discussions for the Social tab. */
export async function handleGetComparisons(
  ctx: HandlerContext,
  message: MessageOf<"SHOPIQ_GET_COMPARISONS">
): Promise<void> {
  const { sendResponse } = ctx;
  const product = message.product;

  if (!product) {
    sendResponse({ result: { prices: [], reddit: [], youtube: [], error: "No product data" } });
    return;
  }

  try {
    sendResponse({ result: await fetchComparisons(product) });
  } catch (error) {
    console.error("Comparison error:", error);
    sendResponse({
      result: {
        prices: [],
        reddit: [],
        youtube: [],
        error: error instanceof Error ? error.message : "Failed to fetch comparisons"
      }
    });
  }
}

/** Fetches the live price comparison for the Price History tab. */
export async function handleGetPrices(
  ctx: HandlerContext,
  message: MessageOf<"SHOPIQ_GET_PRICES">
): Promise<void> {
  const { sendResponse } = ctx;
  const product = message.product;
  const empty = { query: "", prices: [], fetchedAt: "", cached: false };

  if (!product) {
    sendResponse({ result: { ...empty, error: "No product data" } });
    return;
  }

  try {
    sendResponse({ result: await fetchPrices(product, message.forceRefresh) });
  } catch (error) {
    console.error("Price comparison error:", error);
    sendResponse({
      result: { ...empty, error: error instanceof Error ? error.message : "Failed to fetch prices" }
    });
  }
}
