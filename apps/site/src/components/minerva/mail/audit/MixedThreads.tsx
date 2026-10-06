import { ExportOutlined } from "@ant-design/icons";
import type { MailAuditThread } from "@ncfritz/olympus-sdk/minerva";
import { Table, Typography } from "antd";
import { DateTime } from "luxon";
import React from "react";
import { gmailLink } from "../../../../utils/mailAudit";

const { Text } = Typography;

/** Threads whose messages carry different labels, largest first. */
const MixedThreads: React.FunctionComponent<{ threads: MailAuditThread[] }> = ({
  threads,
}) => (
  <Table<MailAuditThread>
    size={"small"}
    rowKey={"threadId"}
    dataSource={threads}
    pagination={{ pageSize: 10, hideOnSinglePage: true, size: "small" }}
    locale={{ emptyText: "Every thread's messages agree." }}
    columns={[
      {
        title: "Thread",
        dataIndex: "threadId",
        render: (id: string) => (
          <a href={gmailLink(id)} target={"_blank"} rel={"noreferrer"}>
            <Text code={true}>{id}</Text> <ExportOutlined />
          </a>
        ),
      },
      { title: "Messages", dataIndex: "messages", align: "right" },
      { title: "Label sets", dataIndex: "labelSets", align: "right" },
      {
        title: "Last mail",
        dataIndex: "lastReceivedTime",
        render: (t: string) =>
          DateTime.fromISO(t).toLocaleString(DateTime.DATE_MED),
      },
    ]}
  />
);

export default MixedThreads;
