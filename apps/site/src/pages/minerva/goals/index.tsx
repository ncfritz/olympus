import type { FullGoal, Goal } from "@ncfritz/olympus-sdk/minerva";
import {
  CalendarOutlined,
  PlusOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { Button, Flex, message, Space, Spin, Typography } from "antd";
import { DateTime } from "luxon";
import { useRouter } from "next/router";
import React, { useMemo, useState } from "react";
import goalsApi from "../../../api/goalsApi";
import BoardView from "../../../components/minerva/goals/BoardView";
import CategoriesDrawer from "../../../components/minerva/goals/CategoriesDrawer";
import CheckinModal from "../../../components/minerva/goals/CheckinModal";
import CyclesDrawer from "../../../components/minerva/goals/CyclesDrawer";
import PlanCycleModal from "../../../components/minerva/goals/PlanCycleModal";
import CloseGoalModal from "../../../components/minerva/goals/CloseGoalModal";
import FocusView from "../../../components/minerva/goals/FocusView";
import RoadmapView, {
  RoadmapLegend,
  YearSelector,
} from "../../../components/minerva/goals/RoadmapView";
import GoalFormDrawer from "../../../components/minerva/goals/GoalFormDrawer";
import GoalsBreadcrumbs from "../../../components/minerva/goals/GoalsBreadcrumbs";
import GoalsFilterBar, {
  BoardLegend,
  type GoalsView,
  OPEN_STATUSES,
} from "../../../components/minerva/goals/GoalsFilterBar";
import SummaryStrip from "../../../components/minerva/goals/SummaryStrip";
import { useGoalsData } from "../../../components/minerva/goals/useGoalsData";
import {
  currentCycle,
  type HorizonChoice,
  apiProblems,
  habitTap,
  inHorizon,
} from "../../../utils/goals";

const { Title, Text } = Typography;

/**
 * Goals home (docs/plans/goals/design.md): Board, Roadmap and Focus over
 * the same goals, filters and summary. The view is kept in the URL.
 */
const GoalsPage: React.FunctionComponent = () => {
  const router = useRouter();
  const view: GoalsView =
    router.query.view === "roadmap" || router.query.view === "focus"
      ? router.query.view
      : "board";
  const [statuses, setStatuses] = useState<string[]>(OPEN_STATUSES);
  const [horizon, setHorizon] = useState<HorizonChoice>("all");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [form, setForm] = useState<{
    open: boolean;
    goal?: FullGoal;
    categoryId?: string;
  }>({ open: false });
  const [managing, setManaging] = useState(false);
  const [managingCycles, setManagingCycles] = useState(false);
  const [roadmapYear, setRoadmapYear] = useState(DateTime.now().year);
  const [planning, setPlanning] = useState(false);
  const [checkingIn, setCheckingIn] = useState<Goal>();
  const [dropping, setDropping] = useState<Goal>();
  const [achieving, setAchieving] = useState<Goal>();
  const data = useGoalsData(statuses);
  const today = DateTime.now().toISODate()!;
  const cycle = currentCycle(data.cycles);

  const shown = useMemo(
    () =>
      data.goals.filter(
        (g) =>
          inHorizon(g, horizon, today, cycle) &&
          g.title.toLowerCase().includes(title.trim().toLowerCase()) &&
          (tagIds.length === 0 || tagIds.some((t) => g.tagIds.includes(t))),
      ),
    [data.goals, horizon, tagIds, title, today, cycle],
  );

  const setView = (next: GoalsView) =>
    router.replace({ query: { ...router.query, view: next } }, undefined, {
      shallow: true,
    });

  const year = DateTime.fromISO(today);

  /** Saves a new order of the categories, from the Board or the Roadmap. */
  const reorderCategories = async (categoryIds: string[]) => {
    try {
      await goalsApi.reorderCategories(categoryIds);
      await data.reload();
    } catch (error) {
      message.error("Could not save the new order");
      throw error;
    }
  };

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
      <div
        style={{
          height: "calc(100vh - 92px)",
          overflowX: "hidden",
          overflowY: "auto",
        }}
      >
        <Flex
          justify={"space-between"}
          align={"center"}
          style={{ padding: 16 }}
        >
          <Space align={"baseline"} size={12}>
            <Title level={3} style={{ margin: 0 }}>
              Goals
            </Title>
            <Text type={"secondary"} style={{ fontSize: 15 }}>
              {view === "board"
                ? "By category"
                : view === "focus"
                  ? "What needs you now"
                  : `${roadmapYear} roadmap`}
            </Text>
          </Space>
          <Space size={8}>
            <Button
              type={"text"}
              icon={<CalendarOutlined />}
              onClick={() => setManagingCycles(true)}
            >
              Manage cycles
            </Button>
            <Button
              type={"text"}
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
        <SummaryStrip
          goals={shown}
          execution={data.execution}
          cycle={cycle}
          loading={data.loading}
        />
        <GoalsFilterBar
          view={view}
          onView={setView}
          title={title}
          onTitle={setTitle}
          horizon={horizon}
          onHorizon={setHorizon}
          year={year.year}
          quarter={year.quarter}
          cycle={cycle}
          tags={data.tags}
          onTags={setTagIds}
          onStatuses={setStatuses}
          legend={
            view === "roadmap" ? (
              <>
                <RoadmapLegend />
                <YearSelector year={roadmapYear} onYear={setRoadmapYear} />
              </>
            ) : (
              <BoardLegend />
            )
          }
        />
        <div style={{ padding: 16 }}>
          {data.loading ? (
            <Flex justify={"center"} style={{ padding: 48 }}>
              <Spin />
            </Flex>
          ) : view === "focus" ? (
            <FocusView
              goals={shown}
              categories={data.categories}
              cycle={cycle}
              cycles={data.cycles}
              execution={data.execution}
              today={today}
              onPlanCycle={() => setPlanning(true)}
              onCheckIn={setCheckingIn}
              onReplan={replan}
              onDrop={setDropping}
              onChanged={() => void data.reload()}
            />
          ) : view === "roadmap" ? (
            <RoadmapView
              year={roadmapYear}
              goals={shown}
              categories={data.categories}
              cycles={data.cycles}
              today={today}
              onReorder={reorderCategories}
            />
          ) : (
            view === "board" && (
              <BoardView
                goals={shown}
                categories={data.categories}
                today={today}
                onAddGoal={(categoryId) => setForm({ open: true, categoryId })}
                done={{
                  habits: new Map(data.habits.map((h) => [h.goal.id, h])),
                  onHabitDone: async (habit) => {
                    const tap = habitTap(habit);
                    try {
                      if (tap.action === "clear") {
                        await goalsApi.deleteHabitLog(habit.goal.id, "today");
                      } else {
                        await goalsApi.logHabit(
                          habit.goal.id,
                          "today",
                          tap.log,
                        );
                      }
                      await data.reload();
                    } catch (error) {
                      message.error(apiProblems(error).join("; "));
                    }
                  },
                  onAchieved: setAchieving,
                }}
                onReorder={reorderCategories}
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
        goal={achieving}
        status={"achieved"}
        onClose={() => setAchieving(undefined)}
        onClosed={() => {
          setAchieving(undefined);
          void data.reload();
        }}
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
      <CyclesDrawer
        open={managingCycles}
        cycles={data.cycles}
        goals={data.goals}
        today={today}
        onClose={() => setManagingCycles(false)}
        onChanged={data.reload}
      />
      <PlanCycleModal
        open={planning}
        cycles={data.cycles}
        today={today}
        onClose={() => setPlanning(false)}
        onCreated={() => {
          setPlanning(false);
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
