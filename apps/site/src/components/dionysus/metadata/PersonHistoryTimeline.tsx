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
import { getPoster } from "./util";

export interface PersonHistoryTimelineProps {
  movieRoles: PersonMovieCastCredit[];
  movieJobs: PersonMovieCrewCredit[];
}

interface TimelineEntry {
  date: DateTime;
  showType: "movie" | "tv_show";
  showTitle: string;
  showId: number;
  poster: string | undefined;
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
          poster: item.movie.posterPath,
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
          poster: item.movie.posterPath,
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
      title: (
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
            orientation={"horizontal"}
            style={{
              width: "100%",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Typography.Text style={{ fontSize: "11px" }}>
              <Space orientation={"horizontal"} size={4}>
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
        <Space orientation={"horizontal"} size={8} style={{ width: "100%" }}>
          {getPoster(timelineEntry.poster, "vertical", 48, 4)}
          <Space
            orientation={"vertical"}
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
        </Space>
      );

      items.push({
        title: (
          <Typography.Text style={{ fontSize: "10px" }}>
            {timelineEntry.date.toFormat("MM-dd")}
          </Typography.Text>
        ),
        content: children,
        icon: <VideoCameraOutlined />,
      });
    });
  });

  return (
    <Timeline
      className={"person-timeline"}
      mode={"left"}
      items={items}
      styles={{
        itemHeader: {
          width: 48,
          flex: 0,
        },
        itemTitle: {
          width: 48,
        },
        itemIcon: {
          marginInlineStart: -5,
          insetInlineStart: 67,
        },
        itemRail: {
          insetInlineStart: 66,
        },
      }}
    />
  );
};
export default PersonHistoryTimeline;
