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
  /** The left of the split, the step's own work. */
  children: React.ReactNode;
}

/**
 * A step that uses the page's full width, split: its work on the left over
 * a footer that stays put, and what it refers to on the right.
 */
const SplitStep: React.FunctionComponent<SplitStepProps> = ({
  intro,
  footer,
  aside,
  children,
}) => (
  <Splitter className={styles.fill}>
    <Splitter.Panel defaultSize={"45%"} min={"30%"} max={"65%"}>
      <div className={styles.column}>
        <div className={styles.columnScroll}>
          <p className={styles.intro}>{intro}</p>
          {children}
        </div>
        <div className={styles.columnFooter}>{footer}</div>
      </div>
    </Splitter.Panel>
    <Splitter.Panel min={"35%"}>{aside}</Splitter.Panel>
  </Splitter>
);

export default SplitStep;
