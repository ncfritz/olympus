import { InboxOutlined } from "@ant-design/icons";
import { Empty, Flex, Space } from "antd";
import React from "react";
import MailBreadcrumbs from "../../../components/minerva/mail/MailBreadcrumbs";

/**
 * Mail's inbox: messages with their current and suggested labels (ADR 0030).
 * Empty until docs/plans/email-management phase 5 brings it.
 */
const MailInboxPage: React.FunctionComponent = () => {
  return (
    <>
      <MailBreadcrumbs
        trail={[
          <Space key={"page"} size={4}>
            <InboxOutlined />
            <span>Inbox</span>
          </Space>,
        ]}
      />
      <Flex vertical={true} align={"center"} justify={"center"} flex={1}>
        <Empty description={"Mail's inbox is on its way."} />
      </Flex>
    </>
  );
};

export default MailInboxPage;
