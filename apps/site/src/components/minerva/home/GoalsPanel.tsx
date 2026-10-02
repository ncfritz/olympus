import {
  CheckCircleOutlined,
  CheckSquareOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import type {
  Goal,
  GoalCycle,
  GoalExecution,
  ListGoalsForTodayResponse,
} from "@ncfritz/olympus-sdk/minerva";
import {
  Badge,
  Button,
  message,
  Segmented,
  Skeleton,
  Tabs,
  type TabsProps,
} from "antd";
import { DateTime } from "luxon";
import Link from "next/link";
import { useRouter } from "next/router";
import React, { useCallback, useEffect, useState } from "react";
import goalsApi from "../../../api/goalsApi";
import {
  apiProblems,
  currentCycle,
  dueText,
  formatValue,
  type HomeGoalRow,
  homeGoalRows,
  inHorizon,
  metricText,
  milestoneDueText,
  quarterWeekText,
} from "../../../utils/goals";
import {
  loadFromLocalStorage,
  storeToLocalStorage,
} from "../../../utils/storage";
import CheckinModal from "../goals/CheckinModal";
import { HEALTH_COLORS, HealthDot, PaceBar } from "../goals/GoalBits";
import TodaysHabits from "../goals/TodaysHabits";
import styles from "./GoalsPanel.module.css";

type TabKey = "habit" | "milestone" | "outcome" | "achievement";
type Span = "cycle" | "quarter";

const TABS: { key: TabKey; label: string; noun: string }[] = [
  { key: "habit", label: "Habits", noun: "habits" },
  { key: "milestone", label: "Milestones", noun: "milestone goals" },
  { key: "outcome", label: "Outcomes", noun: "outcome goals" },
  { key: "achievement", label: "Achievements", noun: "achievements" },
];

const TAB_KEY = "minerva.home.goals.tab";
const SPAN_KEY = "minerva.home.goals.span";

type Loaded = {
  goals: Goal[];
  cycles: GoalCycle[];
  today: ListGoalsForTodayResponse;
};

/**
 * Minerva Home's goals (phase 7): a tab per goal type. Habits is today's
 * habits, logged in one tap as on Focus; the others list the current
 * cycle's (or quarter's) active goals in Focus's order, each with Done on
 * its next milestone or Check in, and marked once done today.
 */
const GoalsPanel: React.FunctionComponent = () => {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("habit");
  const [span, setSpan] = useState<Span>("cycle");
  // Read after mounting: the server render has no local storage.
  useEffect(() => {
    const storedTab = loadFromLocalStorage<unknown>(TAB_KEY, "habit");
    if (TABS.some((t) => t.key === storedTab)) setTab(storedTab as TabKey);
    const storedSpan = loadFromLocalStorage<unknown>(SPAN_KEY, "cycle");
    if (storedSpan === "quarter") setSpan("quarter");
  }, []);

  const [data, setData] = useState<Loaded>();
  const [failed, setFailed] = useState(false);
  const [execution, setExecution] = useState<GoalExecution>();
  const [checkingIn, setCheckingIn] = useState<Goal>();
  const [busy, setBusy] = useState<string>();
  const [habitsVersion, setHabitsVersion] = useState(0);

  const load = useCallback(async () => {
    try {
      const [goals, cycles, today] = await Promise.all([
        goalsApi.listGoals(),
        goalsApi.listCycles(),
        goalsApi.listGoalsForToday(),
      ]);
      setData({ goals, cycles, today });
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const cycle = data ? currentCycle(data.cycles) : undefined;
  // With no cycle running, the quarter stands in.
  const shown: Span = cycle ? span : "quarter";

  useEffect(() => {
    if (!cycle) return;
    goalsApi
      .getExecution({ cycleId: cycle.id })
      .then(setExecution)
      .catch(() => setExecution(undefined));
  }, [cycle?.id]);

  if (failed && !data) {
    return (
      <section>
        <h2 className={styles.title}>Goals</h2>
        <div className={styles.state}>
          Your goals could not be loaded.
          <Button size={"small"} onClick={() => void load()}>
            Retry
          </Button>
        </div>
      </section>
    );
  }
  if (!data) {
    return (
      <section>
        <h2 className={styles.title}>Goals</h2>
        <Skeleton active={true} paragraph={{ rows: 4 }} title={false} />
      </section>
    );
  }

  const today = data.today.date;
  const inSpan = (goal: Goal) =>
    shown === "cycle"
      ? inHorizon(goal, "cycle", today, cycle)
      : inHorizon(goal, "quarter", today);
  const rows = (key: Exclude<TabKey, "habit">) =>
    homeGoalRows(data.goals, key, inSpan, data.today);
  const habitsDone = data.today.done.filter((g) => g.type === "habit").length;
  const spanName =
    shown === "cycle" && cycle
      ? cycle.name
      : `Q${DateTime.fromISO(today).quarter}`;

  const count = (key: TabKey) =>
    key === "habit" ? data.today.habits.length + habitsDone : rows(key).length;

  const act = async (goalId: string, work: () => Promise<unknown>) => {
    setBusy(goalId);
    try {
      await work();
      await load();
    } catch (error) {
      message.error(apiProblems(error).join("; "));
    } finally {
      setBusy(undefined);
    }
  };

  const setAGoal = (noun: string) => (
    <div className={styles.state}>
      No active {noun} in {spanName}.
      <Button
        type={"primary"}
        size={"small"}
        icon={<PlusOutlined />}
        onClick={() => void router.push("/minerva/goals")}
      >
        Set a goal
      </Button>
    </div>
  );

  const lead = (left: number, done: number, goals: Goal[]) => {
    const healths = (["on_track", "at_risk", "off_track"] as const)
      .map((h) => [h, goals.filter((g) => g.health === h).length] as const)
      .filter(([, n]) => n > 0);
    return (
      <div className={styles.lead}>
        <span>
          {DateTime.fromISO(today).toFormat("ccc LLL d")} · {left} left today
          {done > 0 ? `, ${done} done` : ""}
        </span>
        <span className={styles.healths}>
          {healths.map(([h, n]) => (
            <span
              key={h}
              className={styles.health}
              aria-label={`${n} ${h.replace("_", " ")}`}
            >
              <HealthDot health={h} />
              {n}
            </span>
          ))}
        </span>
      </div>
    );
  };

  const body = (key: TabKey) => {
    const meta = TABS.find((t) => t.key === key)!;
    if (key === "habit") {
      if (data.today.active.habit === 0) return setAGoal(meta.noun);
      return (
        <>
          {lead(data.today.habits.length, habitsDone, [
            ...data.today.habits.map((h) => h.goal),
            ...data.today.done.filter((g) => g.type === "habit"),
          ])}
          <TodaysHabits key={habitsVersion} onLogged={() => void load()} />
        </>
      );
    }
    const list = rows(key);
    if (list.length === 0) return setAGoal(meta.noun);
    const done = list.filter((r) => r.doneToday).length;
    return (
      <>
        {lead(
          list.length - done,
          done,
          list.map((r) => r.goal),
        )}
        {list.map((row) => (
          <GoalRow
            key={row.goal.id}
            row={row}
            today={today}
            busy={busy === row.goal.id}
            onDone={() =>
              void act(row.goal.id, () =>
                goalsApi.updateMilestone(row.goal.id, row.milestone!.id, {
                  done: true,
                }),
              )
            }
            onCheckIn={() => setCheckingIn(row.goal)}
          />
        ))}
      </>
    );
  };

  const items: TabsProps["items"] = TABS.map((t) => ({
    key: t.key,
    label: (
      <span>
        {t.label}
        <Badge
          count={count(t.key)}
          showZero={true}
          size={"small"}
          color={t.key === tab ? "#e6f4ff" : "#f0f0f0"}
          style={{
            marginLeft: 6,
            color: t.key === tab ? "#0958d9" : "#595959",
          }}
        />
      </span>
    ),
    children: body(t.key),
  }));

  const where =
    shown === "cycle" && cycle
      ? [
          cycle.name,
          cycle.currentWeek !== undefined
            ? `week ${cycle.currentWeek} of ${cycle.weeks}`
            : cycle.status === "buffer"
              ? "buffer week"
              : "starts " + DateTime.fromISO(cycle.startDate).toFormat("LLL d"),
          ...(execution?.score !== undefined
            ? [`execution ${formatValue(execution.score)}%`]
            : []),
        ].join(" · ")
      : quarterWeekText(today);

  return (
    <section aria-label={"Goals"}>
      <div className={styles.header}>
        <span style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <h2 className={styles.title}>Goals</h2>
          <span className={styles.muted}>{where}</span>
        </span>
        <Link href={"/minerva/goals?view=focus"} className={styles.muted}>
          Open Goals
        </Link>
      </div>
      {!cycle && (
        <div className={styles.noCycle}>
          <span>No cycle running; showing this quarter.</span>
          <Link href={"/minerva/goals?view=focus"}>Plan a cycle</Link>
        </div>
      )}
      <Tabs
        id={"minerva-home-goals"}
        className={styles.tabs}
        activeKey={tab}
        items={items}
        onChange={(key) => {
          setTab(key as TabKey);
          storeToLocalStorage(TAB_KEY, key);
        }}
        tabBarExtraContent={{
          right: (
            <Segmented<Span>
              size={"small"}
              value={shown}
              options={[
                { label: "Cycle", value: "cycle", disabled: !cycle },
                { label: "Quarter", value: "quarter" },
              ]}
              onChange={(next) => {
                setSpan(next);
                storeToLocalStorage(SPAN_KEY, next);
              }}
            />
          ),
        }}
        destroyOnHidden={true}
      />
      <CheckinModal
        goal={checkingIn}
        onClose={() => setCheckingIn(undefined)}
        onSaved={() => {
          setCheckingIn(undefined);
          setHabitsVersion((v) => v + 1);
          void load();
        }}
      />
    </section>
  );
};

/** A milestone, outcome or achievement goal on its tab. */
const GoalRow = ({
  row,
  today,
  busy,
  onDone,
  onCheckIn,
}: {
  row: HomeGoalRow;
  today: string;
  busy: boolean;
  onDone: () => void;
  onCheckIn: () => void;
}) => {
  const { goal, milestone, doneToday } = row;
  const due = milestone ? milestoneDueText(milestone, today) : undefined;
  return (
    <div className={styles.row}>
      <span className={styles.dot}>
        {goal.health && <HealthDot health={goal.health} />}
      </span>
      <span className={styles.text}>
        <Link href={`/minerva/goals/${goal.id}`} className={styles.name}>
          {goal.title}
        </Link>
        <PaceBar goal={goal} width={"60%"} style={{ height: 4 }} />
        <span className={styles.sub}>
          {milestone ? (
            <>
              Next: {milestone.title}
              {due?.text && (
                <>
                  {" · "}
                  <span className={due.late ? styles.late : undefined}>
                    {due.text}
                  </span>
                </>
              )}
            </>
          ) : (
            `${metricText(goal)} · ${dueText(goal, today)}`
          )}
        </span>
      </span>
      {doneToday ? (
        <span
          className={styles.doneToday}
          style={{ color: HEALTH_COLORS.on_track.text }}
        >
          <CheckCircleOutlined />
          {goal.type === "milestone" ? "Done today" : "Checked in today"}
        </span>
      ) : milestone ? (
        <Button
          size={"small"}
          icon={<CheckSquareOutlined />}
          loading={busy}
          aria-label={`Mark ${milestone.title} done`}
          onClick={onDone}
        >
          Done
        </Button>
      ) : (
        <Button
          size={"small"}
          icon={<CheckCircleOutlined />}
          aria-label={`Check in on ${goal.title}`}
          onClick={onCheckIn}
        >
          Check in
        </Button>
      )}
    </div>
  );
};

export default GoalsPanel;
