import type { DropArg } from "@fullcalendar/interaction";
import interactionPlugin from "@fullcalendar/interaction";
import timeGridPlugin from "@fullcalendar/timegrid";
import FullCalendar from "@fullcalendar/react";
import type { Meeting, ReviewItemKind } from "@ncfritz/olympus-sdk/minerva";
import { CloseCircleFilled } from "@ant-design/icons";
import { Button } from "antd";
import { DateTime } from "luxon";
import React, { useEffect, useRef, useState } from "react";
import meetingsApi from "../../../api/meetingsApi";
import { formatSpan } from "../../../utils/reviews";
import { PLAN_KINDS } from "./planKinds";
import styles from "./Review.module.css";

/** A plan item's block of time, as the calendar draws it. */
export type CalendarBlock = {
  id: string;
  title: string;
  kind: ReviewItemKind;
  start: Date;
  end: Date;
};

export interface DayCalendarProps {
  /** The day shown, YYYY-MM-DD. */
  day: string;
  meetings: Meeting[];
  /**
   * Planned blocks, drawn behind the meetings so they keep their place and
   * width. With `onBlockChange` a block moves by dragging it and changes
   * length by dragging its foot.
   */
  blocks?: CalendarBlock[];
  onBlockChange?: (id: string, start: Date, end: Date) => void;
  /** A block taken off: its close button, or dragged off the calendar. */
  onBlockRemove?: (id: string) => void;
  /**
   * An item dropped from a list (a FullCalendar Draggable whose elements
   * carry `data-block-item`), at the time it was dropped on.
   */
  onBlockDrop?: (id: string, start: Date) => void;
}

/** Moves and resizes snap to a quarter hour; a block is at least that. */
const SNAP = 15;

type Preview = { id: string; start: Date; end: Date; leaving?: boolean };

/**
 * A day's calendar as Meetings draws it, as a time grid filling its
 * container's height, whether the day has meetings or not, with any planned
 * blocks behind the meetings.
 */
const DayCalendar: React.FunctionComponent<DayCalendarProps> = ({
  day,
  meetings,
  blocks = [],
  onBlockChange,
  onBlockRemove,
  onBlockDrop,
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  // A block being dragged, or one saved and not yet back from the API.
  const [preview, setPreview] = useState<Preview>();
  // When the blocks come back from a save, they are where they were put.
  const placed = blocks.map((b) => `${b.id}@${+b.start}-${+b.end}`).join();
  useEffect(() => setPreview(undefined), [placed]);

  const dayStart = DateTime.fromISO(day).startOf("day");
  const dayEnd = dayStart.plus({ days: 1 });

  /** Follows the pointer, moving a block or its end, until it lets go. */
  const begin = (
    event: React.PointerEvent,
    block: CalendarBlock,
    mode: "move" | "resize",
  ) => {
    if (!onBlockChange || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const lane = rootRef.current?.querySelector<HTMLElement>(
      ".fc-timegrid-slot-lane",
    );
    // Each slot is 30 minutes tall.
    const perMinute = (lane?.getBoundingClientRect().height ?? 24) / 30;
    const startY = event.clientY;
    const start = DateTime.fromJSDate(block.start);
    const end = DateTime.fromJSDate(block.end);
    const minutes = end.diff(start, "minutes").minutes;
    let moved: Preview | undefined;
    let leaving = false;

    const move = (e: PointerEvent) => {
      // A block dragged off the calendar is taken off when it is let go.
      const box = rootRef.current?.getBoundingClientRect();
      const outside =
        mode === "move" &&
        onBlockRemove !== undefined &&
        box !== undefined &&
        (e.clientX < box.left ||
          e.clientX > box.right ||
          e.clientY < box.top ||
          e.clientY > box.bottom);
      if (outside !== leaving) {
        leaving = outside;
        moved = { ...(moved ?? block), id: block.id, leaving };
        setPreview(moved);
      }
      if (leaving) return;
      const delta = Math.round((e.clientY - startY) / perMinute / SNAP) * SNAP;
      let from = start;
      let to = end;
      if (mode === "move") {
        from = start.plus({ minutes: delta });
        if (from < dayStart) from = dayStart;
        if (from.plus({ minutes }) > dayEnd) {
          from = dayEnd.minus({ minutes });
        }
        to = from.plus({ minutes });
      } else {
        to = end.plus({ minutes: delta });
        if (to < start.plus({ minutes: SNAP })) {
          to = start.plus({ minutes: SNAP });
        }
        if (to > dayEnd) to = dayEnd;
      }
      if (
        !moved ||
        +moved.start !== +from.toJSDate() ||
        +moved.end !== +to.toJSDate()
      ) {
        moved = { id: block.id, start: from.toJSDate(), end: to.toJSDate() };
        setPreview(moved);
      }
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      if (leaving) {
        onBlockRemove?.(block.id);
        return;
      }
      if (
        moved &&
        (+moved.start !== +block.start || +moved.end !== +block.end)
      ) {
        // Kept drawn where it was put until the saved plan comes back.
        onBlockChange(block.id, moved.start, moved.end);
      } else {
        setPreview(undefined);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const shown = blocks.map((b) =>
    preview && preview.id === b.id ? { ...b, ...preview } : b,
  );

  return (
    <div
      ref={rootRef}
      className={`${styles.calendarRoot} ${onBlockChange ? styles.calendarEditable : ""}`}
    >
      <FullCalendar
        plugins={[timeGridPlugin, interactionPlugin]}
        viewClassNames={"minerva-cal hide-day-header"}
        initialView={"timeGridDay"}
        initialDate={dayStart.toJSDate()}
        events={[
          ...meetings.filter((m) => !m.isDeleted).map(meetingsApi.toEvent),
          ...shown.map((b) => ({
            id: `block-${b.id}`,
            start: b.start,
            end: b.end,
            title: b.title,
            display: "background",
            classNames: [
              styles.block,
              PLAN_KINDS[b.kind].block,
              ...("leaving" in b && b.leaving ? [styles.blockLeaving] : []),
            ],
            extendedProps: { block: b },
          })),
        ]}
        eventContent={(arg) => {
          const block = arg.event.extendedProps.block as
            CalendarBlock | undefined;
          if (!block) return true;
          return (
            <div
              className={styles.blockContent}
              title={`${block.title}, ${formatSpan(
                DateTime.fromJSDate(block.start),
                DateTime.fromJSDate(block.end),
              )}`}
              onPointerDown={(e) => begin(e, block, "move")}
            >
              <span className={styles.blockTitle}>
                {PLAN_KINDS[block.kind].icon}
                <span>{block.title}</span>
              </span>
              <span>
                {formatSpan(
                  DateTime.fromJSDate(block.start),
                  DateTime.fromJSDate(block.end),
                )}
              </span>
              {onBlockRemove && (
                <Button
                  className={styles.blockClose}
                  size={"small"}
                  type={"text"}
                  icon={
                    <CloseCircleFilled
                      className={PLAN_KINDS[block.kind].close}
                    />
                  }
                  aria-label={`Take ${block.title} off the calendar`}
                  title={"Take it off the calendar"}
                  // Not the start of a move.
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => onBlockRemove(block.id)}
                />
              )}
              {onBlockChange && (
                <div
                  className={styles.blockHandle}
                  aria-hidden={true}
                  onPointerDown={(e) => begin(e, block, "resize")}
                />
              )}
            </div>
          );
        }}
        droppable={onBlockDrop !== undefined}
        drop={(info: DropArg) => {
          const id = info.draggedEl.dataset.blockItem;
          if (id) onBlockDrop?.(id, info.date);
        }}
        headerToolbar={false}
        height={"100%"}
        allDayText={""}
        slotDuration={{ minutes: 30 }}
        snapDuration={{ minutes: SNAP }}
        scrollTime={"08:00:00"}
        slotLabelFormat={{ hour: "numeric", meridiem: "short" }}
        businessHours={{
          days: [1, 2, 3, 4, 5],
          startTime: "9:00",
          endTime: "17:00",
        }}
        nowIndicator={true}
      />
    </div>
  );
};

export default DayCalendar;
