import { Card, Splitter, Statistic } from "antd";
import { DateTime } from "luxon";
import React from "react";
import { config } from "../../../utils/notes";
import {
  busyMinutes,
  dayBarBlocks,
  doneOfPlanned,
  formatMinutes,
  itemsOf,
  meetingSpans,
  noteTypeCounts,
  openCount,
} from "../../../utils/reviews";
import DayBar from "./DayBar";
import DayCalendar from "./DayCalendar";
import NoteList from "./NoteList";
import styles from "./Review.module.css";
import TriageList from "./TriageList";
import type { DailyReviewData } from "./useDailyReview";
import WeekPlanCard from "./WeekPlanCard";

export interface LookBackStepProps {
  data: DailyReviewData;
  /** What the step asks, above its content. */
  intro: string;
  /** Back, Save and exit, Next: kept at the foot of the left column. */
  footer: React.ReactNode;
}

/**
 * Step 1: the day as it happened, and a decision on everything planned
 * for it. The page's full width, split: the day in numbers and its plan on
 * the left over a footer that stays put; on the right its notes, which
 * scroll under their heading, beside its calendar at full height.
 */
const LookBackStep: React.FunctionComponent<LookBackStepProps> = ({
  data,
  intro,
  footer,
}) => {
  const date = DateTime.fromISO(data.day);
  const spans = meetingSpans(data.meetings, date);
  const planned = itemsOf(data.items, data.day);
  const { done, planned: kept } = doneOfPlanned(data.items, data.day);
  const left = openCount(data.items, data.day);
  const types = [...noteTypeCounts(data.notes)]
    .filter(([type]) => type !== 0)
    .map(
      ([type, count]) =>
        `${count} ${(config[type] ?? config[0]).label.toLowerCase()}`,
    )
    .join(" · ");

  return (
    <Splitter className={styles.fill}>
      <Splitter.Panel defaultSize={"55%"} min={"35%"} max={"75%"}>
        <div className={styles.column}>
          <div className={styles.columnScroll}>
            <p className={styles.intro}>{intro}</p>
            {data.week && <WeekPlanCard week={data.week} />}
            <Card
              size={"small"}
              variant={"borderless"}
              className={styles.flat}
              classNames={{ header: styles.flatPart, body: styles.flatPart }}
              title={"Today in numbers"}
            >
              <div className={styles.stack}>
                <div className={styles.numbers}>
                  <Statistic
                    title={`in meetings · ${spans.length} event${spans.length === 1 ? "" : "s"}`}
                    value={formatMinutes(busyMinutes(spans))}
                  />
                  <div>
                    <Statistic title={"notes"} value={data.notes.length} />
                    {types && <span className={styles.meta}>{types}</span>}
                  </div>
                  <Statistic
                    title={"planned items done"}
                    value={kept ? `${done} / ${kept}` : "–"}
                  />
                </div>
                <DayBar blocks={dayBarBlocks(spans)} />
              </div>
            </Card>
            <Card
              size={"small"}
              variant={"borderless"}
              className={styles.flat}
              classNames={{ header: styles.flatPart, body: styles.flatPart }}
              title={"Today's plan"}
              extra={
                <span className={styles.meta}>
                  {left
                    ? `${left} left open`
                    : planned.length
                      ? "All decided"
                      : ""}
                </span>
              }
            >
              <TriageList
                items={planned}
                disabled={!data.started}
                onDecide={data.triage}
              />
            </Card>
          </div>
          <div className={styles.columnFooter}>{footer}</div>
        </div>
      </Splitter.Panel>
      <Splitter.Panel min={"25%"}>
        <div className={styles.sidePanes}>
          <section className={styles.notesPane} aria-label={"Notes"}>
            <div className={styles.paneHeader}>
              <span>Notes</span>
              <span className={styles.meta}>{data.notes.length}</span>
            </div>
            <div className={styles.paneScroll}>
              <NoteList notes={data.notes} />
            </div>
          </section>
          <section className={styles.calendarPane} aria-label={"Calendar"}>
            <div className={styles.paneHeader}>
              <span>Calendar</span>
              <span className={styles.meta}>
                {formatMinutes(busyMinutes(spans))}
              </span>
            </div>
            <div className={styles.calendarFill}>
              <DayCalendar day={data.day} meetings={data.meetings} />
            </div>
          </section>
        </div>
      </Splitter.Panel>
    </Splitter>
  );
};

export default LookBackStep;
