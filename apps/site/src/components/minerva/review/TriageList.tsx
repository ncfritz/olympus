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

export interface TriageListProps<D extends string = Triage> {
  items: ReviewItem[];
  disabled?: boolean;
  onDecide: (item: ReviewItem, decision: D) => Promise<void>;
  /** The decisions offered, and the one an item's status shows: a day's by default. */
  decisions?: { label: string; value: D }[];
  decisionOf?: (status: ReviewItem["status"]) => D | undefined;
  /** What an empty list says. */
  empty?: string;
  /** Where an item was planned, under its title. */
  whereOf?: (item: ReviewItem) => string | undefined;
}

/**
 * Planned items, each with its decision: by default a day's, done, on to
 * tomorrow, later (someday) or dropped. A carried item stays carried; its
 * copy carries on in the next period's plan.
 */
const TriageList = <D extends string = Triage>({
  items,
  disabled = false,
  onDecide,
  decisions = DECISIONS as { label: string; value: D }[],
  decisionOf = triageOf as (status: ReviewItem["status"]) => D | undefined,
  empty = "Nothing was planned for today",
  whereOf,
}: TriageListProps<D>): React.ReactElement => {
  if (items.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={empty} />;
  }
  return (
    <div>
      {items.map((item) => (
        <div key={item.id} className={styles.row}>
          <div className={styles.rowMain}>
            <Text delete={item.status === "dropped"}>{item.title}</Text>
            <span className={styles.meta}>
              {whereOf?.(item) && `${whereOf(item)} · `}
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
            value={decisionOf(item.status) ?? null}
            options={decisions}
            onChange={(e) => void onDecide(item, e.target.value as D)}
          />
        </div>
      ))}
    </div>
  );
};

export default TriageList;
