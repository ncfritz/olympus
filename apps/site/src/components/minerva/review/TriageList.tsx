import {
  ArrowRightOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
} from "@ant-design/icons";
import type { ReviewItem } from "@ncfritz/olympus-sdk/minerva";
import { ConfigProvider, Empty, Radio, Tag, Typography } from "antd";
import React from "react";
import { type Triage, triageOf } from "../../../utils/reviews";
import { PLAN_KINDS } from "./planKinds";
import styles from "./Review.module.css";

const { Text } = Typography;

const DECISIONS: { label: string; value: Triage }[] = [
  { label: "Done", value: "done" },
  { label: "Tomorrow", value: "tomorrow" },
  { label: "Later", value: "later" },
  { label: "Drop", value: "drop" },
];

/**
 * How each decision looks: its colour, filling the button once chosen and
 * tinting its icon until then, and its icon. On to the next period, a
 * day's Tomorrow or a week's Next week, looks the same either way; so do a
 * day's Later and a week's Someday, both `later`.
 */
const LOOKS: Record<
  string,
  { color: string; icon: React.ReactNode; tint: string }
> = {
  done: {
    color: "#003f5c",
    icon: <CheckCircleOutlined />,
    tint: styles.tintDone,
  },
  tomorrow: {
    color: "#7a4f99",
    icon: <ArrowRightOutlined />,
    tint: styles.tintNext,
  },
  next: {
    color: "#7a4f99",
    icon: <ArrowRightOutlined />,
    tint: styles.tintNext,
  },
  later: {
    color: "#ef527a",
    icon: <ClockCircleOutlined />,
    tint: styles.tintLater,
  },
  drop: {
    color: "#ffa600",
    icon: <CloseCircleOutlined />,
    tint: styles.tintDrop,
  },
};

/** A decision as a tag in its colour, as its chosen button is; or "Open". */
const DecisionTag: React.FunctionComponent<{
  decision?: { label: string; value: string };
}> = ({ decision }) => {
  if (!decision) return <Tag className={styles.decisionTag}>Open</Tag>;
  const look = LOOKS[decision.value] ?? LOOKS.done;
  return (
    <Tag
      className={styles.decisionTag}
      variant={"solid"}
      color={look.color}
      icon={look.icon}
    >
      {decision.label}
    </Tag>
  );
};

export interface TriageListProps<D extends string = Triage> {
  items: ReviewItem[];
  disabled?: boolean;
  /** A decision; null when the chosen one is clicked again, taking it back. */
  onDecide: (item: ReviewItem, decision: D | null) => Promise<void>;
  /** The decisions offered, and the one an item's status shows: a day's by default. */
  decisions?: { label: string; value: D }[];
  decisionOf?: (status: ReviewItem["status"]) => D | undefined;
  /** What an empty list says. */
  empty?: string;
  /** Where an item was planned, under its title. */
  whereOf?: (item: ReviewItem) => string | undefined;
  /**
   * Only show each item's decision, as a tag filled with its colour, as
   * the chosen button is; nothing can be changed.
   */
  readOnly?: boolean;
  /**
   * Compact, where space is tight: each decision as its icon alone, named
   * on hover; the item's kind as its icon, as the plan lists show it; rows
   * closer together; the Carried over tag left to the line under the title.
   */
  iconOnly?: boolean;
}

/**
 * Planned items, each with its decision: by default a day's, done, on to
 * tomorrow, later (someday) or dropped. Clicking the chosen decision again
 * takes it back; a carried item can be decided again too, which takes its
 * copy back first. Read only, it shows each decision as a tag instead.
 */
const TriageList = <D extends string = Triage>({
  items,
  disabled = false,
  onDecide,
  decisions = DECISIONS as { label: string; value: D }[],
  decisionOf = triageOf as (status: ReviewItem["status"]) => D | undefined,
  empty = "Nothing was planned for today",
  whereOf,
  readOnly = false,
  iconOnly = false,
}: TriageListProps<D>): React.ReactElement => {
  if (items.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={empty} />;
  }
  return (
    <div>
      {items.map((item) => {
        const chosen = decisionOf(item.status);
        return (
          <div
            key={item.id}
            className={`${styles.row} ${iconOnly ? styles.rowTight : ""}`}
          >
            {iconOnly && (
              <span
                className={PLAN_KINDS[item.kind].tint}
                title={PLAN_KINDS[item.kind].label}
              >
                {PLAN_KINDS[item.kind].icon}
              </span>
            )}
            <div className={styles.rowMain}>
              <Text delete={item.status === "dropped"}>{item.title}</Text>
              {iconOnly ? (
                // The kind is the icon; only a carry is left to say.
                item.carryCount > 0 && (
                  <span className={styles.meta}>
                    carried {item.carryCount} time
                    {item.carryCount === 1 ? "" : "s"}
                  </span>
                )
              ) : (
                <span className={styles.meta}>
                  {whereOf?.(item) && `${whereOf(item)} · `}
                  {item.kind === "priority" ? "Priority" : "To-do"}
                  {item.carryCount > 0 &&
                    ` · carried ${item.carryCount} time${item.carryCount === 1 ? "" : "s"}`}
                </span>
              )}
            </div>
            {/* Tight with icons alone: the line under the title says it. */}
            {!iconOnly && item.carryCount > 0 && item.status === "open" && (
              <Tag color={"orange"}>Carried over</Tag>
            )}
            {readOnly ? (
              <DecisionTag
                decision={decisions.find((d) => d.value === chosen)}
              />
            ) : (
              /* Radio buttons, not Segmented: an open item has no decision yet. */
              <Radio.Group
                size={"small"}
                buttonStyle={"solid"}
                aria-label={`What happens to ${item.title}`}
                disabled={disabled}
                value={chosen ?? null}
                onChange={(e) => void onDecide(item, e.target.value as D)}
              >
                {decisions.map((decision) => {
                  const look = LOOKS[decision.value] ?? LOOKS.done;
                  return (
                    // Each button in its decision's colour, as AntD draws a
                    // chosen button in the primary one.
                    <ConfigProvider
                      key={decision.value}
                      theme={{ token: { colorPrimary: look.color } }}
                    >
                      <Radio.Button
                        value={decision.value}
                        title={iconOnly ? decision.label : undefined}
                        aria-label={iconOnly ? decision.label : undefined}
                        // Clicking the chosen decision again takes it back;
                        // a radio sends no change for that, so it is caught here.
                        onClick={() => {
                          if (chosen === decision.value) {
                            void onDecide(item, null);
                          }
                        }}
                      >
                        <span
                          className={
                            chosen === decision.value ? undefined : look.tint
                          }
                        >
                          {look.icon}
                        </span>
                        {!iconOnly && ` ${decision.label}`}
                      </Radio.Button>
                    </ConfigProvider>
                  );
                })}
              </Radio.Group>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default TriageList;
