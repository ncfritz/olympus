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
> = ({ arg, actions, open, onOpenChange }: AvailabilityEventContentProps) => {
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

  // A month's day lists its events one line each; a time grid has room for
  // the title under the time.
  const stacked = !arg.view.type.startsWith("dayGrid");
  const time = arg.timeText ? <b>{arg.timeText}</b> : null;
  const text = stacked ? (
    <span className={styles.eventText}>{time}</span>
  ) : (
    <span className={styles.eventText}>
      {time} {arg.event.title}
    </span>
  );
  const wrap = (line: React.ReactNode) =>
    stacked ? (
      <div className={styles.stacked}>
        <div className={styles.event}>{line}</div>
        <div className={styles.eventTitle}>{arg.event.title}</div>
      </div>
    ) : (
      <div className={styles.event}>{line}</div>
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
