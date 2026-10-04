import {
  BarChartOutlined,
  CalendarOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { Space } from "antd";
import { DateTime } from "luxon";
import Link from "next/link";
import { useParams } from "next/navigation";
import React from "react";
import DayView from "../../../components/minerva/meetings/dayView";
import MonthView from "../../../components/minerva/meetings/monthView";
import WeekView from "../../../components/minerva/meetings/weekView";

const IndexPage: React.FunctionComponent = () => {
  const params = useParams<{ date: string[] }>();

  let targetDate: DateTime = DateTime.now().startOf("day");
  let startDate: DateTime = DateTime.now().startOf("day");

  const breadcrumbs = [
    {
      title: (
        <Link href={"/minerva/meetings/"}>
          <Space>
            <TeamOutlined />
            <span>Meetings</span>
          </Space>
        </Link>
      ),
    },
    {
      title: (
        <Link href={`/minerva/meetings/${targetDate.year}`}>
          <Space>
            <BarChartOutlined />
            <span>{targetDate.year}</span>
          </Space>
        </Link>
      ),
    },
  ];

  if (params.date) {
    if (params.date.length === 3) {
      targetDate = DateTime.fromObject({
        year: parseInt(params.date[0]),
        month: parseInt(params.date[1]),
        day: parseInt(params.date[2]),
      });
      startDate = targetDate.startOf("month");

      breadcrumbs.push({
        title: (
          <Link
            href={`/minerva/meetings/${targetDate.year}/${targetDate.toFormat("MM")}`}
          >
            <Space>
              <CalendarOutlined />
              <span>{targetDate.toFormat("MMMM")}</span>
            </Space>
          </Link>
        ),
      });
      breadcrumbs.push({
        title: (
          <Space>
            <CalendarOutlined />
            <span>{targetDate.toFormat("dd")}</span>
          </Space>
        ),
      });

      return <DayView startDate={targetDate} breadcrumbs={breadcrumbs} />;
    } else if (params.date.length === 2) {
      if (params.date[1].toLowerCase().startsWith("w")) {
        const weekNumber = parseInt(
          params.date[1].substring(1, params.date[1].length),
        );

        startDate = DateTime.fromObject({
          year: parseInt(params.date[0]),
        });
        startDate = startDate.set({ weekNumber: weekNumber }).startOf("week");

        breadcrumbs.push({
          title: (
            <Space>
              <CalendarOutlined />
              <span>Week {startDate.toFormat("WW")}</span>
            </Space>
          ),
        });

        return <WeekView startDate={startDate} breadcrumbs={breadcrumbs} />;
      } else {
        startDate = DateTime.fromObject({
          year: parseInt(params.date[0]),
          month: parseInt(params.date[1]),
        }).startOf("month");
        breadcrumbs.push({
          title: (
            <Space>
              <CalendarOutlined />
              <span>{startDate.toFormat("MMMM")}</span>
            </Space>
          ),
        });

        return <MonthView startDate={startDate} breadcrumbs={breadcrumbs} />;
      }
    } else if (params.date.length === 1) {
      startDate = DateTime.fromObject({
        year: parseInt(params.date[0]),
      }).startOf("year");

      return <MonthView startDate={startDate} breadcrumbs={breadcrumbs} />;
    }
  }

  breadcrumbs.push({
    title: (
      <Link
        href={`/minerva/meetings/${targetDate.year}/${targetDate.toFormat("MM")}`}
      >
        <Space>
          <CalendarOutlined />
          <span>{targetDate.toFormat("MMMM")}</span>
        </Space>
      </Link>
    ),
  });
  breadcrumbs.push({
    title: (
      <Space>
        <CalendarOutlined />
        <span>{targetDate.toFormat("dd")}</span>
      </Space>
    ),
  });

  return <DayView startDate={targetDate} breadcrumbs={breadcrumbs} />;
};

export default IndexPage;
