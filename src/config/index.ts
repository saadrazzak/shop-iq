import type { RemoteConfig } from "./types";
import defaultConfig from "./default-config.json";

const CONFIG = defaultConfig as RemoteConfig;

/** Synchronous accessor used throughout the codebase. Always returns the bundled config. */
export function getConfig(): RemoteConfig {
  return CONFIG;
}

/**
 * Resolves a dot-separated key path against an object, e.g.
 * `resolveByPath(data, "a.b.c")` → `data?.a?.b?.c`. Used for JSON paths
 * stored in the config (YouTube results section path, scraper state paths).
 */
export function resolveByPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce((acc: unknown, key: string) => {
    if (acc == null || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
}
