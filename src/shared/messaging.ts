import type { ExtensionMessage } from "./types";

export function sendRuntimeMessage<TResponse = unknown>(message: ExtensionMessage): Promise<TResponse> {
  return chrome.runtime.sendMessage(message);
}

export function sendTabMessage<TResponse = unknown>(
  tabId: number,
  message: ExtensionMessage
): Promise<TResponse> {
  return chrome.tabs.sendMessage(tabId, message);
}
