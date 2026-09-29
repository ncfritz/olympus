import type { EventInput } from "@fullcalendar/core";
import FullCalendar from "@fullcalendar/react";
import multiMonthPlugin from "@fullcalendar/multimonth";
import type { SparseEpisode } from "@ncfritz/olympus-sdk/dionysus";
import { Col, Spin } from "antd";
import { DateTime } from "luxon";
import React, { useEffect, useRef, useState } from "react";

export interface SeasonEpisodeCalendarProps {
  episodes: SparseEpisode[];
}

const SeasonEpisodeCalendar: React.FunctionComponent<
  SeasonEpisodeCalendarProps
> = ({ episodes }: SeasonEpisodeCalendarProps) => {
  const calendarRef = useRef<FullCalendar>(null);

  const [startDate, setStartDate] = useState<DateTime>(DateTime.utc());
  const [, setEndDate] = useState<DateTime>(DateTime.utc());
  const [events, setEvents] = useState<EventInput[]>([]);
  const [months, setMonths] = useState(3);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const now = DateTime.utc();

    try {
      let start: DateTime = DateTime.utc();
      let end = DateTime.fromMillis(0);
      const newEvents: EventInput[] = [];

      episodes.forEach((item) => {
        const airDate = DateTime.fromISO(item.airDate!);

        if (!item.airDate || !airDate.isValid) {
          return;
        }

        if (airDate < start) {
          start = airDate;
        }

        if (airDate > end) {
          end = airDate;
        }

        const classNames = ["episode"];

        if (airDate > now) {
          classNames.push("future");
        }

        newEvents.push({
          id: `e-s${item.seasonNumber}e${item.episodeNumber}`,
          allDay: true,
          title: `E${item.episodeNumber}`,
          start: airDate.toJSDate(),
          classNames: classNames,
        });
      });

      setStartDate(start);
      setEndDate(end);
      setEvents(newEvents);
      setMonths(Math.ceil(end.diff(start, "months").months) + 1);

      if (calendarRef?.current?.getApi()) {
        const api = calendarRef.current.getApi();

        api.gotoDate(start.toJSDate());
      }
    } finally {
      setLoading(false);
    }
  }, [episodes]);

  return loading ? (
    <Spin />
  ) : (
    <Col
      style={{
        height: "calc(100vh - 302px)",
        width: 486,
      }}
    >
      <FullCalendar
        ref={calendarRef}
        plugins={[multiMonthPlugin]}
        viewClassNames={"minerva-cal minerva-cal-home dionysus-release-cal"}
        initialDate={startDate ? startDate.toJSDate() : new Date()}
        events={events}
        dayMaxEventRows={3}
        showNonCurrentDates={false}
        initialView={"multiMonthFixed"}
        multiMonthMaxColumns={1}
        views={{
          multiMonthFixed: {
            type: "multiMonth",
            duration: { months: months },
          },
        }}
        businessHours={{
          days: [1, 2, 3, 4, 5],
        }}
        height={"100%"}
        headerToolbar={false}
        titleFormat={{
          year: "numeric",
          month: "long",
          day: "numeric",
          weekday: "long",
        }}
      />
    </Col>
  );
};
export default SeasonEpisodeCalendar;
