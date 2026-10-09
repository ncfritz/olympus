import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Globals are off across the workspace, so Testing Library's automatic
// cleanup does not register itself.
afterEach(cleanup);

// The shell remembers choices per browser (the theme, the pages sider).
// One jsdom serves a whole file, so without this a test inherits what the
// one before it clicked.
afterEach(() => {
  try {
    window.localStorage.clear();
  } catch {
    // Storage is best-effort in the code under test, and here too.
  }
});

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
