import type { EventContentArg } from "@fullcalendar/core";
import { Popover } from "antd";
import React, { useEffect, useRef } from "react";
import {
  type AvailabilityActions,
  type AvailabilityEventProps,
  DOT_ATTRIBUTE,
  OVERRIDE_STATUSES,
} from "../../../../utils/meetingAvailability";
import type { OnAirStatus } from "../../../../utils/onair";
import styles from "./Availability.module.css";
import StatusPicker from "./StatusPicker";

export interface AvailabilityEventContentProps {
  arg: EventContentArg;
  actions: AvailabilityActions;
  /** Whether this event's picker is open. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The calendar's row, in minutes: an event no longer has one line. */
  slotMinutes?: number;
}

/**
 * FullCalendar acts on a press before React sees it: kept from it, a press
 * on the dot doesn't start a drag. Its click still reaches the calendar,
 * whose `eventClick` passes over it (`isDotClick`), and React, whose
 * popover opens.
 */
const KEPT_FROM_CALENDAR = ["pointerdown", "mousedown", "touchstart"];

/**
 * A meeting or override block on the meetings pages: its status dot, its
 * time and its title. The dot opens the status picker; pressing it doesn't
 * open the meeting or start a drag.
 */
const AvailabilityEventContent: React.FunctionComponent<
  AvailabilityEventContentProps
> = ({
  arg,
  actions,
  open,
  onOpenChange,
  slotMinutes = 15,
}: AvailabilityEventContentProps) => {
  const dotRef = useRef<HTMLButtonElement>(null);
  // Events without a dot (none, today) carry no kind.
  const props = arg.event.extendedProps as
    AvailabilityEventProps | { kind?: undefined };

  useEffect(() => {
    const dot = dotRef.current;
    if (!dot) return;
    const stop = (e: Event) => e.stopPropagation();
    KEPT_FROM_CALENDAR.forEach((type) => dot.addEventListener(type, stop));
    return () =>
      KEPT_FROM_CALENDAR.forEach((type) => dot.removeEventListener(type, stop));
  }, []);

  // As the OnAir drawer's events: the dot and the time (small) on the first
  // line, and the title (bold) under them, indented past the dot; an event
  // of one row (15 minutes in the drawer) has its title after its time. A
  // month's day lists its events one line each.
  const stacked = !arg.view.type.startsWith("dayGrid");
  const short =
    arg.event.start !== null &&
    arg.event.end !== null &&
    arg.event.end.getTime() - arg.event.start.getTime() <=
      slotMinutes * 60 * 1000;
  const inline = !stacked || short;
  const text = (
    <>
      {arg.timeText && <span className={styles.eventTime}>{arg.timeText}</span>}
      {inline && (
        <span className={`${styles.eventTitle} ${styles.eventTitleInline}`}>
          {arg.event.title}
        </span>
      )}
    </>
  );
  const wrap = (line: React.ReactNode) =>
    inline ? (
      // A time grid's one-row event: its line in the middle of its row.
      <div className={`${styles.event} ${stacked ? styles.centered : ""}`}>
        {line}
      </div>
    ) : (
      <div className={styles.stacked}>
        <div className={styles.event}>{line}</div>
        <div className={`${styles.eventTitle} ${styles.eventTitleBelow}`}>
          {arg.event.title}
        </div>
      </div>
    );

  if (!props.kind) {
    return wrap(text);
  }

  const { status, overridden } = props;
  const label =
    OVERRIDE_STATUSES.find((s) => s.status === status)?.label ?? status;

  const select = async (next: OnAirStatus) => {
    if (props.kind === "block") {
      await actions.setBlockStatus(props.blockId, next);
    } else {
      await actions.setMeetingStatus(props.meetingId, next);
    }
    onOpenChange(false);
  };

  const remove = async () => {
    if (props.kind === "block") {
      await actions.deleteBlock(props.blockId);
    } else {
      await actions.removeMeetingOverride(props.meetingId);
    }
    onOpenChange(false);
  };

  return wrap(
    <>
      <Popover
        open={open}
        onOpenChange={onOpenChange}
        trigger={"click"}
        placement={"rightTop"}
        destroyOnHidden={true}
        content={
          <StatusPicker
            status={status}
            overridden={overridden}
            onSelect={select}
            // A meeting without an override has none to remove.
            onRemove={overridden ? remove : undefined}
            removeLabel={
              props.kind === "block" ? "Remove block" : "Remove override"
            }
          />
        }
      >
        <button
          ref={dotRef}
          type={"button"}
          {...{ [DOT_ATTRIBUTE]: true }}
          className={`${styles.dot} ${overridden ? styles.overridden : ""} oa-light-status-${status}`}
          aria-label={`Availability: ${label}${overridden ? " (override)" : ""}`}
          title={`${label}${overridden ? " (override)" : ""}`}
        />
      </Popover>
      {text}
    </>,
  );
};

export default AvailabilityEventContent;
