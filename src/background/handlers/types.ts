import type { ExtensionMessage } from "../../shared/types";

/** Everything a message handler needs beyond the (narrowed) message itself. */
export type HandlerContext = {
  tabId: number;
  sender: chrome.runtime.MessageSender;
  sendResponse: (response?: unknown) => void;
};

/** Narrows the `ExtensionMessage` union to the variant with the given `type`. */
export type MessageOf<T extends ExtensionMessage["type"]> = Extract<ExtensionMessage, { type: T }>;
