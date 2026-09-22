import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Globals are off across the workspace, so Testing Library's automatic
// cleanup does not register itself.
afterEach(cleanup);

// jsdom implements neither of these, and antd's responsive components and
// the theme provider both expect them.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
