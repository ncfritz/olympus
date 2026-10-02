import {
  CalendarOutlined,
  CarryOutOutlined,
  RadarChartOutlined,
} from "@ant-design/icons";
import { Space } from "antd";
import Link from "next/link";
import React from "react";
import OlympusBreadcrumbs from "../../layout/OlympusBreadcrumbs";

export interface ReviewBreadcrumbsProps {
  /** Daily review or Weekly review. */
  what: string;
  /** Where the review's list is, when it links there. */
  listHref?: string;
  /** The day, week or month. */
  label: string;
}

/** Minerva / Daily review / the period. */
const ReviewBreadcrumbs: React.FunctionComponent<ReviewBreadcrumbsProps> = ({
  what,
  listHref,
  label,
}) => {
  const kind = (
    <Space size={4}>
      <CarryOutOutlined />
      <span>{what}</span>
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
        { title: listHref ? <Link href={listHref}>{kind}</Link> : kind },
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
  );
};

export default ReviewBreadcrumbs;
