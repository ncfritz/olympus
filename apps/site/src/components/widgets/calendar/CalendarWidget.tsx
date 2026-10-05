import { CaretDownOutlined, CaretRightOutlined } from "@ant-design/icons";
import type { EventClickArg } from "@fullcalendar/core";
import interactionPlugin from "@fullcalendar/interaction";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import type { Meeting } from "@ncfritz/olympus-sdk/minerva";
import { Button, Segmented, Skeleton } from "antd";
import { DateTime } from "luxon";
import Link from "next/link";
import { useRouter } from "next/router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import meetingsApi from "../../../api/meetingsApi";
import { useAuth } from "../../../auth/AuthProvider";
import useAvailabilityCalendar from "../../../hooks/useAvailabilityCalendar";
import {
  CALENDAR_WIDGET_KEY,
  type CalendarWidgetSettings,
  clampHeight,
  DEFAULT_CALENDAR_WIDGET,
  parseCalendarWidget,
  type WeekDays,
  weekOf,
} from "../../../utils/calendarWidget";
import { Events, publish } from "../../../utils/events";
import {
  loadFromLocalStorage,
  storeToLocalStorage,
} from "../../../utils/storage";
import styles from "./CalendarWidget.module.css";

/** Checks now and then for midnight, so the widget moves on to the new day. */
const ROLLOVER_MS = 15 * 60 * 1000;
/** Half-hour rows: a working day in the widget's default height. */
const SLOT_MINUTES = 30;
/** How far an arrow key moves the bottom edge. */
const KEY_STEP = 40;

const today = () => DateTime.now().toISODate()!;

/**
 * The home page's calendar: this week's meetings, Monday to Friday or the
 * whole week, as the meetings pages show them, with their status dots and
 * overrides, and the same filters. It collapses to its heading, and its
 * bottom edge drags to set its height.
 */
const CalendarWidget: React.FunctionComponent = () => {
  const auth = useAuth();
  if (auth.status !== "signed-in") {
    return (
      <section className={styles.card} aria-label={"Calendar"}>
        <div className={styles.header}>
          <h2 className={styles.title}>Calendar</h2>
        </div>
        {auth.status === "loading" ? (
          <Skeleton active={true} paragraph={{ rows: 4 }} title={false} />
        ) : (
          <div className={styles.state}>Sign in to see your week.</div>
        )}
      </section>
    );
  }
  return <SignedInCalendar />;
};

const SignedInCalendar = () => {
  const router = useRouter();
  const [settings, setSettings] = useState<CalendarWidgetSettings>(
    DEFAULT_CALENDAR_WIDGET,
  );
  // Read after mounting: the server render has no local storage.
  useEffect(() => {
    setSettings(
      parseCalendarWidget(
        loadFromLocalStorage<unknown>(CALENDAR_WIDGET_KEY, null),
      ),
    );
  }, []);
  const save = (next: CalendarWidgetSettings) => {
    setSettings(next);
    try {
      storeToLocalStorage(CALENDAR_WIDGET_KEY, next);
    } catch {
      // Storage full or blocked: the change still applies to this visit.
    }
  };

  const [day, setDay] = useState(today);
  useEffect(() => {
    const timer = setInterval(() => setDay(today()), ROLLOVER_MS);
    return () => clearInterval(timer);
  }, []);

  const week = useMemo(
    () => weekOf(DateTime.fromISO(day), settings.days),
    [day, settings.days],
  );
  const weekStart = week.start.toISODate()!;

  // The whole week, either way: switching between five days and seven
  // shows what is already here.
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const response = await meetingsApi.getMeetings(
          DateTime.fromISO(weekStart),
          7,
        );
        setMeetings(response.data.items);
      } catch {
        publish(Events.NOTIFICATIONS_PUBLISH_EVENT, {
          type: "error",
          message: "Failed to load meetings",
          description: "Unable to fetch this week's meetings",
        });
      }
    })();
  }, [weekStart]);

  const range = useMemo(() => {
    const start = DateTime.fromISO(weekStart);
    return { start: start.toJSDate(), end: start.plus({ days: 7 }).toJSDate() };
  }, [weekStart]);

  const calendar = useAvailabilityCalendar({
    meetings,
    slotMinutes: SLOT_MINUTES,
    start: range.start,
    end: range.end,
    onMeetingClick: (arg: EventClickArg) => {
      const target = DateTime.fromJSDate(arg.event.start!);
      const url = `/minerva/meetings/${target.toFormat("yyyy/MM/dd")}?e=${encodeURIComponent(arg.event.id)}`;
      void router.push(url);
    },
  });

  // FullCalendar measures itself on window resizes only; a dragged height
  // or a resized column changes its box without one.
  const bodyRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<FullCalendar>(null);
  useEffect(() => {
    const body = bodyRef.current;
    if (!body || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() =>
      calendarRef.current?.getApi().updateSize(),
    );
    observer.observe(body);
    return () => observer.disconnect();
  }, [settings.collapsed]);

  // The calendar starts on the week it shows; a new week moves it there.
  useEffect(() => {
    calendarRef.current
      ?.getApi()
      .gotoDate(DateTime.fromISO(weekStart).toJSDate());
  }, [weekStart]);

  return (
    <section className={styles.card} aria-label={"Calendar"}>
      <div className={styles.header}>
        <div className={styles.heading}>
          <Button
            type={"text"}
            size={"small"}
            icon={
              settings.collapsed ? (
                <CaretRightOutlined />
              ) : (
                <CaretDownOutlined />
              )
            }
            aria-label={
              settings.collapsed
                ? "Expand the calendar"
                : "Collapse the calendar"
            }
            aria-expanded={!settings.collapsed}
            onClick={() =>
              save({ ...settings, collapsed: !settings.collapsed })
            }
          />
          <h2 className={styles.title}>Calendar</h2>
          <Link
            className={styles.meta}
            href={`/minerva/meetings/${week.start.toFormat("kkkk")}/W${week.start.toFormat("WW")}`}
          >
            {week.label}
          </Link>
        </div>
        <div className={styles.controls}>
          <Segmented<WeekDays>
            size={"small"}
            value={settings.days}
            options={[
              { label: "5 days", value: 5 },
              { label: "7 days", value: 7 },
            ]}
            onChange={(days) => save({ ...settings, days })}
          />
        </div>
      </div>
      {!settings.collapsed && (
        <>
          <div
            ref={bodyRef}
            className={styles.body}
            // The height dragged to, kept per browser.
            // eslint-disable-next-line no-restricted-syntax
            style={{ height: settings.height }}
          >
            <FullCalendar
              ref={calendarRef}
              plugins={[timeGridPlugin, interactionPlugin]}
              viewClassNames={"minerva-cal minerva-cal-week"}
              initialView={"timeGridWeek"}
              initialDate={range.start}
              firstDay={1}
              weekends={settings.days === 7}
              headerToolbar={false}
              dayHeaderFormat={{ weekday: "short", day: "numeric" }}
              height={"100%"}
              scrollTime={"08:00:00"}
              slotDuration={{ minutes: SLOT_MINUTES }}
              nowIndicator={true}
              businessHours={{
                daysOfWeek: [1, 2, 3, 4, 5],
                startTime: "9:00",
                endTime: "17:00",
              }}
              events={calendar.events}
              eventContent={calendar.eventContent}
              eventClick={calendar.eventClick}
              selectable={true}
              selectMirror={true}
              select={calendar.select}
              selectAllow={calendar.selectAllow}
              eventChange={calendar.eventChange}
            />
          </div>
          <ResizeEdge
            height={settings.height}
            onResize={(height) => setSettings((s) => ({ ...s, height }))}
            onResizeEnd={(height) => save({ ...settings, height })}
          />
        </>
      )}
    </section>
  );
};

/**
 * The card's bottom edge: dragged, or moved with the arrow keys, to set
 * the calendar's height.
 */
const ResizeEdge = ({
  height,
  onResize,
  onResizeEnd,
}: {
  height: number;
  onResize: (height: number) => void;
  onResizeEnd: (height: number) => void;
}) => {
  const drag = useRef<{ y: number; height: number; last: number } | undefined>(
    undefined,
  );
  const [resizing, setResizing] = useState(false);

  return (
    <div
      role={"separator"}
      aria-orientation={"horizontal"}
      aria-label={"Calendar height"}
      aria-valuenow={height}
      tabIndex={0}
      className={`${styles.resize} ${resizing ? styles.resizing : ""}`}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { y: e.clientY, height, last: height };
        setResizing(true);
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        const next = clampHeight(
          drag.current.height + e.clientY - drag.current.y,
        );
        drag.current.last = next;
        onResize(next);
      }}
      onPointerUp={(e) => {
        if (!drag.current) return;
        e.currentTarget.releasePointerCapture(e.pointerId);
        onResizeEnd(drag.current.last);
        drag.current = undefined;
        setResizing(false);
      }}
      onKeyDown={(e) => {
        const step =
          e.key === "ArrowDown"
            ? KEY_STEP
            : e.key === "ArrowUp"
              ? -KEY_STEP
              : 0;
        if (step === 0) return;
        e.preventDefault();
        onResizeEnd(clampHeight(height + step));
      }}
    />
  );
};

export default CalendarWidget;
