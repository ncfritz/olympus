import { AimOutlined, RadarChartOutlined } from "@ant-design/icons";
import { Space } from "antd";
import Link from "next/link";
import React from "react";
import OlympusBreadcrumbs from "../../layout/OlympusBreadcrumbs";

/** Minerva / Goals, then whatever the page adds. */
const GoalsBreadcrumbs: React.FunctionComponent<{
  trail?: React.ReactNode[];
}> = ({ trail = [] }) => (
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
        title:
          trail.length > 0 ? (
            <Link href={"/minerva/goals"}>
              <Space size={4}>
                <AimOutlined />
                <span>Goals</span>
              </Space>
            </Link>
          ) : (
            <Space size={4}>
              <AimOutlined />
              <span>Goals</span>
            </Space>
          ),
      },
      ...trail.map((title) => ({ title })),
    ]}
  />
);

export default GoalsBreadcrumbs;
