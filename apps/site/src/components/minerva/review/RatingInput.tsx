import { Radio } from "antd";
import React from "react";
import type { RatingField } from "../../../utils/reviews";
import styles from "./Review.module.css";

export interface RatingInputProps {
  field: RatingField;
  value?: number;
  disabled?: boolean;
  onChange: (value: number | null) => void;
}

/**
 * A rating from 1 to 5 as a row of buttons, each with its number, and the
 * words at each end.
 */
const RatingInput: React.FunctionComponent<RatingInputProps> = ({
  field,
  value,
  disabled = false,
  onChange,
}) => (
  <div className={styles.rating}>
    <span className={styles.ratingLabel} id={`rating-${field.key}`}>
      {field.label}
    </span>
    <div>
      <Radio.Group
        aria-labelledby={`rating-${field.key}`}
        optionType={"button"}
        buttonStyle={"solid"}
        disabled={disabled}
        value={value}
        options={[1, 2, 3, 4, 5].map((n) => ({
          label: n,
          value: n,
          title: `${field.label} ${n} of 5`,
        }))}
        onChange={(e) => onChange(e.target.value as number)}
      />
      <div className={styles.ratingEnds}>
        <span>{field.low}</span>
        <span>{field.high}</span>
      </div>
    </div>
  </div>
);

export default RatingInput;
