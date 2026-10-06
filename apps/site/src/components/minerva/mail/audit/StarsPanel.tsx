import type { MailStarStatistics } from "@ncfritz/olympus-sdk/minerva";
import { Col, Row, Statistic, Table, Typography } from "antd";
import React from "react";

const count = (n: number) => n.toLocaleString();

const { Text } = Typography;

const AGES: Record<string, string> = {
  month: "Starred, this month",
  year: "Starred, this year",
  older: "Starred, older",
};

/**
 * Stars over the mail: how old the starred mail is (an old star is often
 * an attention star never cleared), where stars gather, and near-identical
 * mail starred and not. Takeout keeps no star icon, so these are stars of
 * any kind until the account is linked.
 */
const StarsPanel: React.FunctionComponent<{ stars: MailStarStatistics }> = ({
  stars,
}) => (
  <Row gutter={[16, 16]}>
    {stars.ages.map((a) => (
      <Col key={a.age} xs={8}>
        <Statistic title={AGES[a.age] ?? a.age} value={a.starred} />
      </Col>
    ))}
    <Col xs={24} xl={12}>
      <Text strong={true}>By label</Text>
      <Table
        size={"small"}
        rowKey={"name"}
        pagination={false}
        dataSource={stars.labels}
        locale={{ emptyText: "No starred mail under a label." }}
        columns={[
          { title: "Label", dataIndex: "name" },
          {
            title: "Starred",
            dataIndex: "starred",
            align: "right",
            render: count,
          },
          { title: "Of", dataIndex: "messages", align: "right", render: count },
        ]}
      />
    </Col>
    <Col xs={24} xl={12}>
      <Text strong={true}>By sender</Text>
      <Table
        size={"small"}
        rowKey={"address"}
        pagination={false}
        dataSource={stars.senders}
        locale={{ emptyText: "No starred mail." }}
        columns={[
          { title: "Sender", dataIndex: "address" },
          {
            title: "Starred",
            dataIndex: "starred",
            align: "right",
            render: count,
          },
          { title: "Of", dataIndex: "messages", align: "right", render: count },
        ]}
      />
    </Col>
    <Col span={24}>
      <Text strong={true}>Alike, starred and not</Text>{" "}
      <Text type={"secondary"}>
        Mail from one sender with the same subject but for its numbers
      </Text>
      <Table
        size={"small"}
        rowKey={(r) => `${r.address}\u0000${r.subjectPattern}`}
        pagination={false}
        dataSource={stars.mixed}
        locale={{ emptyText: "Stars are consistent." }}
        columns={[
          { title: "Sender", dataIndex: "address" },
          { title: "Subject", dataIndex: "subjectPattern" },
          {
            title: "Starred",
            dataIndex: "starred",
            align: "right",
            render: count,
          },
          { title: "Of", dataIndex: "messages", align: "right", render: count },
        ]}
      />
    </Col>
  </Row>
);

export default StarsPanel;
