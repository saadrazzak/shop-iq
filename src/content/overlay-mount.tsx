import { createRoot } from "react-dom/client";
import { OverlayRoot } from "../overlay/OverlayRoot";
import overlayStyles from "../overlay/styles.css?inline";

const HOST_ID = "shopiq-overlay-host";

export function mountOverlay(): void {
  if (document.getElementById(HOST_ID)) return;

  const host = document.createElement("div");
  host.id = HOST_ID;
  host.style.cssText = "position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;pointer-events:none";
  document.documentElement.append(host);

  const shadow = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = overlayStyles.replaceAll(":root", ":host");
  shadow.append(style);

  const container = document.createElement("div");
  shadow.append(container);

  createRoot(container).render(<OverlayRoot />);
}
