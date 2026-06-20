import { vi } from "vitest";

/**
 * A small, deterministic stand-in for the `chrome.*` extension APIs the overlay
 * code touches at runtime. jsdom doesn't provide `chrome`, so without this any
 * hook/component that calls `chrome.runtime.sendMessage` (directly or via
 * `sendRuntimeMessage`) would throw on render.
 *
 * `runtime.sendMessage` routes by `message.type` to a benign default response so
 * that components render in their empty/idle state. Individual tests override
 * behavior per case with `chrome.runtime.sendMessage.mockResolvedValueOnce(...)`
 * or `.mockImplementation(...)`.
 */

const DEFAULT_UI = { open: false, activeTab: "summary" };

/** Returns a sensible empty response for each request message the overlay sends. */
function defaultResponse(message: { type?: string }): unknown {
  switch (message?.type) {
    case "SHOPIQ_GET_STATE":
      return { state: { status: "idle" }, ui: { ...DEFAULT_UI }, scanResult: undefined };
    case "SHOPIQ_SET_UI":
      return { ui: { ...DEFAULT_UI } };
    case "SHOPIQ_GET_PRICES":
      return { result: { query: "", prices: [], fetchedAt: "", cached: false } };
    case "SHOPIQ_GET_COMPARISONS":
      return { result: { prices: [], reddit: [], youtube: [] } };
    default:
      return {};
  }
}

type ChromeMock = {
  runtime: {
    sendMessage: ReturnType<typeof vi.fn>;
    onMessage: { addListener: ReturnType<typeof vi.fn>; removeListener: ReturnType<typeof vi.fn> };
    lastError: undefined;
  };
  tabs: {
    sendMessage: ReturnType<typeof vi.fn>;
    query: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  storage: {
    local: { get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn> };
    session: {
      get: ReturnType<typeof vi.fn>;
      set: ReturnType<typeof vi.fn>;
      remove: ReturnType<typeof vi.fn>;
    };
    onChanged: { addListener: ReturnType<typeof vi.fn>; removeListener: ReturnType<typeof vi.fn> };
  };
};

function createChromeMock(): ChromeMock {
  return {
    runtime: {
      sendMessage: vi.fn((message: { type?: string }) => Promise.resolve(defaultResponse(message))),
      onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
      lastError: undefined
    },
    tabs: {
      sendMessage: vi.fn(() => Promise.resolve(undefined)),
      query: vi.fn(() => Promise.resolve([{ id: 1, url: "https://www.amazon.in/dp/B0TEST00000" }])),
      update: vi.fn(() => Promise.resolve(undefined))
    },
    storage: {
      local: { get: vi.fn(() => Promise.resolve({})), set: vi.fn(() => Promise.resolve(undefined)) },
      session: {
        get: vi.fn(() => Promise.resolve({})),
        set: vi.fn(() => Promise.resolve(undefined)),
        remove: vi.fn(() => Promise.resolve(undefined))
      },
      onChanged: { addListener: vi.fn(), removeListener: vi.fn() }
    }
  };
}

/** Installs a fresh chrome mock on the global object. Call once in test setup. */
export function installChromeMock(): void {
  (globalThis as unknown as { chrome: ChromeMock }).chrome = createChromeMock();
}

/** Resets the chrome mock to its default behavior between tests. */
export function resetChromeMock(): void {
  installChromeMock();
}

/** Typed accessor for the installed mock, so tests can tweak it without casts. */
export function getChromeMock(): ChromeMock {
  return (globalThis as unknown as { chrome: ChromeMock }).chrome;
}
