const STORAGE_KEY = "olympus:pagesCollapsed";

/**
 * Whether the pages sider is collapsed, per browser and per origin.
 *
 * It is stored rather than held in React because moving between consoles
 * is a document load (ADR 0021): without this, the sider would spring
 * open again every time someone crossed the suite. Every console on the
 * control host shares an origin, so the choice follows them across.
 */
export const loadPagesCollapsed = (): boolean => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
};

export const savePagesCollapsed = (collapsed: boolean): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(collapsed));
  } catch {
    // Best-effort — a private window or blocked storage just means the
    // choice doesn't survive the next document load.
  }
};
