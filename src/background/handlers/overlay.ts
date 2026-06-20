import { getOverlayUi, getProductState, getScanResult, setOverlayUi } from "../state";
import type { HandlerContext, MessageOf } from "./types";

/** Returns the overlay's full snapshot for the tab: product state, UI state, and the latest scan result. */
export async function handleGetState(ctx: HandlerContext): Promise<void> {
  const { tabId, sendResponse } = ctx;
  sendResponse({
    state: (await getProductState(tabId)) ?? { status: "idle" },
    ui: await getOverlayUi(tabId),
    scanResult: await getScanResult(tabId)
  });
}

/** Persists an overlay UI patch (open/closed, active tab) for the tab. */
export async function handleSetUi(ctx: HandlerContext, message: MessageOf<"SHOPIQ_SET_UI">): Promise<void> {
  const { tabId, sendResponse } = ctx;
  sendResponse({ ui: await setOverlayUi(tabId, message.ui) });
}
