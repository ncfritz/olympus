import { DotChartOutlined } from "@ant-design/icons";
import { Empty, Flex, Space } from "antd";
import React from "react";
import MailBreadcrumbs from "../../../components/minerva/mail/MailBreadcrumbs";

/**
 * Clusters: messages placed by similarity, coloured by label (ADR 0030).
 * Empty until docs/plans/email-management phase 6 brings it.
 */
const MailClustersPage: React.FunctionComponent = () => {
  return (
    <>
      <MailBreadcrumbs
        trail={[
          <Space key={"page"} size={4}>
            <DotChartOutlined />
            <span>Clusters</span>
          </Space>,
        ]}
      />
      <Flex vertical={true} align={"center"} justify={"center"} flex={1}>
        <Empty description={"Clusters are on their way."} />
      </Flex>
    </>
  );
};

export default MailClustersPage;
