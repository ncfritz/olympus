import {
  CalendarOutlined,
  CarryOutOutlined,
  RadarChartOutlined,
} from "@ant-design/icons";
import { Empty, Flex, Space } from "antd";
import Link from "next/link";
import React from "react";
import { type ReviewRoute, reviewRouteLabel } from "../../../utils/reviews";
import OlympusBreadcrumbs from "../../layout/OlympusBreadcrumbs";

export interface ReviewPlaceholderProps {
  route: ReviewRoute;
}

const WHAT: Record<ReviewRoute["kind"], string> = {
  daily: "Daily review",
  weekly: "Weekly review",
};

/**
 * Where a review page stands until docs/plans/activity-review phases 4 to 6
 * build it: the breadcrumbs for the route, and what will be there.
 */
const ReviewPlaceholder: React.FunctionComponent<ReviewPlaceholderProps> = ({
  route,
}) => {
  const label = reviewRouteLabel(route);
  let description: string;
  if (route.view === "invalid") {
    description = "There is no review at this address.";
  } else if (route.view === "list") {
    description = `The ${WHAT[route.kind].toLowerCase()}s of ${label} are on their way.`;
  } else {
    description = `The ${WHAT[route.kind].toLowerCase()} of ${label} is on its way.`;
  }

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
                <CarryOutOutlined />
                <span>{WHAT[route.kind]}</span>
              </Space>
            ),
          },
          {
            title: (
              <Space size={4}>
                <CalendarOutlined />
                <span>{label}</span>
              </Space>
            ),
          },
        ]}
      />
      <Flex vertical={true} align={"center"} justify={"center"} flex={1}>
        <Empty description={description} />
      </Flex>
    </>
  );
};

export default ReviewPlaceholder;
