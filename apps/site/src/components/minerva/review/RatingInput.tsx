import { Rate } from "antd";
import React from "react";
import type { RatingField } from "../../../utils/reviews";
import styles from "./Review.module.css";

export interface RatingInputProps {
  field: RatingField;
  value?: number;
  disabled?: boolean;
  /** Whether to show the words at each end beneath the circles. */
  showEnds?: boolean;
  /** The new rating, or null when it is cleared. */
  onChange: (value: number | null) => void;
}

/**
 * A rating from 0.5 to 5 in halves, as AntD's Rate with blue circles, the
 * value beside it and, when asked, the words at each end beneath. Clicking
 * the rating given clears it.
 */
const RatingInput: React.FunctionComponent<RatingInputProps> = ({
  field,
  value,
  disabled = false,
  showEnds = true,
  onChange,
}) => (
  <div className={styles.rating}>
    <span className={styles.ratingLabel} id={`rating-${field.key}`}>
      {field.label}
    </span>
    <div className={styles.rateBox}>
      <div className={styles.rateRow}>
        <Rate
          className={styles.rate}
          allowHalf={true}
          disabled={disabled}
          value={value ?? 0}
          character={<span className={styles.rateDot} />}
          aria-labelledby={`rating-${field.key}`}
          onChange={(rating) => onChange(rating || null)}
        />
        <span className={styles.rateValue}>{value ?? "–"}</span>
      </div>
      {showEnds && (
        <div className={styles.ratingEnds}>
          <span>{field.low}</span>
          <span>{field.high}</span>
        </div>
      )}
    </div>
  </div>
);

export default RatingInput;
