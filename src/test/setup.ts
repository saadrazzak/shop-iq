import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { installChromeMock, resetChromeMock } from "./chrome-mock";

// Make `chrome.*` available before any module that references it loads.
installChromeMock();

afterEach(() => {
  cleanup();
  resetChromeMock();
});
