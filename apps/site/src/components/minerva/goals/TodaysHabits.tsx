import type { GoalHabitDay } from "@ncfritz/olympus-sdk/minerva";
import { CheckOutlined } from "@ant-design/icons";
import {
  Button,
  Empty,
  Flex,
  InputNumber,
  List,
  message,
  Skeleton,
  Typography,
} from "antd";
import Link from "next/link";
import React, { useCallback, useEffect, useState } from "react";
import goalsApi from "../../../api/goalsApi";
import { apiProblems } from "../../../utils/goals";

const { Text } = Typography;

const periodWords = (h: GoalHabitDay) =>
  h.periodCapacity > 1
    ? `${h.periodDone} of ${h.periodCapacity} this period`
    : h.log?.met
      ? "Done today"
      : "Due today";

/**
 * Today's habits: each active habit due today, ticked off (or its amount
 * entered) in one step. Shared by Focus and, later, Minerva Home.
 */
const TodaysHabits: React.FunctionComponent<{
  /** Something was logged; the caller can refresh its numbers. */
  onLogged?: () => void;
}> = ({ onLogged }) => {
  const [habits, setHabits] = useState<GoalHabitDay[]>();

  const load = useCallback(async () => {
    try {
      setHabits(await goalsApi.listHabitsForDay("today"));
    } catch {
      setHabits([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const log = async (h: GoalHabitDay, done: boolean, quantity?: number) => {
    try {
      if (!done && quantity === undefined) {
        await goalsApi.deleteHabitLog(h.goal.id, "today");
      } else {
        await goalsApi.logHabit(
          h.goal.id,
          "today",
          quantity === undefined ? undefined : { quantity },
        );
      }
      await load();
      onLogged?.();
    } catch (error) {
      message.error(apiProblems(error).join("; "));
    }
  };

  if (!habits) return <Skeleton active={true} paragraph={{ rows: 3 }} />;
  if (habits.length === 0) {
    return <Empty description={"No habits due today"} />;
  }

  return (
    <List
      size={"small"}
      dataSource={habits}
      renderItem={(h) => (
        <List.Item>
          <Flex
            justify={"space-between"}
            align={"center"}
            style={{ width: "100%" }}
            gap={8}
          >
            <Flex vertical={true} style={{ minWidth: 0 }}>
              <Link href={`/minerva/goals/${h.goal.id}`}>
                <Text ellipsis={true}>{h.goal.title}</Text>
              </Link>
              <Text type={"secondary"} style={{ fontSize: 12 }}>
                {periodWords(h)}
              </Text>
            </Flex>
            <HabitControl habit={h} onLog={log} />
          </Flex>
        </List.Item>
      )}
    />
  );
};

/** A tick for a yes/no habit; an amount for one counted by quantity. */
const HabitControl: React.FunctionComponent<{
  habit: GoalHabitDay;
  onLog: (h: GoalHabitDay, done: boolean, quantity?: number) => void;
}> = ({ habit, onLog }) => {
  const [amount, setAmount] = useState<number | null>(
    habit.log?.quantity ?? null,
  );
  // The day's strip does not carry the rule; a logged quantity says the
  // habit is counted by amount.
  if (habit.log?.quantity !== undefined) {
    return (
      <InputNumber
        size={"small"}
        min={0}
        value={amount}
        onChange={(v) => setAmount(typeof v === "number" ? v : null)}
        onBlur={() =>
          amount !== habit.log?.quantity &&
          onLog(habit, amount !== null, amount ?? undefined)
        }
        style={{ width: 80 }}
        aria-label={`${habit.goal.title}: amount today`}
      />
    );
  }
  // A round check as the mocks draw it: outlined to log, filled green once
  // logged (pressing it again undoes the day).
  const met = habit.log?.met ?? false;
  return (
    <Button
      shape={"circle"}
      icon={<CheckOutlined />}
      aria-pressed={met}
      aria-label={
        met
          ? `${habit.goal.title}: done today; undo`
          : `Log ${habit.goal.title}`
      }
      onClick={() => onLog(habit, !met)}
      style={
        met
          ? { background: "#237804", borderColor: "#237804", color: "#ffffff" }
          : { color: "#6b6b6b" }
      }
    />
  );
};

export default TodaysHabits;
