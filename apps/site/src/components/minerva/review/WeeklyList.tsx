import type { ReviewPeriodSummary } from "@ncfritz/olympus-sdk/minerva";
import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import { Button, Collapse, Skeleton, Statistic, Tag } from "antd";
import { DateTime } from "luxon";
import Link from "next/link";
import { useRouter } from "next/router";
import React, { useState } from "react";
import {
  answeredPrompts,
  dailyListPath,
  daysOfWeek,
  formatMinutes,
  itemsOf,
  meetingMinutesByDay,
  RATING_FIELDS,
  ratingColor,
  type WeekTriage,
  weekTriageOf,
  weeklyListPath,
  weeklyReviewPath,
  weeksOfMonth,
} from "../../../utils/reviews";
import AnswerBody from "./AnswerBody";
import ListPage from "./ListPage";
import styles from "./Lists.module.css";
import MonthCalendar from "./MonthCalendar";
import { pinnedHighlights } from "./pinned";
import PinnedList from "./PinnedList";
import RatingDots from "./RatingDots";
import ReviewBreadcrumbs from "./ReviewBreadcrumbs";
import TriageList from "./TriageList";
import {
  useWeeklyList,
  useYearWeeks,
  type WeeklyListData,
} from "./useWeeklyList";

const STATUS: Record<
  ReviewPeriodSummary["status"],
  { label: string; color?: string }
> = {
  complete: { label: "Complete", color: "green" },
  draft: { label: "Draft", color: "orange" },
  missed: { label: "No review", color: "red" },
  open: { label: "This week", color: "blue" },
  upcoming: { label: "Upcoming" },
};

const DECISIONS: { label: string; value: WeekTriage }[] = [
  { label: "Done", value: "done" },
  { label: "Next week", value: "next" },
  { label: "Someday", value: "later" },
  { label: "Drop", value: "drop" },
];

const noop = async () => undefined;

export interface WeeklyListProps {
  /** The month listed, by its first day. */
  month: DateTime;
}

/** A week's numbers, worked out from the month's data. */
const weekFacts = (data: WeeklyListData, monday: DateTime) => {
  const days = daysOfWeek(monday);
  const isos = new Set(days.map((d) => d.toISODate()!));
  const dayPeriods = (data.days?.periods ?? []).filter((p) =>
    isos.has(p.periodStart),
  );
  const past = dayPeriods.filter((p) => p.status !== "upcoming");
  const reviewed = past.filter((p) => p.status === "complete");
  const overall = reviewed
    .map((p) => p.ratings.overall)
    .filter((r): r is number => r !== undefined && r !== null);
  const minutes = [...meetingMinutesByDay(data.meetings, days).values()].reduce(
    (a, b) => a + b,
    0,
  );
  const notes = data.notes.filter((n) =>
    isos.has(DateTime.fromISO(n.createdTime).toISODate()!),
  );
  const priorities = itemsOf(data.items, monday.toISODate()!, "priority");
  return {
    dayPeriods,
    past: past.length,
    reviewed: reviewed.length,
    dailyAverage: overall.length
      ? overall.reduce((a, b) => a + b, 0) / overall.length
      : undefined,
    minutes,
    notes: notes.length,
    flagged: notes.filter((n) => n.flagged).length,
    priorities,
    prioritiesDone: priorities.filter((p) => p.status === "done").length,
  };
};

/**
 * A month's weekly reviews (design.md, Lists): the weeks whose Thursday
 * falls in it, newest first, under the month's numbers, each row opening
 * in place, one at a time; a year grid and the month's calendar in the
 * sider pick the month.
 */
const WeeklyList: React.FunctionComponent<WeeklyListProps> = ({ month }) => {
  const data = useWeeklyList(month);
  const periods = [...(data.summary?.periods ?? [])].sort((a, b) =>
    b.periodStart.localeCompare(a.periodStart),
  );
  const past = periods.filter((p) => p.status !== "upcoming");
  const reviewed = past.filter((p) => p.status === "complete").length;
  const facts = data.weeks.map((w) => weekFacts(data, w));
  const minutes = facts.reduce((sum, f) => sum + f.minutes, 0);
  const priorities = facts.reduce((sum, f) => sum + f.priorities.length, 0);
  const done = facts.reduce((sum, f) => sum + f.prioritiesDone, 0);
  const averages = data.summary?.averages ?? {};
  const first = data.weeks[0];
  const last = data.weeks[data.weeks.length - 1];

  return (
    <ListPage
      breadcrumbs={
        <ReviewBreadcrumbs
          what={"Weekly review"}
          label={month.toFormat("LLLL yyyy")}
        />
      }
      title={month.toFormat("LLLL yyyy")}
      subtitle={`Weeks ${first.toFormat("W")} – ${last.toFormat("W")}`}
      actions={
        <Link href={weeklyReviewPath(DateTime.now())}>
          <Button type={"primary"}>This week&apos;s review</Button>
        </Link>
      }
      summary={
        <>
          <Statistic
            title={"weeks reviewed"}
            value={data.summary ? `${reviewed} of ${past.length}` : "–"}
          />
          <Statistic
            title={"overall avg"}
            value={averages.overall?.toFixed(1) ?? "–"}
          />
          <Statistic
            title={"balance avg"}
            value={averages.balance?.toFixed(1) ?? "–"}
          />
          <Statistic title={"meetings"} value={formatMinutes(minutes)} />
          <Statistic
            title={"priorities done"}
            value={priorities ? `${done} of ${priorities}` : "–"}
          />
        </>
      }
      sider={<WeeklySider month={month} />}
    >
      {data.loading && !data.summary ? (
        <Skeleton active={true} />
      ) : (
        <Collapse
          accordion={true}
          ghost={true}
          className={styles.rows}
          items={periods.map((period) => {
            const monday = DateTime.fromISO(period.periodStart);
            const f = weekFacts(data, monday);
            return {
              key: period.periodStart,
              collapsible:
                period.status === "upcoming" ? "disabled" : undefined,
              label: <WeekRowHead period={period} facts={f} />,
              children: <WeekRowBody period={period} data={data} facts={f} />,
            };
          })}
        />
      )}
    </ListPage>
  );
};

type Facts = ReturnType<typeof weekFacts>;

/** A week's row, closed: its dates, status, ratings, days, headline, numbers. */
const WeekRowHead = ({
  period,
  facts,
}: {
  period: ReviewPeriodSummary;
  facts: Facts;
}) => {
  const monday = DateTime.fromISO(period.periodStart);
  const status = STATUS[period.status];
  return (
    <div className={styles.rowHead}>
      <span className={styles.when}>
        <span className={styles.whenName}>Week {monday.toFormat("W")}</span>
        <span className={styles.meta}>
          {monday.toFormat("LLL d")} –{" "}
          {monday.plus({ days: 6 }).toFormat("LLL d")}
        </span>
      </span>
      <span className={styles.status}>
        <Tag color={status.color}>{status.label}</Tag>
      </span>
      <span className={styles.ratings}>
        {RATING_FIELDS.weekly.map((field) => (
          <RatingDots
            key={field.key}
            label={field.label}
            value={period.ratings[field.key] ?? undefined}
          />
        ))}
        <span className={styles.weekDots}>
          <span className={styles.ratingName}>Days M–S</span>
          <span className={styles.weekDotRow}>
            {daysOfWeek(monday).map((day) => {
              const p = facts.dayPeriods.find(
                (d) => d.periodStart === day.toISODate(),
              );
              const color =
                p?.status === "complete"
                  ? ratingColor(p.ratings.overall ?? undefined)
                  : undefined;
              return (
                <span
                  key={day.toISODate()}
                  className={styles.legendDot}
                  title={`${day.toFormat("cccc")}: ${
                    p?.status === "complete"
                      ? `overall ${p.ratings.overall ?? "–"}`
                      : (p?.status ?? "upcoming")
                  }`}
                  style={
                    color
                      ? { background: color }
                      : { border: "1px solid #bfbfbf" }
                  }
                />
              );
            })}
          </span>
        </span>
      </span>
      <span className={styles.headline}>
        {period.headline ??
          (period.status === "missed" ? (
            <span className={styles.meta}>No weekly review</span>
          ) : null)}
      </span>
      <span className={styles.facts}>
        <Fact value={formatMinutes(facts.minutes)} label={"meetings"} />
        <Fact value={`${facts.reviewed}/${facts.past}`} label={"days"} />
        <Fact
          value={
            facts.priorities.length
              ? `${facts.prioritiesDone}/${facts.priorities.length}`
              : "–"
          }
          label={"priorities"}
        />
      </span>
    </div>
  );
};

const Fact = ({ value, label }: { value: string; label: string }) => (
  <span className={styles.fact}>
    <span className={styles.factValue}>{value}</span>
    <span className={styles.meta}>{label}</span>
  </span>
);

/**
 * A week's row, open: its numbers, reflection, pinned highlights, and its
 * priorities against what became of them, with links to the review and the
 * week's daily list. A draft offers Continue review; a missed week, Write
 * weekly review.
 */
const WeekRowBody = ({
  period,
  data,
  facts,
}: {
  period: ReviewPeriodSummary;
  data: WeeklyListData;
  facts: Facts;
}) => {
  const monday = DateTime.fromISO(period.periodStart);
  const review = data.reviews.find((r) => r.periodStart === period.periodStart);
  const reflection = answeredPrompts(
    data.prompts,
    review?.answers ?? [],
    "reflect",
  );
  const highlights = review
    ? pinnedHighlights({
        pins: data.pins.get(review.id) ?? [],
        dailyReviews: data.dailyReviews,
        dailyPrompts: data.dailyPrompts,
        notes: data.notes,
      })
    : [];

  const links = (
    <div className={styles.links}>
      <Link href={weeklyReviewPath(monday)}>
        <Button type={"primary"}>
          {period.status === "complete"
            ? "Open weekly review"
            : period.status === "draft"
              ? "Continue review"
              : "Write weekly review"}
        </Button>
      </Link>
      <Link href={dailyListPath(monday)}>
        <Button>Open daily list for week {monday.toFormat("W")}</Button>
      </Link>
    </div>
  );

  const numbers = (
    <section className={styles.part} aria-label={"Numbers"}>
      <h4 className={styles.partTitle}>Numbers</h4>
      <div className={styles.siderStats}>
        <Statistic title={"meetings"} value={formatMinutes(facts.minutes)} />
        <Statistic
          title={"notes"}
          value={facts.notes}
          suffix={
            facts.flagged ? (
              <span className={styles.meta}>{facts.flagged} flagged</span>
            ) : undefined
          }
        />
        <Statistic
          title={"daily overall avg"}
          value={facts.dailyAverage?.toFixed(1) ?? "–"}
        />
      </div>
    </section>
  );

  if (!review) {
    return (
      <div className={styles.rowBody}>
        <span className={styles.missing}>
          {facts.reviewed === facts.past && facts.past > 0
            ? "No weekly review. All the days were reviewed, so the week can still be written up from them."
            : `No weekly review. ${facts.reviewed} of ${facts.past} days were reviewed.`}
        </span>
        <div className={styles.parts}>{numbers}</div>
        {links}
      </div>
    );
  }

  return (
    <div className={styles.rowBody}>
      <div className={styles.parts}>
        {numbers}
        <section className={styles.part} aria-label={"Reflection"}>
          <h4 className={styles.partTitle}>Reflection</h4>
          {reflection.length === 0 ? (
            <span className={styles.meta}>Nothing written</span>
          ) : (
            reflection.map(({ prompt, answers }) => (
              <div key={prompt.id}>
                <div className={styles.answerLabel}>{prompt.label}</div>
                <AnswerBody prompt={prompt} answers={answers} />
              </div>
            ))
          )}
        </section>
        <section className={styles.part} aria-label={"Pinned highlights"}>
          <h4 className={styles.partTitle}>Pinned highlights</h4>
          <PinnedList highlights={highlights} />
        </section>
        <section className={styles.part} aria-label={"Priorities"}>
          <h4 className={styles.partTitle}>Priorities</h4>
          <TriageList
            items={facts.priorities}
            readOnly={true}
            decisions={DECISIONS}
            decisionOf={weekTriageOf}
            onDecide={noop}
            empty={"No priorities were planned"}
          />
        </section>
      </div>
      {links}
    </div>
  );
};

/**
 * The weekly list's sider: the year as a grid of months, each with its
 * weeks reviewed, picking the month; then that month's calendar with its
 * weeks marked, each number opening that week's review.
 */
const WeeklySider = ({ month }: { month: DateTime }) => {
  const router = useRouter();
  const [year, setYear] = useState(month.year);
  const months = Array.from({ length: 12 }, (_, i) =>
    DateTime.fromObject({ year, month: i + 1, day: 1 }),
  );
  const weeksBy = months.map((m) => weeksOfMonth(m));
  const summary = useYearWeeks(
    year,
    weeksBy[0][0],
    weeksBy[11][weeksBy[11].length - 1],
  );
  const statusOf = new Map(
    (summary?.periods ?? []).map((p) => [p.periodStart, p.status]),
  );
  const listed = new Set(weeksOfMonth(month).map((m) => m.toISODate()));
  const today = DateTime.now();

  return (
    <>
      <div className={styles.yearHead}>
        <Button
          type={"text"}
          size={"small"}
          icon={<LeftOutlined />}
          aria-label={"The year before"}
          onClick={() => setYear(year - 1)}
        />
        <span>{year}</span>
        <Button
          type={"text"}
          size={"small"}
          icon={<RightOutlined />}
          aria-label={"The year after"}
          onClick={() => setYear(year + 1)}
        />
      </div>
      <div className={styles.year}>
        {months.map((m, i) => {
          const weeks = weeksBy[i];
          const started = weeks.filter((w) => w <= today);
          const reviewed = weeks.filter(
            (w) => statusOf.get(w.toISODate()!) === "complete",
          ).length;
          const chosen = m.year === month.year && m.month === month.month;
          return (
            <Link
              key={m.month}
              href={weeklyListPath(m)}
              className={`${styles.monthCell} ${chosen ? styles.monthChosen : ""}`}
              aria-current={chosen ? "page" : undefined}
            >
              <span>{m.toFormat("LLL")}</span>
              <span className={styles.monthCount}>
                {started.length ? `${reviewed}/${weeks.length}` : " "}
              </span>
            </Link>
          );
        })}
      </div>
      <span className={styles.meta}>
        Pick a month to list its weeks. Counts are weeks reviewed.
      </span>
      <MonthCalendar
        month={month}
        onMonth={(m) => void router.push(weeklyListPath(m))}
        weekHref={(m) => weeklyReviewPath(m)}
        marked={(m) => listed.has(m.toISODate())}
      />
      <span className={styles.meta}>
        A week belongs to the month its Thursday falls in, so a week spanning
        two months lists under one of them.
      </span>
    </>
  );
};

export default WeeklyList;
