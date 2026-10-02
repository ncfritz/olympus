import { Card, Empty, Statistic } from "antd";
import { DateTime } from "luxon";
import React from "react";
import { config } from "../../../utils/notes";
import {
  daysOfWeek,
  formatMinutes,
  itemsOf,
  noteTypeCounts,
  RATING_FIELDS,
  ratingChanges,
  ratingSeries,
  slippedItems,
  type WeekTriage,
  weekLoad,
  weekTriageOf,
} from "../../../utils/reviews";
import styles from "./Review.module.css";
import TriageList from "./TriageList";
import type { WeeklyReviewData } from "./useWeeklyReview";
import WeekDayCards from "./WeekDayCards";
import { RatingsChart, TimeChart } from "./WeekCharts";

const DECISIONS: { label: string; value: WeekTriage }[] = [
  { label: "Done", value: "done" },
  { label: "Next week", value: "next" },
  { label: "Someday", value: "later" },
  { label: "Drop", value: "drop" },
];

export interface WeekLookBackStepProps {
  data: WeeklyReviewData;
}

/**
 * Step 1: the week as it happened: its days, ratings, time and notes,
 * and a decision on what it planned and what slipped.
 */
const WeekLookBackStep: React.FunctionComponent<WeekLookBackStepProps> = ({
  data,
}) => {
  const days = daysOfWeek(DateTime.fromISO(data.monday));
  const labels = days.map((d) => d.toFormat("ccc d"));
  const periods = data.days?.periods ?? [];
  const loads = weekLoad(data.meetings, days, data.dayItems);
  const meetingMinutes = loads.reduce((sum, d) => sum + d.meetingMinutes, 0);
  const focusMinutes = loads.reduce((sum, d) => sum + d.focusMinutes, 0);
  const meetingCount = loads.reduce((sum, d) => sum + d.meetings, 0);
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

  return (
    <>
      <Card
        size={"small"}
        title={"The days"}
        extra={
          <span className={styles.meta}>
            {data.days
              ? `${periods.filter((p) => p.status === "complete").length} of ${periods.filter((p) => p.status !== "upcoming").length} reviewed`
              : ""}
          </span>
        }
      >
        <WeekDayCards
          periods={periods}
          disabled={disabled}
          onQuickScore={data.quickScore}
        />
      </Card>
      <Card size={"small"} title={"Daily ratings"}>
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
      <div className={styles.columns}>
        <Card size={"small"} title={"Time"}>
          <div className={styles.stack}>
            <div className={styles.numbers}>
              <Statistic
                title={`in meetings · ${meetingCount} event${meetingCount === 1 ? "" : "s"}`}
                value={formatMinutes(meetingMinutes)}
              />
              <Statistic
                title={"in focus blocks"}
                value={formatMinutes(focusMinutes)}
              />
            </div>
            <TimeChart days={labels} loads={loads} />
          </div>
        </Card>
        <Card size={"small"} title={"Notes"}>
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
          </div>
        </Card>
      </div>
      <Card size={"small"} title={"This week's priorities"}>
        <TriageList
          {...triage}
          items={priorities}
          empty={"No priorities were planned for this week"}
        />
      </Card>
      <Card
        size={"small"}
        title={"Slipped this week"}
        extra={
          <span className={styles.meta}>
            carried at least once, or left open
          </span>
        }
      >
        <TriageList
          {...triage}
          items={slipped}
          empty={"Nothing slipped"}
          whereOf={(item) =>
            DateTime.fromISO(item.periodStart).toFormat("cccc")
          }
        />
      </Card>
    </>
  );
};

export default WeekLookBackStep;
