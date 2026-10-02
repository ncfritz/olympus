import {
  AimOutlined,
  AppstoreOutlined,
  CheckCircleFilled,
  FilterFilled,
  ScheduleOutlined,
} from "@ant-design/icons";
import type {
  GoalCycle,
  GoalType,
  Tag as GoalTag,
} from "@ncfritz/olympus-sdk/minerva";
import { Input, Menu, Segmented, Space } from "antd";
import React, { useState } from "react";
import {
  type HorizonChoice,
  STATUS_LABEL,
  TYPE_LABEL,
} from "../../../utils/goals";
import CheckboxFilter from "../../dionysus/metadata/filter/CheckboxFilter";
import FilterWrapper from "../../dionysus/metadata/filter/FilterWrapper";
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

/** The horizon, one choice at a time, in the filter bar's style. */
const HorizonFilter: React.FunctionComponent<{
  value: HorizonChoice;
  onChange: (value: HorizonChoice) => void;
  choices: { key: HorizonChoice; label: string }[];
}> = ({ value, onChange, choices }) => {
  const [picked, setPicked] = useState(value);
  return (
    <FilterWrapper
      label={"Horizon"}
      initialFiltersPresent={value !== "all"}
      filters={
        <Menu
          style={{ boxShadow: "none" }}
          selectedKeys={[picked]}
          onClick={({ key }) => setPicked(key as HorizonChoice)}
          items={choices.map((c) => ({
            key: c.key,
            label: (
              <Space style={{ justifyContent: "space-between", width: "100%" }}>
                {c.label}
                {c.key === picked ? <CheckCircleFilled /> : undefined}
              </Space>
            ),
          }))}
        />
      }
      onReset={() => setPicked("all")}
      onClose={() => {
        onChange(picked);
        return picked === "all" ? 0 : 1;
      }}
    />
  );
};

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
}) => (
  <div style={{ position: "sticky", top: 0, zIndex: 4 }}>
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
        <HorizonFilter
          value={horizon}
          onChange={onHorizon}
          choices={[
            { key: "all", label: "All" },
            { key: "year", label: String(year) },
            { key: "quarter", label: `Q${quarter}` },
            ...(cycle ? [{ key: "cycle" as const, label: cycle.name }] : []),
            { key: "ongoing", label: "Ongoing" },
          ]}
        />
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
