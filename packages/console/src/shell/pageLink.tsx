"use client";

import type { MouseEvent, ReactNode } from "react";

/** A click the browser should handle itself: a new tab, a download, a save. */
const browsersOwn = (event: MouseEvent): boolean =>
  event.defaultPrevented ||
  event.button !== 0 ||
  event.metaKey ||
  event.ctrlKey ||
  event.shiftKey ||
  event.altKey;

export interface PageLinkProps {
  href: string;
  children: ReactNode;
  /** Routes within the console. Without it the link is a document load. */
  onNavigate?: (href: string) => void;
  /** Stretched over its menu row, for when the glyph is all there is of it. */
  fill?: boolean;
  label?: string;
}

/**
 * A row in one of the siders.
 *
 * It is an anchor before it is anything else, so a console can be opened
 * in a new tab and the address is the address. `onNavigate` only takes
 * over the plain left click, which is the one a router can do better.
 */
export const PageLink = ({
  href,
  children,
  onNavigate,
  fill = false,
  label,
}: PageLinkProps) => (
  <a
    href={href}
    aria-label={label}
    onClick={(event) => {
      if (!onNavigate || browsersOwn(event)) return;
      event.preventDefault();
      onNavigate(href);
    }}
    style={
      fill
        ? {
            // The row, not the 16px glyph in the middle of it: antd's
            // menu item is the positioned ancestor here.
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "inherit",
          }
        : undefined
    }
  >
    {children}
  </a>
);
