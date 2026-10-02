import {
  AppstoreOutlined,
  AimOutlined,
  PlusOutlined,
  ScheduleOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import type { FullGoal, Goal } from "@ncfritz/olympus-sdk/minerva";
import {
  Button,
  Flex,
  message,
  Segmented,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
} from "antd";
import { DateTime } from "luxon";
import { useRouter } from "next/router";
import React, { useMemo, useState } from "react";
import goalsApi from "../../../api/goalsApi";
import BoardView from "../../../components/minerva/goals/BoardView";
import CategoriesDrawer from "../../../components/minerva/goals/CategoriesDrawer";
import CheckinModal from "../../../components/minerva/goals/CheckinModal";
import CloseGoalModal from "../../../components/minerva/goals/CloseGoalModal";
import FocusView from "../../../components/minerva/goals/FocusView";
import RoadmapView from "../../../components/minerva/goals/RoadmapView";
import GoalFormDrawer from "../../../components/minerva/goals/GoalFormDrawer";
import GoalsBreadcrumbs from "../../../components/minerva/goals/GoalsBreadcrumbs";
import SummaryStrip from "../../../components/minerva/goals/SummaryStrip";
import { useGoalsData } from "../../../components/minerva/goals/useGoalsData";
import {
  currentCycle,
  type HorizonChoice,
  inHorizon,
  STATUS_LABEL,
} from "../../../utils/goals";

const { Title, Text } = Typography;

type View = "board" | "roadmap" | "focus";

const VIEWS: { value: View; label: string; icon: React.ReactNode }[] = [
  { value: "board", label: "Board", icon: <AppstoreOutlined /> },
  { value: "roadmap", label: "Roadmap", icon: <ScheduleOutlined /> },
  { value: "focus", label: "Focus", icon: <AimOutlined /> },
];

const SUBTITLE: Record<View, string> = {
  board: "By category",
  roadmap: "The year ahead",
  focus: "What needs you now",
};

const OPEN = ["draft", "active", "paused"];

/**
 * Goals home (docs/plans/goals/design.md): Board, Roadmap and Focus over
 * the same goals, filters and summary. The view is kept in the URL.
 */
const GoalsPage: React.FunctionComponent = () => {
  const router = useRouter();
  const view: View =
    router.query.view === "roadmap" || router.query.view === "focus"
      ? router.query.view
      : "board";
  const [statuses, setStatuses] = useState<string[]>(OPEN);
  const [horizon, setHorizon] = useState<HorizonChoice>("all");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [form, setForm] = useState<{
    open: boolean;
    goal?: FullGoal;
    categoryId?: string;
  }>({ open: false });
  const [managing, setManaging] = useState(false);
  const [checkingIn, setCheckingIn] = useState<Goal>();
  const [dropping, setDropping] = useState<Goal>();
  const data = useGoalsData(statuses);
  const today = DateTime.now().toISODate()!;
  const cycle = currentCycle(data.cycles);

  const shown = useMemo(
    () =>
      data.goals.filter(
        (g) =>
          inHorizon(g, horizon, today, cycle) &&
          (tagIds.length === 0 || tagIds.some((t) => g.tagIds.includes(t))),
      ),
    [data.goals, horizon, tagIds, today, cycle],
  );

  const setView = (next: View) =>
    router.replace({ query: { ...router.query, view: next } }, undefined, {
      shallow: true,
    });

  const year = DateTime.fromISO(today);

  const replan = async (goal: Goal) => {
    try {
      setForm({ open: true, goal: await goalsApi.describeGoal(goal.id) });
    } catch {
      message.error("Could not open the goal");
    }
  };

  return (
    <>
      <GoalsBreadcrumbs />
      <div style={{ padding: "44px 24px 24px" }}>
        <Flex justify={"space-between"} align={"center"} wrap={true} gap={16}>
          <Space align={"baseline"}>
            <Title level={3} style={{ margin: 0 }}>
              Goals
            </Title>
            <Text type={"secondary"}>{SUBTITLE[view]}</Text>
          </Space>
          <Space wrap={true}>
            <Segmented
              value={view}
              onChange={(v) => setView(v as View)}
              options={VIEWS.map((v) => ({
                value: v.value,
                label: v.label,
                icon: v.icon,
              }))}
            />
            <Button
              icon={<SettingOutlined />}
              onClick={() => setManaging(true)}
            >
              Manage categories
            </Button>
            <Button
              type={"primary"}
              icon={<PlusOutlined />}
              onClick={() => setForm({ open: true })}
            >
              New goal
            </Button>
          </Space>
        </Flex>

        <Flex wrap={true} gap={24} align={"center"} style={{ marginBlock: 16 }}>
          <Space>
            <Text type={"secondary"}>Horizon</Text>
            <Segmented
              value={horizon}
              onChange={(v) => setHorizon(v as HorizonChoice)}
              options={[
                { value: "all", label: "All" },
                { value: "year", label: String(year.year) },
                { value: "quarter", label: `Q${year.quarter}` },
                ...(cycle ? [{ value: "cycle", label: cycle.name }] : []),
                { value: "ongoing", label: "Ongoing" },
              ]}
            />
          </Space>
          {data.tags.length > 0 && (
            <Space wrap={true} size={4}>
              <Text type={"secondary"}>Tags</Text>
              {data.tags.map((tag) => (
                <Tag.CheckableTag
                  key={tag.id}
                  checked={tagIds.includes(tag.id)}
                  onChange={(on) =>
                    setTagIds((was) =>
                      on ? [...was, tag.id] : was.filter((t) => t !== tag.id),
                    )
                  }
                >
                  #{tag.name}
                </Tag.CheckableTag>
              ))}
            </Space>
          )}
          <Space>
            <Text type={"secondary"}>Status</Text>
            <Select
              mode={"multiple"}
              value={statuses}
              onChange={(v) => setStatuses(v.length ? v : OPEN)}
              style={{ minWidth: 240 }}
              aria-label={"Status"}
              options={Object.entries(STATUS_LABEL).map(([value, label]) => ({
                value,
                label,
              }))}
            />
          </Space>
        </Flex>

        <SummaryStrip goals={shown} execution={data.execution} cycle={cycle} />

        <div style={{ marginTop: 16 }}>
          {data.loading ? (
            <Flex justify={"center"} style={{ padding: 48 }}>
              <Spin />
            </Flex>
          ) : view === "focus" ? (
            <FocusView
              goals={shown}
              categories={data.categories}
              cycle={cycle}
              execution={data.execution}
              today={today}
              onCheckIn={setCheckingIn}
              onReplan={replan}
              onDrop={setDropping}
              onChanged={() => void data.reload()}
            />
          ) : view === "roadmap" ? (
            <div style={{ overflowX: "auto" }}>
              <RoadmapView
                goals={shown}
                categories={data.categories}
                cycles={data.cycles}
                today={today}
              />
            </div>
          ) : (
            view === "board" && (
              <BoardView
                goals={shown}
                categories={data.categories}
                today={today}
                onAddGoal={(categoryId) => setForm({ open: true, categoryId })}
              />
            )
          )}
        </div>
      </div>

      <GoalFormDrawer
        open={form.open}
        goal={form.goal}
        categoryId={form.categoryId}
        categories={data.categories}
        cycles={data.cycles}
        goals={data.goals}
        tags={data.tags}
        onTagCreated={() => void data.reload()}
        onClose={() => setForm({ open: false })}
        onSaved={() => {
          setForm({ open: false });
          void data.reload();
        }}
      />
      <CheckinModal
        goal={checkingIn}
        onClose={() => setCheckingIn(undefined)}
        onSaved={() => void data.reload()}
      />
      <CloseGoalModal
        goal={dropping}
        status={"dropped"}
        onClose={() => setDropping(undefined)}
        onClosed={() => {
          setDropping(undefined);
          void data.reload();
        }}
      />
      <CategoriesDrawer
        open={managing}
        categories={data.categories}
        goals={data.goals}
        onClose={() => setManaging(false)}
        onChanged={data.reload}
      />
    </>
  );
};

export default GoalsPage;
