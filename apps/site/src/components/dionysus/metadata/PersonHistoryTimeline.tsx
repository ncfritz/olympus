import {
  ToolOutlined,
  UserOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";
import type {
  PersonMovieCastCredit,
  PersonMovieCrewCredit,
} from "@ncfritz/olympus-sdk/dionysus";
import { Space, Timeline, type TimelineItemProps, Typography } from "antd";
import { DateTime } from "luxon";
import Link from "next/link";
import { type ReactNode, useEffect, useState } from "react";

export interface PersonHistoryTimelineProps {
  movieRoles: PersonMovieCastCredit[];
  movieJobs: PersonMovieCrewCredit[];
}

interface TimelineEntry {
  date: DateTime;
  showType: "movie" | "tv_show";
  showTitle: string;
  showId: number;
  parts: JobOrRole[];
}

interface JobOrRole {
  creditType: "cast" | "crew";
  department: string;
  creditTitle: string;
}

const PersonHistoryTimeline: React.FunctionComponent<
  PersonHistoryTimelineProps
> = ({ movieRoles, movieJobs }: PersonHistoryTimelineProps) => {
  const [events, setEvents] = useState<Map<number, Map<string, TimelineEntry>>>(
    new Map(),
  );

  useEffect(() => {
    const newEntries: Map<number, Map<string, TimelineEntry>> = new Map();

    movieRoles.forEach((item) => {
      if (!item.movie.releaseDate) {
        return;
      }

      const date = DateTime.fromISO(item.movie.releaseDate);

      if (!newEntries.has(date.year)) {
        newEntries.set(date.year, new Map());
      }

      let entry = newEntries.get(date.year)!.get(`m${item.movie.id}`);

      if (!entry) {
        entry = {
          date: date,
          showTitle: item.movie.title,
          showType: "movie",
          showId: item.movie.id,
          parts: [],
        };

        newEntries.get(date.year)!.set(`m${item.movie.id}`, entry);
      }

      item.roles.forEach((role) => {
        entry.parts.push({
          creditType: "cast",
          creditTitle: role.character,
          department: "Acting",
        });
      });
    });

    movieJobs.forEach((item) => {
      if (!item.movie.releaseDate) {
        return;
      }

      const date = DateTime.fromISO(item.movie.releaseDate);

      if (!newEntries.has(date.year)) {
        newEntries.set(date.year, new Map());
      }

      let entry = newEntries.get(date.year)!.get(`m${item.movie.id}`);

      if (!entry) {
        entry = {
          date: date,
          showTitle: item.movie.title,
          showType: "movie",
          showId: item.movie.id,
          parts: [],
        };

        newEntries.get(date.year)!.set(`m${item.movie.id}`, entry);
      }

      item.jobs.forEach((job) => {
        entry.parts.push({
          creditType: "crew",
          creditTitle: job.job,
          department: job.department,
        });
      });
    });

    setEvents(newEntries);
  }, [movieRoles, movieJobs]);

  const items: TimelineItemProps[] = [];

  events.entries().forEach(([year, timelineEntries]) => {
    items.push({
      label: (
        <Typography.Text strong={true} style={{ fontSize: "13px" }}>
          {year}
        </Typography.Text>
      ),
      color: "#efefef",
    });

    timelineEntries.values().forEach((timelineEntry) => {
      const parts: ReactNode[] = [];

      timelineEntry.parts.forEach((part) => {
        parts.push(
          <Space
            direction={"horizontal"}
            style={{
              width: "100%",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Typography.Text style={{ fontSize: "11px" }}>
              <Space direction={"horizontal"} size={4}>
                {part.creditType === "cast" ? (
                  <UserOutlined />
                ) : (
                  <ToolOutlined />
                )}
                {part.creditTitle || "Unknown"}
              </Space>
            </Typography.Text>
            <Typography.Text style={{ fontSize: "10px", color: "#999999" }}>
              {part.department}
            </Typography.Text>
          </Space>,
        );
      });

      const children = (
        <Space
          direction={"vertical"}
          style={{ width: "100%", paddingRight: 24 }}
          size={0}
        >
          <Link href={`/dionysus/movies/${timelineEntry.showId}`}>
            <Typography.Text style={{ fontSize: "12px" }} italic={true}>
              {timelineEntry.showTitle}
            </Typography.Text>
          </Link>
          {parts}
        </Space>
      );

      items.push({
        label: (
          <Typography.Text style={{ fontSize: "10px" }}>
            {timelineEntry.date.toFormat("MM-dd")}
          </Typography.Text>
        ),
        children: children,
        dot: <VideoCameraOutlined />,
      });
    });
  });

  return <Timeline className={"person-timeline"} mode={"left"} items={items} />;
};
export default PersonHistoryTimeline;
