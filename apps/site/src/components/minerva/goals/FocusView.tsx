import {
  CalendarOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import type {
  Goal,
  GoalCategory,
  GoalCycle,
  GoalExecution,
} from "@ncfritz/olympus-sdk/minerva";
import {
  Alert,
  Button,
  Collapse,
  DatePicker,
  Empty,
  Flex,
  List,
  message,
  Popover,
  Space,
  Splitter,
  Tooltip,
  Typography,
} from "antd";
import dayjs from "dayjs";
import { DateTime } from "luxon";
import Link from "next/link";
import React, { useEffect, useRef, useState } from "react";
import goalsApi from "../../../api/goalsApi";
import {
  apiProblems,
  dueText,
  formatDay,
  formatValue,
  type GoalRow,
  goalTree,
  metricText,
  rankForFocus,
} from "../../../utils/goals";
import { GoalTypeIcon, HealthLabel, PaceBar } from "./GoalBits";
import { EXECUTION_TARGET } from "./SummaryStrip";
import TodaysHabits from "./TodaysHabits";

const { Text } = Typography;

export interface FocusViewProps {
  goals: Goal[];
  categories: GoalCategory[];
  cycle?: GoalCycle;
  /** Every cycle of the caller's, to know whether one is planned next. */
  cycles: GoalCycle[];
  execution?: GoalExecution;
  today: string;
  onPlanCycle: () => void;
  onCheckIn: (goal: Goal) => void;
  onReplan: (goal: Goal) => void;
  onDrop: (goal: Goal) => void;
  onChanged: () => void;
}

/** A due date moved later, from the decision banner. */
const PushDueDate: React.FunctionComponent<{
  goal: Goal;
  onChanged: () => void;
}> = ({ goal, onChanged }) => {
  const [open, setOpen] = useState(false);
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger={"click"}
      title={"New due date"}
      content={
        <DatePicker
          defaultValue={goal.dueDate ? dayjs(goal.dueDate) : undefined}
          disabledDate={(d) => d.isBefore(dayjs(), "day")}
          onChange={async (d) => {
            if (!d) return;
            try {
              await goalsApi.updateGoal(goal.id, {
                goal: { dueDate: d.format("YYYY-MM-DD") },
              });
              setOpen(false);
              message.success("Due date moved");
              onChanged();
            } catch (error) {
              message.error(apiProblems(error).join("; "));
            }
          }}
        />
      }
    >
      <Button size={"small"}>Push due date</Button>
    </Popover>
  );
};

/** This week, a bar a day: done filled, still due outlined. */
const WeekBars: React.FunctionComponent<{
  execution?: GoalExecution;
  today: string;
}> = ({ execution, today }) => {
  if (!execution) return null;
  const monday = DateTime.fromISO(execution.from);
  const days = new Map(execution.days.map((d) => [d.date, d]));
  const most = Math.max(
    1,
    ...execution.days.map((d) => Math.max(d.due, d.done)),
  );
  return (
    <div>
      <Flex gap={6} align={"flex-end"} style={{ height: 72 }}>
        {Array.from({ length: 7 }, (_, i) => {
          const date = monday.plus({ days: i });
          const iso = date.toISODate()!;
          const day = days.get(iso);
          const label = `${date.toFormat("ccc")}: ${day ? `${day.done} of ${day.due} done` : iso > today ? "still to come" : "nothing due"}`;
          return (
            <Tooltip key={iso} title={label}>
              <Flex
                vertical={true}
                justify={"flex-end"}
                style={{ flex: 1, height: "100%" }}
                aria-label={label}
                role={"img"}
              >
                <div
                  style={{
                    height: `${((day?.due ?? 0) / most) * 100}%`,
                    minHeight: 2,
                    border: "1px solid #91caff",
                    borderRadius: 3,
                    position: "relative",
                    background: "#fff",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: day?.due
                        ? `${(Math.min(day.done, day.due) / day.due) * 100}%`
                        : 0,
                      background: "#1677ff",
                      borderRadius: 2,
                    }}
                  />
                </div>
              </Flex>
            </Tooltip>
          );
        })}
      </Flex>
      <Flex gap={6}>
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <Text
            key={d}
            type={"secondary"}
            style={{ flex: 1, fontSize: 11, textAlign: "center" }}
          >
            {d}
          </Text>
        ))}
      </Flex>
      <Text type={"secondary"} style={{ fontSize: 12 }}>
        Filled: habit days done. Outline: due. Feeds the execution score.
      </Text>
    </div>
  );
};

/** A section heading in the mocks' style: small capitals. */
const Heading: React.FunctionComponent<{ children: React.ReactNode }> = ({
  children,
}) => (
  <span
    style={{
      fontSize: 12,
      fontWeight: 600,
      letterSpacing: "0.06em",
      textTransform: "uppercase",
      color: "#595959",
    }}
  >
    {children}
  </span>
);

/**
 * The current cycle as the mocks draw it: its name, the week, its dates;
 * a cell per week (done, this one, to come) and the buffer hatched; this
 * week's and the cycle's execution.
 */
const CycleBanner: React.FunctionComponent<{
  cycle?: GoalCycle;
  execution?: GoalExecution;
  cycleExecution?: GoalExecution;
  today: string;
  /** Offer to plan the next cycle: none is planned after this one. */
  canPlan: boolean;
  onPlan: () => void;
}> = ({ cycle, execution, cycleExecution, today, canPlan, onPlan }) => {
  const box: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 24,
    padding: 16,
    borderRadius: 8,
    border: "1px solid #91caff",
    background: "#e6f4ff",
    marginBottom: 16,
    flexWrap: "wrap",
  };
  if (!cycle) {
    return (
      <div
        style={{ ...box, border: "1px dashed #91caff", background: "#f5faff" }}
      >
        <Flex vertical={true} gap={4} style={{ flex: 1 }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "#0958d9",
            }}
          >
            No cycle running
          </span>
          <span>
            Plan in 12-week cycles: goals set for a cycle take its dates, and
            Focus shows its week and execution.
          </span>
        </Flex>
        <Button type={"primary"} icon={<CalendarOutlined />} onClick={onPlan}>
          Plan a cycle
        </Button>
      </div>
    );
  }
  const week =
    cycle.currentWeek ??
    (cycle.status === "buffer"
      ? cycle.weeks + 1
      : cycle.status === "past"
        ? cycle.weeks + cycle.bufferWeeks + 1
        : 0);
  const cells = Array.from(
    { length: cycle.weeks + cycle.bufferWeeks },
    (_, i) => i + 1,
  );
  const stat = (value: number | undefined, label: string, sub: string) => (
    <Flex vertical={true}>
      <span style={{ fontSize: 22, fontWeight: 600 }}>
        {value === undefined ? "–" : `${formatValue(value)}%`}
      </span>
      <Text style={{ fontSize: 12, color: "#595959" }}>{label}</Text>
      <Text type={"secondary"} style={{ fontSize: 12 }}>
        {sub}
      </Text>
    </Flex>
  );
  return (
    <div style={box}>
      <Flex vertical={true} gap={4} style={{ width: 220 }}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "#0958d9",
          }}
        >
          {cycle.name}
        </span>
        <span style={{ fontSize: 20, fontWeight: 600 }}>
          {cycle.currentWeek !== undefined
            ? `Week ${cycle.currentWeek} of ${cycle.weeks}`
            : cycle.status === "buffer"
              ? "Buffer week"
              : cycle.status === "upcoming"
                ? "Starts soon"
                : "Finished"}
        </span>
        <Text style={{ fontSize: 13, color: "#595959" }}>
          {formatDay(cycle.startDate, today)} –{" "}
          {formatDay(cycle.endDate, today)}
          {cycle.bufferWeeks > 0
            ? `, buffer to ${formatDay(cycle.bufferEndDate, today)}`
            : ""}
        </Text>
      </Flex>
      <div
        role={"img"}
        aria-label={
          cycle.currentWeek !== undefined
            ? `Week ${cycle.currentWeek} of ${cycle.weeks}`
            : cycle.status
        }
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))`,
          gap: 4,
          flex: "1 1 200px",
        }}
      >
        {cells.map((n) => {
          const buffer = n > cycle.weeks;
          const done = n < week;
          const now = n === week;
          return (
            <span
              key={n}
              style={{
                height: 10,
                borderRadius: 2,
                border: `1px solid ${done || now ? "#0958d9" : "#91caff"}`,
                background: done
                  ? "#0958d9"
                  : now
                    ? "#69b1ff"
                    : buffer
                      ? "repeating-linear-gradient(135deg, #d9d9d9 0 3px, #ffffff 3px 6px)"
                      : "#ffffff",
              }}
            />
          );
        })}
      </div>
      <Flex gap={28}>
        {stat(
          execution?.score,
          "execution this week",
          execution
            ? `${execution.done} of ${execution.due} · target ${EXECUTION_TARGET}%`
            : `target ${EXECUTION_TARGET}%`,
        )}
        {stat(
          cycleExecution?.score,
          "cycle to date",
          cycle.currentWeek !== undefined ? `weeks 1–${cycle.currentWeek}` : "",
        )}
      </Flex>
      {canPlan && (
        <Button type={"primary"} icon={<CalendarOutlined />} onClick={onPlan}>
          Plan next cycle
        </Button>
      )}
    </div>
  );
};

/** How far each level of sub-goal is indented, in pixels. */
const NEST = 24;

/** Collapse's look for the Focus sections: no borders, small-capital headings. */
const section = (
  key: string,
  label: React.ReactNode,
  children: React.ReactNode,
  extra?: React.ReactNode,
) => ({
  key,
  label: <Heading>{label}</Heading>,
  extra,
  children,
  styles: { header: { paddingInline: 0 }, body: { paddingInline: 0 } },
});

/**
 * Focus: the current cycle, then goals ranked by what needs attention,
 * each with Check in; a goal at risk or worse on three check-ins running
 * asks for a decision. A resizable split puts this week's bars, today's
 * habits and what is due next beside it.
 */
const FocusView: React.FunctionComponent<FocusViewProps> = ({
  goals,
  categories,
  cycle,
  cycles,
  execution,
  today,
  onPlanCycle,
  onCheckIn,
  onReplan,
  onDrop,
  onChanged,
}) => {
  const [cycleExecution, setCycleExecution] = useState<GoalExecution>();
  // The split fills the window below where it starts; each side scrolls on
  // its own.
  const rootRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>();
  useEffect(() => {
    const fit = () => {
      const top = rootRef.current?.getBoundingClientRect().top;
      if (top !== undefined) {
        setHeight(Math.max(320, window.innerHeight - top - 16));
      }
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  const names = new Map(categories.map((c) => [c.id, c.name]));
  const titles = new Map(goals.map((g) => [g.id, g.title]));
  const active = goals.filter((g) => g.status === "active");
  const ranked = rankForFocus(active);
  const attention = ranked.filter(
    (g) =>
      g.needsDecision || g.health === "off_track" || g.health === "at_risk",
  );
  const fine = ranked.filter((g) => !attention.includes(g));
  const dueNext = active
    .filter((g) => g.dueDate && g.dueDate >= today)
    .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!))
    .slice(0, 5);

  useEffect(() => {
    if (!cycle) return;
    goalsApi
      .getExecution({ cycleId: cycle.id })
      .then(setCycleExecution)
      .catch(() => setCycleExecution(undefined));
  }, [cycle]);

  // A sub-goal sits under its parent when both are in the same section;
  // otherwise it starts the row and names its parent.
  const row = ({ goal, depth }: GoalRow) => (
    <List.Item
      key={goal.id}
      actions={[
        <Button
          key={"check-in"}
          icon={<CheckCircleOutlined />}
          onClick={() => onCheckIn(goal)}
        >
          Check in
        </Button>,
      ]}
    >
      <Flex
        vertical={true}
        gap={4}
        style={{ width: "100%", paddingLeft: depth * NEST }}
      >
        <Flex align={"center"} gap={8} wrap={true}>
          <GoalTypeIcon type={goal.type} />
          <Link href={`/minerva/goals/${goal.id}`}>
            <Text strong={true}>{goal.title}</Text>
          </Link>
          <Text type={"secondary"}>
            {names.get(goal.categoryId)}
            {depth === 0 && goal.parentId && titles.get(goal.parentId)
              ? ` · in ${titles.get(goal.parentId)}`
              : ""}
          </Text>
          <HealthLabel health={goal.health} />
        </Flex>
        <Flex align={"center"} gap={16}>
          <PaceBar
            goal={goal}
            width={"auto"}
            style={{ flex: "1 1 60%", maxWidth: 360 }}
          />
          <Text type={"secondary"} style={{ fontSize: 12 }}>
            {metricText(goal)}
          </Text>
          <Text type={"secondary"} style={{ fontSize: 12 }}>
            <CalendarOutlined /> {dueText(goal, today)}
          </Text>
        </Flex>
        {goal.needsDecision && (
          <Alert
            type={"warning"}
            showIcon={true}
            icon={<ExclamationCircleOutlined />}
            title={
              "At risk or off track on 3 check-ins running. Time to decide."
            }
            action={
              <Space>
                <Button size={"small"} onClick={() => onReplan(goal)}>
                  Replan
                </Button>
                <PushDueDate goal={goal} onChanged={onChanged} />
                <Button
                  size={"small"}
                  danger={true}
                  onClick={() => onDrop(goal)}
                >
                  Drop
                </Button>
              </Space>
            }
          />
        )}
      </Flex>
    </List.Item>
  );

  return (
    <div ref={rootRef}>
      <Splitter style={{ height }}>
        <Splitter.Panel
          defaultSize={"66%"}
          min={"40%"}
          max={"80%"}
          style={{ overflowY: "auto", scrollbarWidth: "none" }}
        >
          <div style={{ paddingRight: 16 }}>
            <CycleBanner
              cycle={cycle}
              execution={execution}
              cycleExecution={cycleExecution}
              today={today}
              canPlan={!cycles.some((c) => c.status === "upcoming")}
              onPlan={onPlanCycle}
            />
            <Collapse
              ghost={true}
              defaultActiveKey={["attention", "fine"]}
              items={[
                ...(attention.length
                  ? [
                      section(
                        "attention",
                        `Needs attention · ${attention.length}`,
                        <List
                          dataSource={goalTree(attention, Infinity)}
                          renderItem={row}
                        />,
                        <Text type={"secondary"} style={{ fontSize: 12 }}>
                          Off track first, then at risk
                        </Text>,
                      ),
                    ]
                  : []),
                section(
                  "fine",
                  `On track · ${fine.length}`,
                  fine.length ? (
                    <List
                      dataSource={goalTree(fine, Infinity)}
                      renderItem={row}
                    />
                  ) : (
                    <Empty description={"No goals on track yet"} />
                  ),
                ),
              ]}
            />
          </div>
        </Splitter.Panel>
        <Splitter.Panel
          min={"20%"}
          style={{ overflowY: "auto", scrollbarWidth: "none" }}
        >
          <div style={{ paddingLeft: 16 }}>
            <Flex
              justify={"space-between"}
              align={"baseline"}
              style={{ paddingBlock: 12 }}
            >
              <Heading>This week</Heading>
              {execution && (
                <Text type={"secondary"} style={{ fontSize: 12 }}>
                  {formatValue(execution.score)}% · {execution.done} of{" "}
                  {execution.due} done
                </Text>
              )}
            </Flex>
            <WeekBars execution={execution} today={today} />
            <Collapse
              ghost={true}
              defaultActiveKey={["habits", "due"]}
              style={{ marginTop: 8 }}
              items={[
                section(
                  "habits",
                  "Today’s habits",
                  <TodaysHabits onLogged={onChanged} />,
                  <Text type={"secondary"} style={{ fontSize: 12 }}>
                    {DateTime.fromISO(today).toFormat("ccc LLL d")}
                  </Text>,
                ),
                section(
                  "due",
                  "Due next",
                  dueNext.length ? (
                    <List
                      size={"small"}
                      dataSource={dueNext}
                      renderItem={(g) => (
                        <List.Item style={{ paddingInline: 0 }}>
                          <Text type={"secondary"} style={{ width: 64 }}>
                            {formatDay(g.dueDate, today)}
                          </Text>
                          <Link
                            href={`/minerva/goals/${g.id}`}
                            style={{ flex: 1 }}
                          >
                            {g.title}
                          </Link>
                        </List.Item>
                      )}
                    />
                  ) : (
                    <Empty description={"Nothing due"} />
                  ),
                ),
              ]}
            />
          </div>
        </Splitter.Panel>
      </Splitter>
    </div>
  );
};

export default FocusView;
