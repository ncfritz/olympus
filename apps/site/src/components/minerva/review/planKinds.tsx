import { ExclamationOutlined, UnorderedListOutlined } from "@ant-design/icons";
import type { ReviewItemKind } from "@ncfritz/olympus-sdk/minerva";
import React from "react";
import styles from "./Review.module.css";

/**
 * How each kind of plan item looks, in its list and as a block of time on
 * the calendar: a top priority with a ! on a yellow from #ffcc33, a to-do
 * with a list on the plan's green.
 */
export const PLAN_KINDS: Record<
  ReviewItemKind,
  { label: string; icon: React.ReactNode; block: string; tint: string }
> = {
  priority: {
    label: "Top priority",
    icon: <ExclamationOutlined />,
    block: styles.blockPriority,
    tint: styles.tintPriority,
  },
  todo: {
    label: "To-do",
    icon: <UnorderedListOutlined />,
    block: styles.blockTodo,
    tint: styles.tintTodo,
  },
};
