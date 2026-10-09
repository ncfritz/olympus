import type { Note, ReviewItem } from "@ncfritz/olympus-sdk/minerva";
import { Card, Collapse, Empty, Statistic } from "antd";
import { CaretRightOutlined } from "@ant-design/icons";
import { DateTime } from "luxon";
import React from "react";
import { config } from "../../../utils/notes";
import {
  daysOfWeek,
  itemsOf,
  noteTypeCounts,
  RATING_FIELDS,
  ratingChanges,
  ratingSeries,
  slippedItems,
  type WeekTriage,
  weekTriageOf,
} from "../../../utils/reviews";
import DaySections, { byDay, type DaySection } from "./DaySections";
import NoteList from "./NoteList";
import styles from "./Review.module.css";
import SplitStep from "./SplitStep";
import TriageList from "./TriageList";
import type { WeeklyReviewData } from "./useWeeklyReview";
import WeekDayCards from "./WeekDayCards";
import { RatingsChart } from "./WeekCharts";
import WeekGoals from "./WeekGoals";
import WeekTime from "./WeekTime";

const DECISIONS: { label: string; value: WeekTriage }[] = [
  { label: "Done", value: "done" },
  { label: "Next week", value: "next" },
  { label: "Someday", value: "later" },
  { label: "Drop", value: "drop" },
];

const flat = {
  size: "small" as const,
  variant: "borderless" as const,
  className: styles.flat,
  classNames: { header: styles.flatPart, body: styles.flatPart },
};

export interface WeekLookBackStepProps {
  data: WeeklyReviewData;
  /** What the step asks, above its content. */
  intro: string;
  /** Back, Save and exit, Next: kept at the foot of the left column. */
  footer: React.ReactNode;
}

/**
 * Step 1: the week as it happened, split. On the left its days, each
 * scored from its card; its ratings; and a decision on what it planned
 * and what slipped, each by day. On the right its time, the goals beside
 * it, and its notes, with their timeline folded away.
 */
const WeekLookBackStep: React.FunctionComponent<WeekLookBackStepProps> = ({
  data,
  intro,
  footer,
}) => {
  const days = daysOfWeek(DateTime.fromISO(data.monday));
  const labels = days.map((d) => d.toFormat("ccc d"));
  const periods = data.days?.periods ?? [];
  const types = [...noteTypeCounts(data.notes)].sort((a, b) => b[1] - a[1]);
  const priorities = itemsOf(data.weekItems, data.monday);
  const slipped = slippedItems(data.dayItems, days[0], data.today);
  const disabled = !data.started;
  const triage = {
    decisions: DECISIONS,
    decisionOf: weekTriageOf,
    disabled,
    onDecide: data.triage,
  };
  const sectionsOf = (
    items: ReviewItem[],
    dayOf: (item: ReviewItem) => string | undefined,
    noDay: string,
  ): DaySection[] =>
    byDay(items, dayOf, noDay).map((group) => ({
      key: group.key,
      label: group.label,
      count: group.things.length,
      children: <TriageList {...triage} items={group.things} />,
    }));
  const noteDays = byDay<Note>(
    data.notes,
    (note) => DateTime.fromISO(note.createdTime).toISODate() ?? undefined,
    "",
  );

  return (
    <SplitStep
      intro={intro}
      footer={footer}
      defaultSize={"60%"}
      hideScrollbar={true}
      aside={
        <div className={`${styles.asideScroll} ${styles.noScrollbar}`}>
          <Card {...flat} title={"Time"}>
            <WeekTime data={data} />
          </Card>
          <Card {...flat} title={"Goals"}>
            <WeekGoals goals={data.goals} execution={data.execution} />
          </Card>
          <Card {...flat} title={"Notes"}>
            <div className={styles.stack}>
              <Statistic title={"notes this week"} value={data.notes.length} />
              {types.length ? (
                <div className={styles.noteTypes}>
                  {types.map(([type, count]) => {
                    const shown = config[type] ?? config[0];
                    return (
                      <span key={type} className={styles.noteType}>
                        <span
                          className={styles.dot}
                          style={{ background: shown.color }}
                          aria-hidden={true}
                        />
                        {count} {shown.label.toLowerCase()}
                      </span>
                    );
                  })}
                </div>
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={"No notes"}
                />
              )}
              {data.notes.length > 0 && (
                <Collapse
                  ghost={true}
                  size={"small"}
                  className={styles.daySections}
                  expandIcon={({ isActive }) => (
                    <CaretRightOutlined rotate={isActive ? 90 : 0} />
                  )}
                  items={[
                    {
                      key: "timeline",
                      label: (
                        <span className={styles.daySectionLabel}>Timeline</span>
                      ),
                      children: noteDays.map((day) => (
                        <div key={day.key}>
                          <h4 className={styles.timelineDay}>{day.label}</h4>
                          <NoteList notes={day.things} />
                        </div>
                      )),
                    },
                  ]}
                />
              )}
            </div>
          </Card>
        </div>
      }
    >
      <WeekDayCards
        periods={periods}
        disabled={disabled}
        onRate={data.rateDay}
      />
      <Card {...flat} title={"Daily ratings"}>
        <RatingsChart
          days={labels}
          series={ratingSeries(
            periods.map((p) => ({
              periodStart: p.periodStart,
              ratings: p.ratings,
            })),
            days.map((d) => d.toISODate()!),
            RATING_FIELDS.daily,
          )}
          changes={ratingChanges(
            data.days?.averages ?? {},
            data.days?.previousAverages ?? {},
            RATING_FIELDS.daily,
          )}
        />
      </Card>
      <Card {...flat} title={"This week's priorities"}>
        <DaySections
          empty={"No priorities were planned for this week"}
          sections={sectionsOf(
            priorities,
            (item) => item.scheduledOn,
            "Not on a day",
          )}
        />
      </Card>
      <Card
        {...flat}
        title={"Slipped this week"}
        extra={
          <span className={styles.meta}>
            carried at least once, or left open
          </span>
        }
      >
        <DaySections
          empty={"Nothing slipped"}
          sections={sectionsOf(slipped, (item) => item.periodStart, "")}
        />
      </Card>
    </SplitStep>
  );
};

export default WeekLookBackStep;
