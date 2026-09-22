import { consolePath, type ConsoleKey } from "./registry";

/**
 * The `href` of another console. Cross-console links are plain anchors:
 * each console is its own application, so following one is a document
 * load however it is written.
 *
 * Relative by default — every console is on the control host. With an
 * origin (CONTROL_ORIGIN) they are absolute, which is what makes the
 * sidebar work in a console run from the IDE: its neighbours are in the
 * home lab, not on localhost.
 */
export const consoleHref = (key: ConsoleKey, origin?: string): string => {
  const path = consolePath(key);
  return origin ? new URL(path, origin).href : path;
};
