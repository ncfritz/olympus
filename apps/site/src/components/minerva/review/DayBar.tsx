import { Tooltip } from "antd";
import React from "react";
import type { DayBarBlock } from "../../../utils/reviews";
import styles from "./Review.module.css";

export interface DayBarProps {
  /** The day's meetings as blocks. */
  blocks: DayBarBlock[];
  /** Planned time, drawn dashed over the meetings. */
  planned?: DayBarBlock[];
  fromHour?: number;
  toHour?: number;
}

/** The day's hours as a strip, each meeting a block on it. */
const DayBar: React.FunctionComponent<DayBarProps> = ({
  blocks,
  planned = [],
  fromHour = 7,
  toHour = 22,
}) => {
  const ticks: number[] = [];
  for (let hour = fromHour; hour <= toHour; hour += 3) ticks.push(hour);
  const place = (block: DayBarBlock) => ({
    left: `${block.left}%`,
    width: `${block.width}%`,
  });
  return (
    <div className={styles.dayBar}>
      <div
        className={styles.bar}
        role={"img"}
        aria-label={`${blocks.length} meeting${blocks.length === 1 ? "" : "s"} between ${fromHour}:00 and ${toHour}:00`}
      >
        {blocks.map((block) => (
          <Tooltip key={block.key} title={block.title}>
            {/* Positioned by the block's own times. */}
            <span className={styles.block} style={place(block)} />
          </Tooltip>
        ))}
        {planned.map((block) => (
          <Tooltip key={block.key} title={block.title}>
            <span
              className={`${styles.block} ${styles.planned}`}
              style={place(block)}
            />
          </Tooltip>
        ))}
      </div>
      <div className={styles.ticks} aria-hidden={true}>
        {ticks.map((hour) => (
          <span
            key={hour}
            className={styles.tick}
            style={{
              left: `${((hour - fromHour) / (toHour - fromHour)) * 100}%`,
            }}
          >
            {((hour + 11) % 12) + 1}
            {hour < 12 ? "a" : "p"}
          </span>
        ))}
      </div>
    </div>
  );
};

export default DayBar;
