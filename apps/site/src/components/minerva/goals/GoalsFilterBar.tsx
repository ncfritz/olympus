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
import { Input, Radio, Space } from "antd";
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
  /** The legend row's contents under the bar, the same height in every view. */
  legend: React.ReactNode;
}

/** The row under the bar that holds a view's legend, one height for all. */
const LegendBar: React.FunctionComponent<{ children: React.ReactNode }> = ({
  children,
}) => (
  <div
    style={{
      height: 32,
      boxSizing: "border-box",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 16,
      padding: "0 16px",
      fontSize: 12,
      color: "#6b6b6b",
      background: "#ffffff",
      borderBottom: "1px solid #f0f0f0",
    }}
  >
    {children}
  </div>
);

/** What the board's and Focus's icons and marks mean. */
export const BoardLegend: React.FunctionComponent = () => (
  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
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
}) => (
  <div style={{ position: "sticky", top: 0, zIndex: 4 }}>
    <Space
      orientation={"horizontal"}
      size={8}
      style={{
        backgroundColor: "#efefef",
        width: "100%",
        boxSizing: "border-box",
        justifyContent: "space-between",
        padding: "8px 16px 8px 8px",
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
          <Radio.Group
            size={"small"}
            optionType={"button"}
            buttonStyle={"solid"}
            value={horizon}
            onChange={(e) => onHorizon(e.target.value as HorizonChoice)}
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
        <Radio.Group
          size={"small"}
          optionType={"button"}
          buttonStyle={"solid"}
          value={view}
          onChange={(e) => onView(e.target.value as GoalsView)}
          aria-label={"View"}
          options={[
            {
              value: "focus",
              label: (
                <Space size={4}>
                  <AimOutlined />
                  Focus
                </Space>
              ),
            },
            {
              value: "board",
              label: (
                <Space size={4}>
                  <AppstoreOutlined />
                  Board
                </Space>
              ),
            },
            {
              value: "roadmap",
              label: (
                <Space size={4}>
                  <ScheduleOutlined />
                  Roadmap
                </Space>
              ),
            },
          ]}
        />
      </Space>
    </Space>
    <LegendBar>{legend}</LegendBar>
  </div>
);

export default GoalsFilterBar;
