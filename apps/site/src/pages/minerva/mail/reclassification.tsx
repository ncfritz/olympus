import { TagsOutlined } from "@ant-design/icons";
import { Empty, Flex, Space } from "antd";
import React from "react";
import MailBreadcrumbs from "../../../components/minerva/mail/MailBreadcrumbs";

/**
 * Re-classification: suggested label changes across the mailbox, by label
 * (ADR 0030). Empty until docs/plans/email-management phase 4 brings it;
 * phase 2 shows the audit's findings first.
 */
const MailReclassificationPage: React.FunctionComponent = () => {
  return (
    <>
      <MailBreadcrumbs
        trail={[
          <Space key={"page"} size={4}>
            <TagsOutlined />
            <span>Re-classification</span>
          </Space>,
        ]}
      />
      <Flex vertical={true} align={"center"} justify={"center"} flex={1}>
        <Empty description={"Re-classification is on its way."} />
      </Flex>
    </>
  );
};

export default MailReclassificationPage;
