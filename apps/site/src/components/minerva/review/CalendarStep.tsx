import React from "react";
import styles from "./Review.module.css";

export interface CalendarStepProps {
  /** The calendar pane, at its fixed width. */
  calendar: React.ReactNode;
  /** Which side the calendar sits on; the left by default. */
  side?: "left" | "right";
  /**
   * Whether the work is held to its limited width, the footer with it;
   * otherwise both take the width beside the calendar.
   */
  limited?: boolean;
  /**
   * How the work scrolls: as a whole (the default), or in parts it sets
   * up itself, the work filling the height between the top and the footer.
   */
  scroll?: "whole" | "parts";
  /** What the step asks, above its content. */
  intro: string;
  /** Back, Save and exit, Next: kept at the foot, as wide as the content. */
  footer: React.ReactNode;
  children: React.ReactNode;
}

/**
 * A step with a day's calendar at full height to one side and its work
 * beside it, no splitter: the work scrolls over a footer that stays put,
 * both held to the same width so the footer's buttons line up with the
 * content's right edge.
 */
const CalendarStep: React.FunctionComponent<CalendarStepProps> = ({
  calendar,
  side = "left",
  limited = true,
  scroll = "whole",
  intro,
  footer,
  children,
}) => {
  const width = limited ? styles.limited : styles.unlimited;
  return (
    <div className={`${styles.fill} ${styles.calendarStep}`}>
      {side === "left" && calendar}
      <div className={styles.column}>
        <div
          className={
            scroll === "parts" ? styles.columnParts : styles.columnScroll
          }
        >
          <div
            className={`${width} ${scroll === "parts" ? styles.fillDown : ""}`}
          >
            <p className={styles.intro}>{intro}</p>
            {children}
          </div>
        </div>
        <div className={styles.columnFooter}>
          <div className={width}>{footer}</div>
        </div>
      </div>
      {side === "right" && calendar}
    </div>
  );
};

export default CalendarStep;
