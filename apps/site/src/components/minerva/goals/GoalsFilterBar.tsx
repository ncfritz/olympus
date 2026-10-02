import {
  AimOutlined,
  AppstoreOutlined,
  CheckCircleFilled,
  FilterFilled,
  PlusOutlined,
  ScheduleOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import type { GoalCycle, Tag as GoalTag } from "@ncfritz/olympus-sdk/minerva";
import { Button, Input, Menu, Segmented, Space } from "antd";
import React, { useState } from "react";
import { type HorizonChoice, STATUS_LABEL } from "../../../utils/goals";
import CheckboxFilter from "../../dionysus/metadata/filter/CheckboxFilter";
import FilterWrapper from "../../dionysus/metadata/filter/FilterWrapper";

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
  onManageCategories: () => void;
  onNewGoal: () => void;
}

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
 * the view switch and actions on the right. It stays at the top while the
 * goals scroll beneath it.
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
  onManageCategories,
  onNewGoal,
}) => (
  <Space
    orientation={"horizontal"}
    size={8}
    style={{
      position: "sticky",
      top: 0,
      zIndex: 4,
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
      <Button
        size={"small"}
        icon={<SettingOutlined />}
        onClick={onManageCategories}
      >
        Manage categories
      </Button>
      <Button
        size={"small"}
        type={"primary"}
        icon={<PlusOutlined />}
        onClick={onNewGoal}
      >
        New goal
      </Button>
    </Space>
  </Space>
);

export default GoalsFilterBar;
