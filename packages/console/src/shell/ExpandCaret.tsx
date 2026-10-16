"use client";

import { CaretRightFilled } from "@ant-design/icons";
import type { MouseEvent } from "react";
import styles from "./ExpandCaret.module.css";

/**
 * A table row's expander: a filled caret that turns down when the row is
 * open. Every console's tables take it (ThemeModeProvider); a list that
 * names its rows passes `label` so the button says which.
 */
export function ExpandCaret({
  expanded,
  onToggle,
  label,
}: {
  expanded: boolean;
  onToggle: (event: MouseEvent<HTMLElement>) => void;
  /** What it opens, for its accessible name: "Open nas.internal". */
  label?: string;
}) {
  return (
    <button
      type="button"
      className={`${styles.caret} ${expanded ? styles.open : ""}`}
      aria-label={`${expanded ? "Close" : "Open"}${label ? ` ${label}` : " the row"}`}
      aria-expanded={expanded}
      onClick={(event) => {
        event.stopPropagation();
        onToggle(event);
      }}
    >
      <CaretRightFilled />
    </button>
  );
}

/**
 * Where a row that does not expand would have its caret: in a tree, its
 * name lines up with its siblings' that do.
 */
export function ExpandSpacer() {
  return <span className={styles.spacer} aria-hidden />;
}

/** A panel's (Collapse) expander: the same caret, inside antd's own button. */
export function PanelCaret({ isActive }: { isActive?: boolean }) {
  return (
    <CaretRightFilled
      className={`${styles.panel} ${isActive ? styles.open : ""}`}
    />
  );
}
