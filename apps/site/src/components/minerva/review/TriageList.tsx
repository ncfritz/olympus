import type { ReviewItem } from "@ncfritz/olympus-sdk/minerva";
import { Empty, Radio, Tag, Typography } from "antd";
import React from "react";
import { type Triage, triageOf } from "../../../utils/reviews";
import styles from "./Review.module.css";

const { Text } = Typography;

const DECISIONS: { label: string; value: Triage }[] = [
  { label: "Done", value: "done" },
  { label: "Tomorrow", value: "tomorrow" },
  { label: "Later", value: "later" },
  { label: "Drop", value: "drop" },
];

export interface TriageListProps {
  items: ReviewItem[];
  disabled?: boolean;
  onDecide: (item: ReviewItem, decision: Triage) => Promise<void>;
}

/**
 * The day's planned items, each with its decision: done, on to tomorrow,
 * later (someday) or dropped. A carried item stays carried; its copy
 * carries on in tomorrow's plan.
 */
const TriageList: React.FunctionComponent<TriageListProps> = ({
  items,
  disabled = false,
  onDecide,
}) => {
  if (items.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={"Nothing was planned for today"}
      />
    );
  }
  return (
    <div>
      {items.map((item) => (
        <div key={item.id} className={styles.row}>
          <div className={styles.rowMain}>
            <Text delete={item.status === "dropped"}>{item.title}</Text>
            <span className={styles.meta}>
              {item.kind === "priority" ? "Priority" : "To-do"}
              {item.carryCount > 0 &&
                ` · carried ${item.carryCount} time${item.carryCount === 1 ? "" : "s"}`}
            </span>
          </div>
          {item.carryCount > 0 && item.status === "open" && (
            <Tag color={"orange"}>Carried over</Tag>
          )}
          {/* Radio buttons, not Segmented: an open item has no decision yet. */}
          <Radio.Group
            size={"small"}
            optionType={"button"}
            buttonStyle={"solid"}
            aria-label={`What happens to ${item.title}`}
            disabled={disabled || item.status === "carried"}
            value={triageOf(item.status) ?? null}
            options={DECISIONS}
            onChange={(e) => void onDecide(item, e.target.value as Triage)}
          />
        </div>
      ))}
    </div>
  );
};

export default TriageList;
