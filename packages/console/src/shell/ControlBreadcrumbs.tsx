"use client";

import { Breadcrumb } from "antd";
import type { BreadcrumbProps } from "antd";
import styles from "./shell.module.css";

/** The depth the colours are worked out for; a deeper trail repeats the last. */
const MAX_DEPTH = 8;

export interface ControlBreadcrumbsProps {
  /** Where you are, from `breadcrumbItems`, outermost first. */
  items: NonNullable<BreadcrumbProps["items"]>;
}

/**
 * Where you are, in a bar below the header, as the main Olympus site
 * shows it (OlympusBreadcrumbs, styles/breadcrumbs.css): chevrons, the
 * root the second nav's slate and each crumb after it a step nearer the
 * bar's navy.
 */
export const ControlBreadcrumbs = ({ items }: ControlBreadcrumbsProps) => {
  const n = Math.min(items.length, MAX_DEPTH);
  return (
    <div className={styles.crumbs}>
      <Breadcrumb
        className={styles[`n${n}`]}
        separator=""
        items={items.map((item, index) => ({
          ...item,
          className: [
            styles.level,
            styles[
              `k${Math.max(1, Math.min(items.length - index, MAX_DEPTH))}`
            ],
            index === 0 ? styles.root : undefined,
          ]
            .filter(Boolean)
            .join(" "),
        }))}
      />
    </div>
  );
};
