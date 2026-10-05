import { BarChartOutlined } from "@ant-design/icons";
import { Empty, Flex, Space } from "antd";
import React from "react";
import MailBreadcrumbs from "../../../components/minerva/mail/MailBreadcrumbs";

/**
 * Mail statistics: top senders and labels, and their activity over time (ADR
 * 0030). Empty until docs/plans/email-management phase 2 brings it.
 */
const MailStatisticsPage: React.FunctionComponent = () => {
  return (
    <>
      <MailBreadcrumbs
        trail={[
          <Space key={"page"} size={4}>
            <BarChartOutlined />
            <span>Statistics</span>
          </Space>,
        ]}
      />
      <Flex vertical={true} align={"center"} justify={"center"} flex={1}>
        <Empty description={"Mail statistics are on their way."} />
      </Flex>
    </>
  );
};

export default MailStatisticsPage;
