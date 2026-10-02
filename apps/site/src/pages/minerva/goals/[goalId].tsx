import {
  CheckCircleOutlined,
  EditOutlined,
  MoreOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import type {
  FullGoal,
  Goal,
  GoalCategory,
  GoalCheckin,
  GoalCycle,
  Tag as GoalTag,
} from "@ncfritz/olympus-sdk/minerva";
import {
  Alert,
  Button,
  Card,
  Col,
  Dropdown,
  Empty,
  Flex,
  List,
  message,
  Modal,
  Result,
  Row,
  Space,
  Spin,
  Tag,
  Typography,
} from "antd";
import { DateTime } from "luxon";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/router";
import React, { useCallback, useEffect, useState } from "react";
import goalsApi from "../../../api/goalsApi";
import tagsApi from "../../../api/tagsApi";
import AchievementPanel from "../../../components/minerva/goals/AchievementPanel";
import CheckinForm from "../../../components/minerva/goals/CheckinForm";
import CheckinHistory from "../../../components/minerva/goals/CheckinHistory";
import CloseGoalModal from "../../../components/minerva/goals/CloseGoalModal";
import {
  GoalProgress,
  GoalTypeIcon,
  HealthTag,
} from "../../../components/minerva/goals/GoalBits";
import GoalFormDrawer from "../../../components/minerva/goals/GoalFormDrawer";
import GoalsBreadcrumbs from "../../../components/minerva/goals/GoalsBreadcrumbs";
import HabitPanel from "../../../components/minerva/goals/HabitPanel";
import MilestonePanel from "../../../components/minerva/goals/MilestonePanel";
import {
  apiProblems,
  dueText,
  formatDay,
  HORIZON_LABEL,
  isClosed,
  metricText,
  MODE_LABEL,
  ROLLUP_LABEL,
  STATUS_LABEL,
  TYPE_LABEL,
} from "../../../utils/goals";

const { Title, Text, Paragraph } = Typography;

// Highcharts and its range series touch the document as they load, so the
// outcome chart renders in the browser only.
const OutcomePanel = dynamic(
  () => import("../../../components/minerva/goals/OutcomePanel"),
  { ssr: false, loading: () => <Spin /> },
);

type Context = {
  categories: GoalCategory[];
  cycles: GoalCycle[];
  goals: Goal[];
  tags: GoalTag[];
};

/**
 * A goal's page (docs/plans/goals/design.md): the header, the panel for
 * its type, its sub-goals and, at the side, the check-in form and the
 * history of check-ins.
 */
const GoalPage: React.FunctionComponent = () => {
  const router = useRouter();
  const goalId =
    typeof router.query.goalId === "string" ? router.query.goalId : undefined;
  const today = DateTime.now().toISODate()!;
  const [goal, setGoal] = useState<FullGoal>();
  const [missing, setMissing] = useState(false);
  const [checkins, setCheckins] = useState<GoalCheckin[]>([]);
  const [context, setContext] = useState<Context>({
    categories: [],
    cycles: [],
    goals: [],
    tags: [],
  });
  const [form, setForm] = useState<{ open: boolean; edit: boolean }>({
    open: false,
    edit: true,
  });
  const [closing, setClosing] = useState<"achieved" | "missed" | "dropped">();

  const load = useCallback(async () => {
    if (!goalId) return;
    try {
      const [g, c] = await Promise.all([
        goalsApi.describeGoal(goalId),
        goalsApi.listCheckins(goalId),
      ]);
      setGoal(g);
      setCheckins(c);
    } catch {
      setMissing(true);
    }
  }, [goalId]);

  const loadContext = useCallback(async () => {
    try {
      const [categories, cycles, goals, tags] = await Promise.all([
        goalsApi.listCategories(),
        goalsApi.listCycles(),
        goalsApi.listGoals(),
        tagsApi.listTags(),
      ]);
      setContext({ categories, cycles, goals, tags });
    } catch {
      message.error("Could not load your categories and goals");
    }
  }, []);

  useEffect(() => {
    void load();
    void loadContext();
  }, [load, loadContext]);

  if (missing) {
    return (
      <>
        <GoalsBreadcrumbs trail={["Not found"]} />
        <Result
          status={"404"}
          title={"No such goal"}
          extra={<Link href={"/minerva/goals"}>Back to goals</Link>}
        />
      </>
    );
  }
  if (!goal) {
    return (
      <>
        <GoalsBreadcrumbs />
        <Flex justify={"center"} style={{ padding: 96 }}>
          <Spin />
        </Flex>
      </>
    );
  }

  const category = context.categories.find((c) => c.id === goal.categoryId);
  const cycle = context.cycles.find((c) => c.id === goal.cycleId);
  const parent = context.goals.find((g) => g.id === goal.parentId);
  const closed = isClosed(goal);
  const readOnly = closed || goal.deleted;

  const act = async (work: () => Promise<unknown>, done: string) => {
    try {
      await work();
      message.success(done);
      await load();
    } catch (error) {
      message.error(apiProblems(error).join("; "));
    }
  };

  const more = [
    ...(!readOnly
      ? [
          { key: "achieved", label: "Close as achieved…" },
          { key: "missed", label: "Close as missed…" },
          { key: "dropped", label: "Close as dropped…" },
          { type: "divider" as const },
          goal.status === "paused"
            ? { key: "resume", label: "Resume" }
            : { key: "pause", label: "Pause" },
        ]
      : []),
    ...(closed && !goal.deleted ? [{ key: "reopen", label: "Reopen" }] : []),
    ...(goal.deleted
      ? [{ key: "restore", label: "Restore" }]
      : [{ key: "delete", label: "Delete", danger: true }]),
  ];

  const onMore = ({ key }: { key: string }) => {
    switch (key) {
      case "achieved":
      case "missed":
      case "dropped":
        setClosing(key);
        break;
      case "pause":
        void act(
          () => goalsApi.updateGoal(goal.id, { goal: { status: "paused" } }),
          "Paused",
        );
        break;
      case "resume":
      case "reopen":
        void act(
          () => goalsApi.updateGoal(goal.id, { goal: { status: "active" } }),
          key === "resume" ? "Resumed" : "Reopened",
        );
        break;
      case "restore":
        void act(() => goalsApi.restoreGoal(goal.id), "Restored");
        break;
      case "delete":
        Modal.confirm({
          title: `Delete ${goal.title}?`,
          content: "It can be restored from its page.",
          okText: "Delete",
          okButtonProps: { danger: true },
          onOk: () =>
            act(() => goalsApi.deleteGoal(goal.id), "Deleted").then(() =>
              router.push("/minerva/goals"),
            ),
        });
        break;
    }
  };

  const panel = () => {
    if (goal.progressMode === "subgoals") {
      return (
        <Card size={"small"} title={"Progress"}>
          <GoalProgress goal={goal} size={"default"} />
          <Text type={"secondary"}>
            {metricText(goal)}, by{" "}
            {ROLLUP_LABEL[goal.rollup ?? "average"].toLowerCase()}.
          </Text>
        </Card>
      );
    }
    switch (goal.type) {
      case "outcome":
        return <OutcomePanel goal={goal} checkins={checkins} today={today} />;
      case "milestone":
        return (
          <MilestonePanel
            goal={goal}
            today={today}
            readOnly={readOnly}
            onChanged={load}
          />
        );
      case "habit":
        return (
          <HabitPanel
            goal={goal}
            today={today}
            readOnly={readOnly}
            onChanged={load}
          />
        );
      case "achievement":
        return (
          <AchievementPanel
            goal={goal}
            today={today}
            readOnly={readOnly}
            onAchieve={() => setClosing("achieved")}
          />
        );
    }
  };

  return (
    <>
      <GoalsBreadcrumbs
        trail={[
          ...(category ? [<span key={"c"}>{category.name}</span>] : []),
          <span key={"g"}>{goal.title}</span>,
        ]}
      />
      <div style={{ padding: "44px 24px 24px" }}>
        <Row gutter={[24, 24]}>
          <Col xs={24} xl={16}>
            <Flex
              justify={"space-between"}
              align={"start"}
              gap={16}
              wrap={true}
            >
              <Space
                orientation={"vertical"}
                size={4}
                style={{ flex: 1, minWidth: 280 }}
              >
                <Space align={"center"} wrap={true}>
                  <Title level={3} style={{ margin: 0 }}>
                    <GoalTypeIcon type={goal.type} /> {goal.title}
                  </Title>
                  <HealthTag health={goal.health} />
                  {goal.deleted && <Tag color={"default"}>Deleted</Tag>}
                </Space>
                {goal.why && (
                  <Paragraph type={"secondary"} style={{ margin: 0 }}>
                    <Text strong={true} type={"secondary"}>
                      Why:
                    </Text>{" "}
                    {goal.why}
                  </Paragraph>
                )}
                <Space
                  wrap={true}
                  size={[8, 4]}
                  split={<Text type={"secondary"}>·</Text>}
                >
                  {category && <Text>{category.name}</Text>}
                  <Text>
                    {TYPE_LABEL[goal.type]} ·{" "}
                    {MODE_LABEL[goal.progressMode].toLowerCase()}
                  </Text>
                  <Text>
                    {cycle ? cycle.name : HORIZON_LABEL[goal.horizon]} ·{" "}
                    {formatDay(goal.startDate, today)} – {dueText(goal, today)}
                  </Text>
                  <Text>{STATUS_LABEL[goal.status]}</Text>
                  {parent && (
                    <Link href={`/minerva/goals/${parent.id}`}>
                      in {parent.title}
                    </Link>
                  )}
                </Space>
                {goal.tags.length > 0 && (
                  <Space size={4} wrap={true}>
                    {goal.tags.map((t) => (
                      <Tag key={t.id} color={t.color}>
                        #{t.name}
                      </Tag>
                    ))}
                  </Space>
                )}
              </Space>
              <Space>
                {!readOnly && (
                  <Button
                    icon={<EditOutlined />}
                    onClick={() => setForm({ open: true, edit: true })}
                  >
                    Edit
                  </Button>
                )}
                <Dropdown
                  menu={{ items: more, onClick: onMore }}
                  trigger={["click"]}
                >
                  <Button icon={<MoreOutlined />} aria-label={"More actions"} />
                </Dropdown>
              </Space>
            </Flex>

            {goal.needsDecision && !readOnly && (
              <Alert
                style={{ marginTop: 16 }}
                type={"warning"}
                showIcon={true}
                title={
                  "At risk or off track on 3 check-ins running. Time to decide."
                }
                action={
                  <Space>
                    <Button
                      size={"small"}
                      onClick={() => setForm({ open: true, edit: true })}
                    >
                      Replan
                    </Button>
                    <Button
                      size={"small"}
                      danger={true}
                      onClick={() => setClosing("dropped")}
                    >
                      Drop
                    </Button>
                  </Space>
                }
              />
            )}
            {closed && (
              <Alert
                style={{ marginTop: 16 }}
                type={goal.status === "achieved" ? "success" : "info"}
                showIcon={true}
                title={`${STATUS_LABEL[goal.status]} on ${formatDay(goal.closedOn, today)}`}
                description={goal.closeNote}
              />
            )}

            <div style={{ marginTop: 16 }}>{panel()}</div>

            <Card
              size={"small"}
              style={{ marginTop: 16 }}
              title={`Sub-goals · ${goal.subGoals.length}`}
              extra={
                !readOnly && (
                  <Button
                    size={"small"}
                    icon={<PlusOutlined />}
                    onClick={() => setForm({ open: true, edit: false })}
                  >
                    Add sub-goal
                  </Button>
                )
              }
            >
              {goal.subGoals.length ? (
                <List
                  dataSource={goal.subGoals}
                  renderItem={(s) => (
                    <List.Item>
                      <Flex vertical={true} gap={4} style={{ width: "100%" }}>
                        <Flex gap={8} align={"center"}>
                          <GoalTypeIcon type={s.type} />
                          <Link
                            href={`/minerva/goals/${s.id}`}
                            style={{ flex: 1 }}
                          >
                            {s.title}
                          </Link>
                          <HealthTag health={s.health} />
                        </Flex>
                        <GoalProgress goal={s} />
                        <Text type={"secondary"} style={{ fontSize: 12 }}>
                          {metricText(s)} · {dueText(s, today)}
                        </Text>
                      </Flex>
                    </List.Item>
                  )}
                />
              ) : (
                <Empty
                  description={"No sub-goals"}
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              )}
              {goal.subGoals.length > 0 && goal.progressMode !== "subgoals" && (
                <Text type={"secondary"} style={{ fontSize: 12 }}>
                  Progress comes from{" "}
                  {MODE_LABEL[goal.progressMode]
                    .toLowerCase()
                    .replace("from ", "")}
                  , not from the sub-goals. Switch to a rollup in Edit.
                </Text>
              )}
            </Card>

            <Card
              size={"small"}
              style={{ marginTop: 16 }}
              title={"Linked tasks"}
            >
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={"Linking tasks to goals ships with Tasks."}
              />
            </Card>
          </Col>

          <Col xs={24} xl={8}>
            {!readOnly && (
              <Card
                size={"small"}
                title={
                  <Space>
                    <CheckCircleOutlined />
                    New check-in
                  </Space>
                }
              >
                <CheckinForm goal={goal} onSaved={load} />
              </Card>
            )}
            <Card
              size={"small"}
              title={`Check-in history · ${checkins.length}`}
              style={{ marginTop: readOnly ? 0 : 16 }}
            >
              <CheckinHistory
                goal={goal}
                checkins={checkins}
                today={today}
                onChanged={load}
              />
            </Card>
          </Col>
        </Row>
      </div>

      <GoalFormDrawer
        open={form.open}
        goal={form.edit ? goal : undefined}
        categoryId={goal.categoryId}
        parentId={form.edit ? undefined : goal.id}
        categories={context.categories}
        cycles={context.cycles}
        goals={context.goals}
        tags={context.tags}
        onTagCreated={() => void loadContext()}
        onClose={() => setForm({ open: false, edit: true })}
        onSaved={() => {
          setForm({ open: false, edit: true });
          void load();
          void loadContext();
        }}
      />
      <CloseGoalModal
        goal={closing ? goal : undefined}
        status={closing}
        onClose={() => setClosing(undefined)}
        onClosed={() => {
          setClosing(undefined);
          void load();
        }}
      />
    </>
  );
};

export default GoalPage;
