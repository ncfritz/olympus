import { AimOutlined, RadarChartOutlined } from "@ant-design/icons";
import { Empty, Flex, Space } from "antd";
import Link from "next/link";
import React from "react";
import OlympusBreadcrumbs from "../../../components/layout/OlympusBreadcrumbs";

/**
 * Goals home (ADR 0026). Empty until docs/plans/goals phase 5 brings the
 * Board, Roadmap and Focus views.
 */
const GoalsPage: React.FunctionComponent = () => {
  return (
    <>
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
                <AimOutlined />
                <span>Goals</span>
              </Space>
            ),
          },
        ]}
      />
      <Flex vertical={true} align={"center"} justify={"center"} flex={1}>
        <Empty description={"Goals are on their way."} />
      </Flex>
    </>
  );
};

export default GoalsPage;
