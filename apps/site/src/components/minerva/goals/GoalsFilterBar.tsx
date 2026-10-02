import {
  AimOutlined,
  AppstoreOutlined,
  FilterFilled,
  ScheduleOutlined,
} from "@ant-design/icons";
import type {
  GoalCycle,
  GoalType,
  Tag as GoalTag,
} from "@ncfritz/olympus-sdk/minerva";
import { Input, Segmented, Space } from "antd";
import React from "react";
import {
  type HorizonChoice,
  STATUS_LABEL,
  TYPE_LABEL,
} from "../../../utils/goals";
import CheckboxFilter from "../../dionysus/metadata/filter/CheckboxFilter";
import { GoalTypeIcon } from "./GoalBits";

export type GoalsView = "board" | "roadmap" | "focus";

export const OPEN_STATUSES = ["draft", "active", "paused"];

export interface GoalsFilterBarProps {
  view: GoalsView;
  onView: (view: GoalsView) => void;
  title: string;
  onTitle: (title: string) => void;
  horizon: HorizonChoice;
  onHorizon: (horizon: HorizonChoice) => void;
  year: number;
  quarter: number;
  cycle?: GoalCycle;
  tags: GoalTag[];
  onTags: (tagIds: string[]) => void;
  onStatuses: (statuses: string[]) => void;
  /** Show the legend of the type icons and the pace tick. */
  legend: boolean;
  /** The bar's own element, so what sticks beneath it can measure it. */
  barRef?: React.Ref<HTMLDivElement>;
}

/** What the board's icons and marks mean. */
const Legend: React.FunctionComponent = () => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 16,
      padding: "6px 16px",
      fontSize: 12,
      color: "#6b6b6b",
      background: "#ffffff",
      borderBottom: "1px solid #f0f0f0",
    }}
  >
    {(Object.keys(TYPE_LABEL) as GoalType[]).map((t) => (
      <span
        key={t}
        style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
      >
        <GoalTypeIcon type={t} />
        {TYPE_LABEL[t]}
      </span>
    ))}
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span
        aria-hidden={true}
        style={{ width: 2, height: 12, background: "#1f1f1f" }}
      />
      where pace says you should be
    </span>
  </div>
);

/**
 * The goals home's bar, as Dionysus's: search and filters on the left,
 * the view switch on the right, and under it the legend. Both stay at the
 * top while the goals scroll beneath them.
 */
const GoalsFilterBar: React.FunctionComponent<GoalsFilterBarProps> = ({
  view,
  onView,
  title,
  onTitle,
  horizon,
  onHorizon,
  year,
  quarter,
  cycle,
  tags,
  onTags,
  onStatuses,
  legend,
  barRef,
}) => (
  <div ref={barRef} style={{ position: "sticky", top: 0, zIndex: 4 }}>
    <Space
      orientation={"horizontal"}
      size={8}
      style={{
        backgroundColor: "#efefef",
        width: "100%",
        justifyContent: "space-between",
        padding: 8,
      }}
    >
      <Space orientation={"horizontal"} size={8}>
        <Input
          size={"small"}
          prefix={
            <FilterFilled
              style={{ color: title.trim() ? "#1677ff" : "#afafaf" }}
            />
          }
          placeholder={"Search by title"}
          allowClear={true}
          style={{ width: 300, background: "#ffffff", borderColor: "#efefef" }}
          value={title}
          onChange={(e) => onTitle(e.target.value)}
        />
        <Space size={4} style={{ marginLeft: 8, fontSize: 12 }}>
          <span>Horizon</span>
          <Segmented
            size={"small"}
            value={horizon}
            onChange={(v) => onHorizon(v as HorizonChoice)}
            options={[
              { value: "all", label: "All" },
              { value: "year", label: String(year) },
              { value: "quarter", label: `Q${quarter}` },
              ...(cycle ? [{ value: "cycle", label: cycle.name }] : []),
              { value: "ongoing", label: "Ongoing" },
            ]}
            aria-label={"Horizon"}
          />
        </Space>
        {tags.length > 0 && (
          <CheckboxFilter
            label={"Tags"}
            items={tags.map((t) => ({ key: t.id, label: `#${t.name}` }))}
            onFiltersSet={(keys) => onTags(keys.map(String))}
          />
        )}
        <CheckboxFilter
          label={"Status"}
          initialValues={OPEN_STATUSES}
          items={Object.entries(STATUS_LABEL).map(([key, label]) => ({
            key,
            label,
          }))}
          onFiltersSet={(keys) =>
            onStatuses(keys.length ? keys.map(String) : OPEN_STATUSES)
          }
        />
      </Space>
      <Space orientation={"horizontal"} size={8}>
        <Segmented
          size={"small"}
          value={view}
          onChange={(v) => onView(v as GoalsView)}
          options={[
            { value: "board", label: "Board", icon: <AppstoreOutlined /> },
            { value: "roadmap", label: "Roadmap", icon: <ScheduleOutlined /> },
            { value: "focus", label: "Focus", icon: <AimOutlined /> },
          ]}
        />
      </Space>
    </Space>
    {legend && <Legend />}
  </div>
);

export default GoalsFilterBar;
