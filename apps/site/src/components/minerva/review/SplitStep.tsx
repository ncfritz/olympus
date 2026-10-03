import { Splitter } from "antd";
import React from "react";
import styles from "./Review.module.css";

export interface SplitStepProps {
  /** What the step asks, above its content. */
  intro: string;
  /** Back, Save and exit, Next: kept at the foot of the left column. */
  footer: React.ReactNode;
  /** The right of the split. */
  aside: React.ReactNode;
  /** The left panel's starting width; 45% by default. */
  defaultSize?: string;
  /**
   * Whether what the step refers to comes first, on the left, and its work
   * on the right; the work keeps its footer either way.
   */
  asideFirst?: boolean;
  /** Whether the work's column scrolls with no scroll bar showing. */
  hideScrollbar?: boolean;
  /** The left of the split, the step's own work. */
  children: React.ReactNode;
}

/**
 * A step that uses the page's full width, split: its work over a footer
 * that stays put, and what it refers to beside it; the work on the left
 * unless `asideFirst`.
 */
const SplitStep: React.FunctionComponent<SplitStepProps> = ({
  intro,
  footer,
  aside,
  defaultSize = "45%",
  hideScrollbar = false,
  asideFirst = false,
  children,
}) => {
  const work = (
    <div className={styles.column}>
      <div
        className={`${styles.columnScroll} ${hideScrollbar ? styles.noScrollbar : ""}`}
      >
        <p className={styles.intro}>{intro}</p>
        {children}
      </div>
      <div className={styles.columnFooter}>{footer}</div>
    </div>
  );
  return asideFirst ? (
    <Splitter className={styles.fill}>
      <Splitter.Panel defaultSize={defaultSize} min={"30%"} max={"70%"}>
        {aside}
      </Splitter.Panel>
      <Splitter.Panel min={"30%"}>{work}</Splitter.Panel>
    </Splitter>
  ) : (
    <Splitter className={styles.fill}>
      <Splitter.Panel defaultSize={defaultSize} min={"30%"} max={"70%"}>
        {work}
      </Splitter.Panel>
      <Splitter.Panel min={"35%"}>{aside}</Splitter.Panel>
    </Splitter>
  );
};

export default SplitStep;
