import { MailOutlined, RadarChartOutlined } from "@ant-design/icons";
import { Space } from "antd";
import Link from "next/link";
import React from "react";
import OlympusBreadcrumbs from "../../layout/OlympusBreadcrumbs";

export interface MailBreadcrumbsProps {
  /** The page, then whatever it adds (a label under re-classification). */
  trail: React.ReactNode[];
}

/** Minerva / Mail, then the page's own trail. */
const MailBreadcrumbs: React.FunctionComponent<MailBreadcrumbsProps> = ({
  trail,
}: MailBreadcrumbsProps) => (
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
          <Link href={"/minerva/mail"}>
            <Space size={4}>
              <MailOutlined />
              <span>Mail</span>
            </Space>
          </Link>
        ),
      },
      ...trail.map((title) => ({ title })),
    ]}
  />
);

export default MailBreadcrumbs;
