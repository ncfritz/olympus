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
  Card,
  Col,
  DatePicker,
  Divider,
  Empty,
  Flex,
  List,
  message,
  Popover,
  Row,
  Space,
  Statistic,
  Tooltip,
  Typography,
} from "antd";
import dayjs from "dayjs";
import { DateTime } from "luxon";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import goalsApi from "../../../api/goalsApi";
import {
  apiProblems,
  dueText,
  formatDay,
  formatValue,
  metricText,
  rankForFocus,
} from "../../../utils/goals";
import { GoalProgress, GoalTypeIcon, HealthTag } from "./GoalBits";
import { EXECUTION_TARGET } from "./SummaryStrip";
import TodaysHabits from "./TodaysHabits";

const { Text, Title } = Typography;

export interface FocusViewProps {
  goals: Goal[];
  categories: GoalCategory[];
  cycle?: GoalCycle;
  execution?: GoalExecution;
  today: string;
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

/**
 * Focus: the current cycle, then goals ranked by what needs attention,
 * each with Check in; a goal at risk or worse on three check-ins running
 * asks for a decision. The side holds today's habits, the week and what
 * is due next.
 */
const FocusView: React.FunctionComponent<FocusViewProps> = ({
  goals,
  categories,
  cycle,
  execution,
  today,
  onCheckIn,
  onReplan,
  onDrop,
  onChanged,
}) => {
  const [cycleExecution, setCycleExecution] = useState<GoalExecution>();
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

  const row = (goal: Goal) => (
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
      <Flex vertical={true} gap={4} style={{ width: "100%" }}>
        <Flex align={"center"} gap={8} wrap={true}>
          <GoalTypeIcon type={goal.type} />
          <Link href={`/minerva/goals/${goal.id}`}>
            <Text strong={true}>{goal.title}</Text>
          </Link>
          <Text type={"secondary"}>
            {names.get(goal.categoryId)}
            {goal.parentId && titles.get(goal.parentId)
              ? ` · in ${titles.get(goal.parentId)}`
              : ""}
          </Text>
          <HealthTag health={goal.health} />
        </Flex>
        <Flex align={"center"} gap={16}>
          <div style={{ flex: 1, maxWidth: 360 }}>
            <GoalProgress goal={goal} />
          </div>
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
    <Row gutter={[24, 24]}>
      <Col xs={24} xl={16}>
        {cycle && (
          <Card size={"small"} style={{ marginBottom: 16 }}>
            <Flex wrap={true} gap={32} align={"center"}>
              <div>
                <Title level={5} style={{ margin: 0 }}>
                  {cycle.name}
                </Title>
                <Text>
                  {cycle.currentWeek !== undefined
                    ? `Week ${cycle.currentWeek} of ${cycle.weeks}`
                    : cycle.status === "buffer"
                      ? "Buffer week"
                      : "Starts soon"}
                </Text>
                <br />
                <Text type={"secondary"} style={{ fontSize: 12 }}>
                  {formatDay(cycle.startDate, today)} –{" "}
                  {formatDay(cycle.endDate, today)}
                  {cycle.bufferWeeks > 0
                    ? `, buffer to ${formatDay(cycle.bufferEndDate, today)}`
                    : ""}
                </Text>
              </div>
              <Statistic
                title={"Execution this week"}
                value={execution?.score ?? "–"}
                suffix={execution?.score !== undefined ? "%" : undefined}
              />
              <Text type={"secondary"} style={{ fontSize: 12 }}>
                {execution ? `${execution.done} of ${execution.due}` : ""} ·
                target {EXECUTION_TARGET}%
              </Text>
              <Statistic
                title={"Cycle to date"}
                value={cycleExecution?.score ?? "–"}
                suffix={cycleExecution?.score !== undefined ? "%" : undefined}
              />
            </Flex>
          </Card>
        )}
        <Card
          size={"small"}
          title={`Needs attention · ${attention.length}`}
          extra={<Text type={"secondary"}>Off track first, then at risk</Text>}
          style={{ marginBottom: 16 }}
        >
          {attention.length ? (
            <List dataSource={attention} renderItem={row} />
          ) : (
            <Empty description={"Nothing needs you right now"} />
          )}
        </Card>
        <Card size={"small"} title={`On track · ${fine.length}`}>
          <List dataSource={fine} renderItem={row} />
        </Card>
      </Col>
      <Col xs={24} xl={8}>
        <Card
          size={"small"}
          title={`Today’s habits · ${DateTime.fromISO(today).toFormat("ccc LLL d")}`}
        >
          <TodaysHabits onLogged={onChanged} />
        </Card>
        <Card size={"small"} title={"This week"} style={{ marginTop: 16 }}>
          <WeekBars execution={execution} today={today} />
          {execution && (
            <>
              <Divider style={{ marginBlock: 8 }} />
              <Text>
                {formatValue(execution.score)}% · {execution.done} of{" "}
                {execution.due} done
              </Text>
            </>
          )}
        </Card>
        <Card size={"small"} title={"Due next"} style={{ marginTop: 16 }}>
          {dueNext.length ? (
            <List
              size={"small"}
              dataSource={dueNext}
              renderItem={(g) => (
                <List.Item>
                  <Text type={"secondary"} style={{ width: 64 }}>
                    {formatDay(g.dueDate, today)}
                  </Text>
                  <Link href={`/minerva/goals/${g.id}`} style={{ flex: 1 }}>
                    {g.title}
                  </Link>
                </List.Item>
              )}
            />
          ) : (
            <Empty description={"Nothing due"} />
          )}
        </Card>
      </Col>
    </Row>
  );
};

export default FocusView;
