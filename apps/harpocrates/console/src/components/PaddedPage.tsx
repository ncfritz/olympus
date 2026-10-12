import type { ReactNode } from "react";
import styles from "./PaddedPage.module.css";

/**
 * A page not yet reworked to flow to the shell's edges (docs/conventions/
 * ux.md, Page edges): the margin the layout used to give every page.
 */
export function PaddedPage({ children }: { children: ReactNode }) {
  return <div className={styles.padded}>{children}</div>;
}
