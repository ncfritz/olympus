import React from "react";
import styles from "./Review.module.css";

export interface CalendarStepProps {
  /** The calendar pane, on the left at its fixed width. */
  calendar: React.ReactNode;
  /** What the step asks, above its content. */
  intro: string;
  /** Back, Save and exit, Next: kept at the foot, as wide as the content. */
  footer: React.ReactNode;
  children: React.ReactNode;
}

/**
 * A step with a day's calendar at full height on the left and its work on
 * the right, no splitter: the work scrolls over a footer that stays put,
 * both held to the same width so the footer's buttons line up with the
 * content's right edge.
 */
const CalendarStep: React.FunctionComponent<CalendarStepProps> = ({
  calendar,
  intro,
  footer,
  children,
}) => (
  <div className={`${styles.fill} ${styles.calendarStep}`}>
    {calendar}
    <div className={styles.column}>
      <div className={styles.columnScroll}>
        <div className={styles.limited}>
          <p className={styles.intro}>{intro}</p>
          {children}
        </div>
      </div>
      <div className={styles.columnFooter}>
        <div className={styles.limited}>{footer}</div>
      </div>
    </div>
  </div>
);

export default CalendarStep;
