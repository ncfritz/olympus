import type { ReviewPeriodSummary } from "@ncfritz/olympus-sdk/minerva";
import { Button, Collapse, Skeleton, Space, Statistic, Tag } from "antd";
import { DateTime } from "luxon";
import Link from "next/link";
import React, { useState } from "react";
import { config } from "../../../utils/notes";
import {
  answeredPrompts,
  dailyListPath,
  dailyReviewPath,
  daysOfWeek,
  doneOfPlanned,
  formatMinutes,
  itemsOf,
  longestRun,
  meetingMinutesByDay,
  meetingSpans,
  monthOfWeek,
  noteTypeCounts,
  RATING_FIELDS,
  RATING_LEGEND,
  ratingColor,
  weekStart,
  weeklyReviewPath,
} from "../../../utils/reviews";
import AnswerBody from "./AnswerBody";
import ListPage from "./ListPage";
import styles from "./Lists.module.css";
import MeetingList from "./MeetingList";
import MonthCalendar from "./MonthCalendar";
import RatingDots from "./RatingDots";
import ReviewBreadcrumbs from "./ReviewBreadcrumbs";
import TriageList from "./TriageList";
import { type DailyListData, useDailyList, useMonthDays } from "./useDailyList";

/** A day's review status, as its row and the review's title show it. */
export const DAY_STATUS: Record<
  ReviewPeriodSummary["status"],
  { label: string; color?: string }
> = {
  complete: { label: "Complete", color: "green" },
  draft: { label: "Draft", color: "orange" },
  missed: { label: "No review", color: "red" },
  open: { label: "Today", color: "blue" },
  upcoming: { label: "Upcoming" },
};

export interface DailyListProps {
  /** The week listed, by its Monday. */
  week: DateTime;
}

const noop = async () => undefined;

/**
 * A week's daily reviews (design.md, Lists): its days newest first under
 * the week's numbers, each row opening in place, one at a time, onto its
 * reflection, record and plan; a month calendar in the sider picks the week.
 */
const DailyList: React.FunctionComponent<DailyListProps> = ({ week }) => {
  const monday = weekStart(week);
  const data = useDailyList(monday);
  const days = daysOfWeek(monday);
  const periods = [...(data.summary?.periods ?? [])].sort((a, b) =>
    b.periodStart.localeCompare(a.periodStart),
  );
  const past = periods.filter((p) => p.status !== "upcoming");
  const reviewed = past.filter((p) => p.status === "complete").length;
  const minutes = meetingMinutesByDay(data.meetings, days);
  const averages = data.summary?.averages ?? {};
  const label = `Week ${monday.toFormat("W")}`;
  const dates = `${monday.toFormat("LLL d")} – ${monday.plus({ days: 6 }).toFormat(monday.month === monday.plus({ days: 6 }).month ? "d" : "LLL d")}`;

  return (
    <ListPage
      breadcrumbs={
        <ReviewBreadcrumbs
          what={"Daily review"}
          label={`Week ${monday.toFormat("W, kkkk")}`}
        />
      }
      title={label}
      subtitle={dates}
      actions={
        <Space>
          <Link href={weeklyReviewPath(monday)}>
            <Button>Weekly review</Button>
          </Link>
          <Link href={dailyReviewPath(DateTime.now())}>
            <Button type={"primary"}>Today&apos;s review</Button>
          </Link>
        </Space>
      }
      summary={
        <>
          <Statistic
            title={"days reviewed"}
            value={data.summary ? `${reviewed} of ${past.length}` : "–"}
          />
          <Statistic
            title={"overall avg"}
            value={averages.overall?.toFixed(1) ?? "–"}
          />
          <Statistic
            title={"focus avg"}
            value={averages.focus?.toFixed(1) ?? "–"}
          />
          <Statistic
            title={"meetings"}
            value={formatMinutes(
              [...minutes.values()].reduce((a, b) => a + b, 0),
            )}
          />
          <Statistic title={"notes"} value={data.notes.length} />
        </>
      }
      sider={<DailySider monday={monday} />}
    >
      {data.loading && !data.summary ? (
        <Skeleton active={true} />
      ) : (
        <Collapse
          accordion={true}
          ghost={true}
          className={styles.rows}
          items={periods.map((period) => ({
            key: period.periodStart,
            collapsible: period.status === "upcoming" ? "disabled" : undefined,
            label: (
              <DayRowHead
                period={period}
                data={data}
                minutes={minutes.get(period.periodStart) ?? 0}
              />
            ),
            children: (
              <DayRowBody
                period={period}
                data={data}
                minutes={minutes.get(period.periodStart) ?? 0}
              />
            ),
          }))}
        />
      )}
    </ListPage>
  );
};

/** A day's row, closed: its date, status, ratings, headline and numbers. */
const DayRowHead = ({
  period,
  data,
  minutes,
}: {
  period: ReviewPeriodSummary;
  data: DailyListData;
  minutes: number;
}) => {
  const day = DateTime.fromISO(period.periodStart);
  const status = DAY_STATUS[period.status];
  const notes = notesOn(data, period.periodStart).length;
  const { done, planned } = doneOfPlanned(data.items, period.periodStart);
  return (
    <div className={styles.rowHead}>
      <span className={styles.when}>
        <span className={styles.whenName}>{day.toFormat("cccc")}</span>
        <span className={styles.meta}>{day.toFormat("LLL d")}</span>
      </span>
      <span className={styles.status}>
        <Tag color={status.color}>{status.label}</Tag>
      </span>
      <span className={styles.ratings}>
        {RATING_FIELDS.daily.map((field) => (
          <RatingDots
            key={field.key}
            label={field.label}
            value={period.ratings[field.key] ?? undefined}
          />
        ))}
      </span>
      <span className={styles.headline}>
        {period.headline ??
          (period.status === "missed" ? (
            <span className={styles.meta}>No review written</span>
          ) : null)}
      </span>
      <span className={styles.facts}>
        <Fact value={formatMinutes(minutes)} label={"meetings"} />
        <Fact value={String(notes)} label={"notes"} />
        <Fact value={planned ? `${done}/${planned}` : "–"} label={"done"} />
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

/** The notes written on a day, by its date in the browser's zone. */
const notesOn = (data: DailyListData, day: string) =>
  data.notes.filter((n) => DateTime.fromISO(n.createdTime).toISODate() === day);

/**
 * A day's row, open: its reflection, its record (meetings, notes by type)
 * and what was planned for it, with links to the review, the day's notes
 * and Meetings. A day with no review offers to write one.
 */
const DayRowBody = ({
  period,
  data,
  minutes,
}: {
  period: ReviewPeriodSummary;
  data: DailyListData;
  minutes: number;
}) => {
  const day = DateTime.fromISO(period.periodStart);
  const review = data.reviews.find((r) => r.periodStart === period.periodStart);
  const reflection = answeredPrompts(
    data.prompts,
    review?.answers ?? [],
    "reflect",
  );
  const notes = notesOn(data, period.periodStart);
  const types = [...noteTypeCounts(notes)].sort((a, b) => b[1] - a[1]);
  const planned = itemsOf(data.items, period.periodStart);

  const reviewLink = (
    <Link href={dailyReviewPath(day)}>
      <Button type={"primary"}>
        {period.status === "complete"
          ? "Open review"
          : period.status === "draft"
            ? "Continue review"
            : period.status === "open"
              ? "Review today"
              : "Write review now"}
      </Button>
    </Link>
  );
  const links = (
    <div className={styles.links}>
      {reviewLink}
      <Link href={`/minerva/notes/${day.toFormat("yyyy/MM")}`}>
        <Button>Open notes</Button>
      </Link>
      <Link href={`/minerva/meetings/${day.toFormat("yyyy/MM/dd")}`}>
        <Button>Open in Meetings</Button>
      </Link>
    </div>
  );

  if (!review || review.answers.length + (review.overall ? 1 : 0) === 0) {
    return (
      <div className={styles.rowBody}>
        <span className={styles.missing}>
          {period.status === "missed"
            ? `No review written. ${formatMinutes(minutes)} of meetings and ${notes.length} note${notes.length === 1 ? "" : "s"} are still here; you can still write one.`
            : "Nothing written yet."}
        </span>
        {links}
      </div>
    );
  }

  return (
    <div className={styles.rowBody}>
      <div className={styles.parts}>
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
        <section className={styles.part} aria-label={"Record"}>
          <h4 className={styles.partTitle}>Record</h4>
          <MeetingList spans={meetingSpans(data.meetings, day)} limit={6} />
          {types.length > 0 && (
            <div className={styles.legend}>
              {types.map(([type, count]) => {
                const shown = config[type] ?? config[0];
                return (
                  <span key={type} className={styles.legendItem}>
                    <span
                      className={styles.legendDot}
                      style={{ background: shown.color }}
                      aria-hidden={true}
                    />
                    {shown.label} {count}
                  </span>
                );
              })}
            </div>
          )}
        </section>
        <section className={styles.part} aria-label={"Plan"}>
          <h4 className={styles.partTitle}>Planned for the day</h4>
          <TriageList
            items={planned}
            readOnly={true}
            onDecide={noop}
            empty={"Nothing was planned"}
          />
        </section>
      </div>
      {links}
    </div>
  );
};

/**
 * The daily list's sider: a month calendar, each day's dot coloured by its
 * overall rating (hollow when not reviewed), a week number picking the
 * week; the month's days reviewed, average and best streak.
 */
const DailySider = ({ monday }: { monday: DateTime }) => {
  const [month, setMonth] = useState(monthOfWeek(monday));
  const summary = useMonthDays(month);
  const byDay = new Map(
    (summary?.periods ?? []).map((p) => [p.periodStart, p]),
  );
  const inMonth = (summary?.periods ?? []).filter(
    (p) =>
      DateTime.fromISO(p.periodStart).month === month.month &&
      p.status !== "upcoming",
  );
  const complete = inMonth.filter((p) => p.status === "complete");
  const overall = complete
    .map((p) => p.ratings.overall)
    .filter((r): r is number => r !== undefined && r !== null);
  const average = overall.length
    ? (overall.reduce((a, b) => a + b, 0) / overall.length).toFixed(1)
    : "–";
  const streak = longestRun(
    inMonth.map((p) => p.periodStart),
    new Set(complete.map((p) => p.periodStart)),
  );
  const listed = monday.toISODate();

  return (
    <>
      <MonthCalendar
        month={month}
        onMonth={setMonth}
        weekHref={(m) => dailyListPath(m)}
        marked={(m) => m.toISODate() === listed}
        dot={(day) => {
          const period = byDay.get(day.toISODate()!);
          if (!period || period.status === "upcoming") return undefined;
          return {
            color:
              period.status === "complete"
                ? ratingColor(period.ratings.overall ?? undefined)
                : undefined,
          };
        }}
      />
      <div className={styles.legend}>
        <span>Overall</span>
        {RATING_LEGEND.map(({ rating, color }) => (
          <span key={rating} className={styles.legendItem}>
            <span
              className={styles.legendDot}
              style={{ background: color }}
              aria-hidden={true}
            />
            {rating}
          </span>
        ))}
        <span className={styles.legendItem}>
          <span
            className={styles.legendDot}
            style={{ border: "1px solid #bfbfbf" }}
            aria-hidden={true}
          />
          no review
        </span>
      </div>
      <span className={styles.meta}>Pick a week number to list its days.</span>
      <div className={styles.siderStats}>
        <Statistic
          title={"days reviewed"}
          value={`${complete.length} / ${inMonth.length}`}
        />
        <Statistic title={"overall avg"} value={average} />
        <Statistic title={"best streak"} value={streak} suffix={"days"} />
      </div>
    </>
  );
};

export default DailyList;
