import type {
  FullGoal,
  GoalHabitLog,
  GoalHabitSummary,
} from "@ncfritz/olympus-sdk/minerva";
import {
  Button,
  Col,
  Flex,
  InputNumber,
  message,
  Row,
  Skeleton,
  Space,
  Statistic,
  Tooltip,
  Typography,
} from "antd";
import GoalSection from "./GoalSection";
import { DateTime } from "luxon";
import React, { useCallback, useEffect, useState } from "react";
import goalsApi from "../../../api/goalsApi";
import {
  apiProblems,
  FREQUENCY_LABEL,
  formatDay,
  formatValue,
  type HabitCell,
  habitGrid,
} from "../../../utils/goals";

const { Text } = Typography;

const CELL: Record<
  HabitCell,
  { background: string; border: string; label: string }
> = {
  done: { background: "#52c41a", border: "#52c41a", label: "done" },
  partial: {
    background: "#d9f7be",
    border: "#95de64",
    label: "logged, short of the target",
  },
  missed: { background: "#fff1f0", border: "#ffa39e", label: "missed" },
  off: { background: "#fafafa", border: "#f0f0f0", label: "not due" },
  future: { background: "#fff", border: "#d9d9d9", label: "still to come" },
  before: {
    background: "transparent",
    border: "transparent",
    label: "before the habit started",
  },
};

const ruleText = (goal: FullGoal) => {
  const rule = goal.habitRule;
  if (!rule) return "";
  const how =
    rule.frequency === "weekly"
      ? `${rule.timesPerPeriod} a week`
      : rule.frequency === "monthly"
        ? `${rule.timesPerPeriod} a month`
        : rule.frequency === "weekdays"
          ? `on ${(rule.weekdays ?? []).map((d) => ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][d - 1]).join(", ")}`
          : FREQUENCY_LABEL.daily.toLowerCase();
  const amount = rule.quantityTarget
    ? `, ${formatValue(rule.quantityTarget)}${rule.quantityUnit ? ` ${rule.quantityUnit}` : ""} counts`
    : ", yes or no";
  return `${how}${amount}`;
};

/**
 * A habit's adherence and streaks, its last twelve weeks as a grid
 * (weekday by week, oldest left, each week's count beneath), and today's
 * log in one step.
 */
const HabitPanel: React.FunctionComponent<{
  goal: FullGoal;
  today: string;
  readOnly: boolean;
  onChanged: () => void;
}> = ({ goal, today, readOnly, onChanged }) => {
  const [logs, setLogs] = useState<GoalHabitLog[]>();
  const [summary, setSummary] = useState<GoalHabitSummary>();
  const [amount, setAmount] = useState<number | null>(null);
  const rule = goal.habitRule;
  const counted = rule?.quantityTarget !== undefined;

  const load = useCallback(async () => {
    try {
      const result = await goalsApi.listHabitLogs(goal.id);
      setLogs(result.logs);
      setSummary(result.summary);
      setAmount(result.logs.find((l) => l.logDate === today)?.quantity ?? null);
    } catch {
      setLogs([]);
    }
  }, [goal.id, today]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!logs || !rule) return <Skeleton active={true} />;

  const todayLog = logs.find((l) => l.logDate === today);
  const grid = habitGrid(logs, rule, goal.startDate, today);

  const log = async (work: () => Promise<unknown>) => {
    try {
      await work();
      await load();
      onChanged();
    } catch (error) {
      message.error(apiProblems(error).join("; "));
    }
  };

  return (
    <GoalSection
      title={"Habit"}
      extra={<Text type={"secondary"}>{ruleText(goal)}</Text>}
    >
      <Row gutter={16}>
        <Col span={8}>
          <Statistic
            title={"Adherence"}
            value={summary?.adherence ?? "–"}
            suffix={summary?.adherence !== undefined ? "%" : undefined}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title={"Current streak"}
            value={summary?.currentStreak ?? 0}
          />
        </Col>
        <Col span={8}>
          <Statistic title={"Best streak"} value={summary?.bestStreak ?? 0} />
        </Col>
      </Row>
      <Flex gap={4} style={{ marginTop: 16, overflowX: "auto" }}>
        <Flex vertical={true} gap={4} style={{ paddingTop: 0 }}>
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
            <Text
              key={i}
              type={"secondary"}
              style={{ height: 18, fontSize: 11, lineHeight: "18px" }}
            >
              {d}
            </Text>
          ))}
        </Flex>
        {grid.map((week) => (
          <Flex key={week.weekOf} vertical={true} gap={4} align={"center"}>
            {week.days.map((cell, d) => {
              const date = DateTime.fromISO(week.weekOf).plus({ days: d });
              const label = `${date.toFormat("ccc LLL d")}: ${CELL[cell].label}`;
              return (
                <Tooltip key={d} title={label}>
                  <div
                    role={"img"}
                    aria-label={label}
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 3,
                      background: CELL[cell].background,
                      border: `1px ${cell === "future" ? "dashed" : "solid"} ${CELL[cell].border}`,
                    }}
                  />
                </Tooltip>
              );
            })}
            <Text type={"secondary"} style={{ fontSize: 11 }}>
              {week.met}
            </Text>
          </Flex>
        ))}
      </Flex>
      <Text type={"secondary"} style={{ fontSize: 12 }}>
        Last 12 weeks, oldest left; the bottom row counts the days met. Dashed:
        still to come.
      </Text>
      {!readOnly && (
        <Flex
          justify={"space-between"}
          align={"center"}
          style={{ marginTop: 16 }}
          wrap={true}
          gap={8}
        >
          <Text>
            Today, {formatDay(today, today)}
            {summary && summary.periodCapacity > 1
              ? ` · ${summary.periodDone} of ${summary.periodCapacity} this ${rule.frequency === "monthly" ? "month" : "week"}`
              : ""}
          </Text>
          <Space>
            {counted && (
              <InputNumber
                min={0}
                value={amount}
                onChange={(v) => setAmount(typeof v === "number" ? v : null)}
                addonAfter={rule.quantityUnit}
                aria-label={"Amount today"}
              />
            )}
            {todayLog ? (
              <>
                {counted && (
                  <Button
                    onClick={() =>
                      log(() =>
                        goalsApi.logHabit(goal.id, "today", {
                          quantity: amount ?? 0,
                        }),
                      )
                    }
                  >
                    Update
                  </Button>
                )}
                <Button
                  onClick={() =>
                    log(() => goalsApi.deleteHabitLog(goal.id, "today"))
                  }
                >
                  Undo today
                </Button>
              </>
            ) : (
              <Button
                type={"primary"}
                onClick={() =>
                  log(() =>
                    goalsApi.logHabit(
                      goal.id,
                      "today",
                      counted && amount !== null
                        ? { quantity: amount }
                        : undefined,
                    ),
                  )
                }
              >
                {counted && amount !== null ? "Log amount" : "Done today"}
              </Button>
            )}
          </Space>
        </Flex>
      )}
    </GoalSection>
  );
};

export default HabitPanel;
