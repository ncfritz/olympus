import {
  CheckCircleOutlined,
  CheckOutlined,
  CheckSquareOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import type {
  Goal,
  GoalHabitDay,
  GoalNextStep,
  GoalTypeCounts,
  ListGoalsForTodayResponse,
} from "@ncfritz/olympus-sdk/minerva";
import { Badge, Button, message, Skeleton, Tabs, type TabsProps } from "antd";
import { DateTime } from "luxon";
import Link from "next/link";
import { useRouter } from "next/router";
import React, { useCallback, useEffect, useState } from "react";
import goalsApi from "../../../api/goalsApi";
import { useAuth } from "../../../auth/AuthProvider";
import {
  apiProblems,
  dueText,
  habitCountPercent,
  habitTap,
  habitTodayText,
  metricText,
  milestoneDueText,
} from "../../../utils/goals";
import {
  loadFromLocalStorage,
  storeToLocalStorage,
} from "../../../utils/storage";
import { HealthDot } from "../../minerva/goals/GoalBits";
import CheckinModal from "../../minerva/goals/CheckinModal";
import styles from "./GoalsWidget.module.css";

type TabKey = keyof GoalTypeCounts;

const TABS: { key: TabKey; label: string; noun: string; lead: string }[] = [
  { key: "habit", label: "Habits", noun: "habits", lead: "left to do today" },
  {
    key: "milestone",
    label: "Milestones",
    noun: "milestone goals",
    lead: "the next step on each",
  },
  {
    key: "outcome",
    label: "Outcomes",
    noun: "outcome goals",
    lead: "not checked in on today",
  },
  {
    key: "achievement",
    label: "Achievements",
    noun: "achievements",
    lead: "not checked in on today",
  },
];

const TAB_KEY = "goals.widget.tab";
/** Rows shown in a tab; the rest are a link away, in Focus. */
const LIMIT = 10;
/** Reloads now and then, so the list rolls over at midnight. */
const RELOAD_MS = 15 * 60 * 1000;
const FOCUS = "/minerva/goals?view=focus";

/**
 * The home page's goals: what is left to do today, a tab per goal type
 * (habits, milestones, outcomes, achievements), ten in each. A goal met,
 * ticked or checked in on today leaves its tab; each row acts in place.
 */
const GoalsWidget: React.FunctionComponent = () => {
  const auth = useAuth();
  if (auth.status !== "signed-in") {
    return (
      <Frame
        body={() =>
          auth.status === "loading" ? (
            <Loading />
          ) : (
            <div className={styles.state}>Sign in to see your goals.</div>
          )
        }
      />
    );
  }
  return <SignedInGoals />;
};

const SignedInGoals = () => {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("habit");
  // Read after mounting: the server render has no local storage.
  useEffect(() => {
    const stored = loadFromLocalStorage<unknown>(TAB_KEY, "habit");
    if (TABS.some((t) => t.key === stored)) setTab(stored as TabKey);
  }, []);
  const choose = (next: TabKey) => {
    setTab(next);
    storeToLocalStorage(TAB_KEY, next);
  };

  const [data, setData] = useState<ListGoalsForTodayResponse>();
  const [failed, setFailed] = useState(false);
  const [checkingIn, setCheckingIn] = useState<Goal>();
  const [busy, setBusy] = useState<string>();

  const load = useCallback(async () => {
    try {
      setData(await goalsApi.listGoalsForToday());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), RELOAD_MS);
    return () => clearInterval(timer);
  }, [load]);

  /** Runs a row's action, then reloads: a row met today leaves its tab. */
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

  const logHabit = (habit: GoalHabitDay) => {
    const tap = habitTap(habit);
    return act(habit.goal.id, () =>
      tap.action === "log"
        ? goalsApi.logHabit(habit.goal.id, "today", tap.log)
        : goalsApi.deleteHabitLog(habit.goal.id, "today"),
    );
  };

  const tickStep = (step: GoalNextStep) =>
    act(step.goal.id, () =>
      goalsApi.updateMilestone(step.goal.id, step.milestone!.id, {
        done: true,
      }),
    );

  const left = (key: TabKey): number | undefined => {
    if (!data) return undefined;
    return {
      habit: data.habits.length,
      milestone: data.milestones.length,
      outcome: data.outcomes.length,
      achievement: data.achievements.length,
    }[key];
  };

  const body = (key: TabKey) => {
    const meta = TABS.find((t) => t.key === key)!;
    if (failed && !data) {
      return (
        <div className={styles.state}>
          Your goals could not be loaded.
          <Button size={"small"} onClick={() => void load()}>
            Retry
          </Button>
        </div>
      );
    }
    if (!data) return <Loading />;
    if (data.active[key] === 0) {
      return (
        <div className={styles.state}>
          No active {meta.noun} yet.
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
    }
    const doneHere = data.done.filter((g) => g.type === key);
    const rows = rowsFor(key);
    if (rows.length === 0) {
      return (
        <div className={styles.state}>
          <span className={styles.doneMark}>
            <CheckOutlined />
          </span>
          <span className={styles.stateTitle}>Nothing left for today</span>
          {doneHere.length > 0 && <span>{doneHere.length} done today.</span>}
        </div>
      );
    }
    const more = rows.length - LIMIT;
    return (
      <>
        <div className={styles.lead}>
          <span>
            {DateTime.fromISO(data.date).toFormat("ccc LLL d")} · {meta.lead}
          </span>
          <Link href={FOCUS}>Focus</Link>
        </div>
        {rows.slice(0, LIMIT)}
        {more > 0 && (
          <div className={styles.foot}>
            <Link href={FOCUS}>
              {more} more {meta.noun} left today in Focus
            </Link>
          </div>
        )}
        {key === "habit" && doneHere.length > 0 && (
          <div className={styles.foot}>
            <CheckCircleOutlined style={{ color: "#237804" }} />
            {doneWords(doneHere)}
          </div>
        )}
      </>
    );
  };

  const rowsFor = (key: TabKey): React.ReactNode[] => {
    if (!data) return [];
    switch (key) {
      case "habit":
        return data.habits.map((h) => {
          const percent = habitCountPercent(h);
          return (
            <div key={h.goal.id} className={styles.row}>
              <span className={styles.text}>
                <GoalName goal={h.goal} />
                <span className={styles.sub}>{habitTodayText(h)}</span>
              </span>
              <Button
                shape={"circle"}
                icon={<CheckOutlined />}
                loading={busy === h.goal.id}
                aria-label={
                  h.habitRule.quantityTarget !== undefined
                    ? `Add one to ${h.goal.title}`
                    : `Log ${h.goal.title}`
                }
                onClick={() => void logHabit(h)}
                style={{ color: "#6b6b6b" }}
              />
              {percent !== undefined && (
                <span className={styles.count} aria-hidden={true}>
                  <span
                    className={styles.countFill}
                    style={{ width: `${percent}%` }}
                  />
                </span>
              )}
            </div>
          );
        });
      case "milestone":
        return data.milestones.map((step) => {
          const due = step.milestone
            ? milestoneDueText(step.milestone, data.date)
            : undefined;
          return (
            <div key={step.goal.id} className={styles.row}>
              <Dot goal={step.goal} />
              <span className={styles.text}>
                <GoalName goal={step.goal} />
                <span className={styles.sub}>
                  {step.milestone ? (
                    <>
                      Next: {step.milestone.title}
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
                    `${metricText(step.goal)} · ${dueText(step.goal, data.date)}`
                  )}
                </span>
              </span>
              {step.milestone ? (
                <Button
                  size={"small"}
                  icon={<CheckSquareOutlined />}
                  loading={busy === step.goal.id}
                  aria-label={`Mark ${step.milestone.title} done`}
                  onClick={() => void tickStep(step)}
                >
                  Done
                </Button>
              ) : (
                <CheckInButton
                  goal={step.goal}
                  onClick={() => setCheckingIn(step.goal)}
                />
              )}
            </div>
          );
        });
      case "outcome":
      case "achievement":
        return (key === "outcome" ? data.outcomes : data.achievements).map(
          (goal) => (
            <div key={goal.id} className={styles.row}>
              <Dot goal={goal} />
              <span className={styles.text}>
                <GoalName goal={goal} />
                <span className={styles.sub}>
                  {metricText(goal)} · {dueText(goal, data.date)}
                </span>
              </span>
              <CheckInButton goal={goal} onClick={() => setCheckingIn(goal)} />
            </div>
          ),
        );
    }
  };

  return (
    <>
      <Frame tab={tab} onChange={choose} count={left} body={body} />
      <CheckinModal
        goal={checkingIn}
        onClose={() => setCheckingIn(undefined)}
        onSaved={() => {
          setCheckingIn(undefined);
          void load();
        }}
      />
    </>
  );
};

/**
 * The card: the heading, then a tab per goal type on the blue rule, each
 * with how many are left today once that is known.
 */
const Frame = ({
  tab = "habit",
  onChange,
  count,
  body,
}: {
  tab?: TabKey;
  onChange?: (tab: TabKey) => void;
  count?: (tab: TabKey) => number | undefined;
  body: (tab: TabKey) => React.ReactNode;
}) => {
  const router = useRouter();
  const items: TabsProps["items"] = TABS.map((t) => {
    const n = count?.(t.key);
    return {
      key: t.key,
      label: (
        <span>
          {t.label}
          {n !== undefined && (
            <Badge
              count={n}
              showZero={true}
              size={"small"}
              color={t.key === tab ? "#e6f4ff" : "#f0f0f0"}
              style={{
                marginLeft: 6,
                color: t.key === tab ? "#0958d9" : "#595959",
              }}
            />
          )}
        </span>
      ),
      children: body(t.key),
    };
  });
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h2 className={styles.title}>Goals</h2>
        <Button
          type={"text"}
          size={"small"}
          onClick={() => void router.push("/minerva/goals")}
        >
          Go to Goals
        </Button>
      </div>
      <Tabs
        id={"goals"}
        className={styles.tabs}
        activeKey={tab}
        items={items}
        onChange={(key) => onChange?.(key as TabKey)}
        destroyOnHidden={true}
      />
    </div>
  );
};

const Loading = () => (
  <div className={styles.skeleton}>
    <Skeleton active={true} paragraph={{ rows: 3 }} title={false} />
  </div>
);

const GoalName = ({ goal }: { goal: Goal }) => (
  <Link href={`/minerva/goals/${goal.id}`} className={styles.name}>
    {goal.title}
  </Link>
);

const Dot = ({ goal }: { goal: Goal }) => (
  <span className={styles.dot}>
    {goal.health && <HealthDot health={goal.health} />}
  </span>
);

const CheckInButton = ({
  goal,
  onClick,
}: {
  goal: Goal;
  onClick: () => void;
}) => (
  <Button
    size={"small"}
    icon={<CheckCircleOutlined />}
    aria-label={`Check in on ${goal.title}`}
    onClick={onClick}
  >
    Check in
  </Button>
);

/** "Read and Stretch are done for today", naming two at most. */
const doneWords = (goals: Goal[]): string => {
  const names = goals.map((g) => g.title);
  if (names.length === 1) return `${names[0]} is done for today`;
  if (names.length === 2)
    return `${names[0]} and ${names[1]} are done for today`;
  return `${names[0]}, ${names[1]} and ${names.length - 2} more are done for today`;
};

export default GoalsWidget;
