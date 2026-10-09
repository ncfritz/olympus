import {
  CalendarOutlined,
  RadarChartOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { Space } from "antd";
import Link from "next/link";
import React from "react";
import { CALENDARS_PATH } from "../../../utils/calendars";
import OlympusBreadcrumbs from "../../layout/OlympusBreadcrumbs";

/** Minerva / Meetings / Calendars, then whatever the page adds. */
const CalendarsBreadcrumbs: React.FunctionComponent<{
  trail?: React.ReactNode[];
}> = ({ trail = [] }) => {
  const calendars = (
    <Space size={4}>
      <SettingOutlined />
      <span>Calendars</span>
    </Space>
  );
  return (
    <OlympusBreadcrumbs
      className={"dark"}
      items={[
        {
          title: (
            <Link href={"/minerva"}>
              <Space size={4}>
                <RadarChartOutlined />
                <span>Minerva</span>
              </Space>
            </Link>
          ),
        },
        {
          title: (
            <Space size={4}>
              <CalendarOutlined />
              <span>Meetings</span>
            </Space>
          ),
        },
        {
          title:
            trail.length > 0 ? (
              <Link href={CALENDARS_PATH}>{calendars}</Link>
            ) : (
              calendars
            ),
        },
        ...trail.map((title) => ({ title })),
      ]}
    />
  );
};

export default CalendarsBreadcrumbs;
