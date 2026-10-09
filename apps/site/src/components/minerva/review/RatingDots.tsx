import React from "react";
import styles from "./Lists.module.css";

export interface RatingDotsProps {
  label: string;
  /** 0.5 to 5; nothing when not rated. */
  value?: number;
}

/** A rating as five small dots under its name, filled up to it. */
const RatingDots: React.FunctionComponent<RatingDotsProps> = ({
  label,
  value,
}) => (
  <span className={styles.ratingDots}>
    <span className={styles.ratingName}>{label}</span>
    <span
      className={styles.dots}
      role={"img"}
      aria-label={
        value === undefined || value === null
          ? `${label}: not rated`
          : `${label}: ${value} of 5`
      }
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={
            value !== undefined && value !== null && n <= value
              ? styles.dotOn
              : value !== undefined && value !== null && n - 0.5 === value
                ? styles.dotHalf
                : styles.dotOff
          }
        />
      ))}
    </span>
  </span>
);

export default RatingDots;
