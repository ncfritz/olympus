import { CaretRightOutlined } from "@ant-design/icons";
import { Collapse, Empty } from "antd";
import { DateTime } from "luxon";
import React from "react";
import styles from "./Review.module.css";

/** A key for the week's items not tied to a day; sorts after the days. */
const NO_DAY = "~";

/**
 * Items by day, in the week's order: each day that has any, as its name,
 * and those on no day last.
 */
export const byDay = <T,>(
  things: T[],
  dayOf: (thing: T) => string | undefined,
  noDay: string,
): { key: string; label: string; things: T[] }[] => {
  const groups = new Map<string, T[]>();
  for (const thing of things) {
    const key = dayOf(thing) ?? NO_DAY;
    groups.set(key, [...(groups.get(key) ?? []), thing]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, grouped]) => ({
      key,
      label: key === NO_DAY ? noDay : DateTime.fromISO(key).toFormat("cccc d"),
      things: grouped,
    }));
};

export type DaySection = {
  key: string;
  /** The section's heading, such as "Monday". */
  label: string;
  /** How many it holds, beside the heading. */
  count: number;
  children: React.ReactNode;
};

export interface DaySectionsProps {
  sections: DaySection[];
  /** What an empty list says. */
  empty: string;
  /** Whether the sections start open; they do by default. */
  open?: boolean;
}

/**
 * A list broken into sections (by day, or by what they are), each opening
 * and closing on its caret.
 */
const DaySections: React.FunctionComponent<DaySectionsProps> = ({
  sections,
  empty,
  open = true,
}) => {
  if (sections.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={empty} />;
  }
  return (
    <Collapse
      ghost={true}
      size={"small"}
      className={styles.daySections}
      defaultActiveKey={open ? sections.map((s) => s.key) : []}
      expandIcon={({ isActive }) => (
        <CaretRightOutlined rotate={isActive ? 90 : 0} />
      )}
      items={sections.map((section) => ({
        key: section.key,
        label: (
          <span className={styles.daySectionLabel}>
            {section.label}
            <span className={styles.meta}>{section.count}</span>
          </span>
        ),
        children: section.children,
      }))}
    />
  );
};

export default DaySections;
