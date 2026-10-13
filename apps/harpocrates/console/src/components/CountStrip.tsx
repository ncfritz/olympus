import { Statistic, Typography } from "antd";
import type { ReactNode } from "react";
import styles from "./CountStrip.module.css";

/** A page's headline counts, in a strip across it. */
export const CountStrip = ({ children }: { children: ReactNode }) => (
  <div className={styles.strip}>{children}</div>
);

/** One count in the strip, and a line beneath it saying what it holds. */
export const Count = ({
  title,
  value,
  suffix,
  note,
}: {
  title: string;
  /** A count; or, where the count is a thing's name, that name. */
  value: number | string;
  suffix?: ReactNode;
  note?: ReactNode;
}) => (
  <div className={styles.cell}>
    <Statistic title={title} value={value} suffix={suffix} />
    {typeof note === "string" ? (
      <Typography.Text
        type="secondary"
        className={styles.note}
        ellipsis={{ tooltip: note }}
      >
        {note}
      </Typography.Text>
    ) : (
      note
    )}
  </div>
);
