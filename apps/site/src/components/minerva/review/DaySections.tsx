import { CaretRightOutlined } from "@ant-design/icons";
import { Collapse, Empty } from "antd";
import React from "react";
import styles from "./Review.module.css";

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

/** A list broken down by day, each day's part opening and closing on its caret. */
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
