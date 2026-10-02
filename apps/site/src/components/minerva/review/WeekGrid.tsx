import {
  type CollisionDetection,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { ReviewItem } from "@ncfritz/olympus-sdk/minerva";
import { Progress, Tag, Tooltip } from "antd";
import { DateTime } from "luxon";
import React, { useState } from "react";
import {
  blockedSpan,
  type DayLoad,
  dayBarBlocks,
  formatMinutes,
  formatSpan,
  type MeetingSpan,
  meetingSpans,
  openTime,
  placeInGap,
  type ReviewMeeting,
  weekLoad,
} from "../../../utils/reviews";
import styles from "./Review.module.css";

/** The hours the grid shows, top to bottom. */
const FROM = 8;
const TO = 18;
const UNPLACED = "unplaced";

const LEVEL_COLOR: Record<DayLoad["level"], string> = {
  light: "#52c41a",
  moderate: "#faad14",
  heavy: "#ff4d4f",
};

type Gap = { start: DateTime; end: DateTime };

export interface WeekGridProps {
  /** The days shown, Monday to Friday. */
  days: DateTime[];
  meetings: ReviewMeeting[];
  /** The week's priorities; those with a block are drawn on their day. */
  priorities: ReviewItem[];
  disabled?: boolean;
  onPlace: (
    item: ReviewItem,
    place: { day: string; start: string; end: string } | null,
  ) => Promise<void>;
}

/** Where a span sits in a day's column, in percent. */
const vertical = (spans: MeetingSpan[]) =>
  dayBarBlocks(spans, FROM, TO).map((b) => ({
    key: b.key,
    title: b.title,
    style: { top: `${b.left}%`, height: `${b.width}%` },
  }));

const gapStyle = (gap: Gap) => {
  const range = (TO - FROM) * 60;
  const minute = (t: DateTime) => (t.hour - FROM) * 60 + t.minute;
  return {
    top: `${(minute(gap.start) / range) * 100}%`,
    height: `${((minute(gap.end) - minute(gap.start)) / range) * 100}%`,
  };
};

/** A priority to drag: a chip until placed, then its block on the grid. */
const Draggable: React.FunctionComponent<{
  item: ReviewItem;
  disabled: boolean;
  className: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ item, disabled, className, style, children }) => {
  const drag = useDraggable({ id: item.id, data: { item }, disabled });
  return (
    <span
      ref={drag.setNodeRef}
      className={`${className} ${drag.isDragging ? styles.dragging : ""}`}
      style={style}
      aria-label={`Place ${item.title}`}
      {...drag.attributes}
      {...drag.listeners}
    >
      {children}
    </span>
  );
};

/** Open time a priority can be dropped on. */
const GapZone: React.FunctionComponent<{
  day: string;
  gap: Gap;
  active: boolean;
}> = ({ day, gap, active }) => {
  const drop = useDroppable({
    id: `${day}T${gap.start.toFormat("HH:mm")}`,
    data: { day, gap },
  });
  return (
    <span
      ref={drop.setNodeRef}
      className={`${styles.gap} ${active ? styles.gapActive : ""} ${drop.isOver ? styles.gapOver : ""}`}
      style={gapStyle(gap)}
      title={`Open ${formatSpan(gap.start, gap.end)}`}
    />
  );
};

/** The strip of priorities not placed yet; dropping one there unplaces it. */
const Unplaced: React.FunctionComponent<{ children: React.ReactNode }> = ({
  children,
}) => {
  const drop = useDroppable({ id: UNPLACED });
  return (
    <div
      ref={drop.setNodeRef}
      className={`${styles.chips} ${drop.isOver ? styles.gapOver : ""}`}
    >
      {children}
    </div>
  );
};

// Zones are small: the one under the pointer, else any the dragged one touches.
const collision: CollisionDetection = (args) => {
  const within = pointerWithin(args);
  return within.length ? within : rectIntersection(args);
};

/**
 * Next week's working days, a column each from 8:00 to 18:00: meetings,
 * the day's load, and its open time from 9:00 to 17:00. A priority
 * dragged (or moved with the keyboard) onto open time takes up to two
 * hours of it; dragged back to the strip, it is unplaced.
 */
const WeekGrid: React.FunctionComponent<WeekGridProps> = ({
  days,
  meetings,
  priorities,
  disabled = false,
  onPlace,
}) => {
  const [dragging, setDragging] = useState<ReviewItem>();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );
  const loads = weekLoad(meetings, days, priorities);
  const placed = (i: ReviewItem) => Boolean(i.scheduledOn && i.scheduledStart);
  const unplaced = priorities.filter((i) => !placed(i));
  const hours: number[] = [];
  for (let hour = FROM; hour <= TO; hour += 2) hours.push(hour);

  const start = ({ active }: DragStartEvent) =>
    setDragging(active.data.current?.item as ReviewItem | undefined);

  const end = ({ active, over }: DragEndEvent) => {
    setDragging(undefined);
    const item = active.data.current?.item as ReviewItem | undefined;
    if (!item || !over) return;
    if (over.id === UNPLACED) {
      if (placed(item)) void onPlace(item, null);
      return;
    }
    const { day, gap } = over.data.current as { day: string; gap: Gap };
    void onPlace(item, { day, ...placeInGap(gap) });
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={start}
      onDragEnd={end}
      onDragCancel={() => setDragging(undefined)}
    >
      <div className={styles.stack}>
        <Unplaced>
          <span className={styles.meta}>To place:</span>
          {unplaced.length === 0 ? (
            <span className={styles.meta}>
              {priorities.length
                ? "every priority has its time"
                : "no priorities yet"}
            </span>
          ) : (
            unplaced.map((item) => (
              <Draggable
                key={item.id}
                item={item}
                disabled={disabled}
                className={styles.chip}
              >
                <Tag color={"green"}>{item.title}</Tag>
              </Draggable>
            ))
          )}
        </Unplaced>
        <div className={styles.weekGrid}>
          <span />
          {days.map((day, i) => {
            const load = loads[i];
            return (
              <div key={load.day} className={styles.dayHead}>
                <strong>{day.toFormat("ccc d")}</strong>
                <span className={styles.meta}>
                  {load.meetings} meeting{load.meetings === 1 ? "" : "s"} ·{" "}
                  {formatMinutes(load.meetingMinutes)}
                </span>
                <Tooltip
                  title={`${Math.round(load.load * 100)}% of 9:00 to 5:00 PM taken: ${load.level}`}
                >
                  <Progress
                    percent={Math.round(load.load * 100)}
                    size={"small"}
                    showInfo={false}
                    strokeColor={LEVEL_COLOR[load.level]}
                    aria-label={`${load.level} load`}
                  />
                </Tooltip>
              </div>
            );
          })}
          <div className={styles.hourLabels} aria-hidden={true}>
            {hours.map((hour) => (
              <span
                key={hour}
                className={styles.hourLabel}
                style={{ top: `${((hour - FROM) / (TO - FROM)) * 100}%` }}
              >
                {((hour + 11) % 12) + 1}
                {hour < 12 ? "a" : "p"}
              </span>
            ))}
          </div>
          {days.map((day) => {
            const date = day.toISODate()!;
            const spans = meetingSpans(meetings, day);
            const mine = priorities.filter(
              (i) => i.scheduledOn === date && placed(i),
            );
            // The one being dragged frees its own time while it moves.
            const blocks = mine
              .filter((i) => i.id !== dragging?.id)
              .map(blockedSpan)
              .filter((s): s is MeetingSpan => s !== undefined);
            const gaps = openTime(
              [...spans, ...blocks].sort(
                (a, b) => a.start.toMillis() - b.start.toMillis(),
              ),
              day,
            );
            return (
              <div
                key={date}
                className={styles.hours}
                role={"group"}
                aria-label={day.toFormat("cccc")}
              >
                {vertical(spans).map((b) => (
                  <Tooltip key={b.key} title={b.title}>
                    <span
                      className={`${styles.vblock} ${styles.meetingBlock}`}
                      style={b.style}
                    />
                  </Tooltip>
                ))}
                {gaps.map((gap) => (
                  <GapZone
                    key={gap.start.toISO()}
                    day={date}
                    gap={gap}
                    active={dragging !== undefined}
                  />
                ))}
                {mine.map((item) => {
                  const span = blockedSpan(item)!;
                  const [shape] = vertical([span]);
                  return shape ? (
                    <Draggable
                      key={item.id}
                      item={item}
                      disabled={disabled}
                      className={`${styles.vblock} ${styles.placedBlock}`}
                      style={shape.style}
                    >
                      {item.title}
                    </Draggable>
                  ) : null;
                })}
              </div>
            );
          })}
        </div>
      </div>
      <DragOverlay>
        {dragging && <Tag color={"green"}>{dragging.title}</Tag>}
      </DragOverlay>
    </DndContext>
  );
};

export default WeekGrid;
