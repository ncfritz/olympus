import { ArrowRightOutlined } from "@ant-design/icons";
import type { MailAuditMerge } from "@ncfritz/olympus-sdk/minerva";
import { Card, Col, Empty, Row, Space, Tag, Typography } from "antd";
import { DateTime } from "luxon";
import React from "react";
import { percent } from "../../../../utils/mailAudit";

const { Text } = Typography;

const lastMail = (time?: string) =>
  time ? DateTime.fromISO(time).toFormat("LLL yyyy") : "never";

/**
 * Labels the audit proposes as one, each as a card: from → into, why, the
 * senders they share and the mail that would move. Merging comes with
 * phase 4; these only say what to look at.
 */
const MergeCandidates: React.FunctionComponent<{
  merges: MailAuditMerge[];
}> = ({ merges }) =>
  merges.length === 0 ? (
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={"No labels look like one."}
    />
  ) : (
    <Row gutter={[12, 12]}>
      {merges.map((m) => (
        <Col key={`${m.fromLabel}\u0000${m.intoLabel}`} xs={24} lg={12} xxl={8}>
          <Card size={"small"}>
            <Space direction={"vertical"} size={6} style={{ width: "100%" }}>
              <Space wrap={true} size={6}>
                <Tag>{m.fromLabel}</Tag>
                <ArrowRightOutlined />
                <Tag color={"green"}>{m.intoLabel}</Tag>
              </Space>
              <Space size={4} wrap={true}>
                <Tag color={"purple"}>
                  {m.reason === "same_leaf"
                    ? "duplicated root"
                    : "shared senders"}
                </Tag>
                <Text type={"secondary"}>
                  {percent(m.senderOverlap)} of its{" "}
                  {m.fromSenders.toLocaleString()} senders shared
                </Text>
              </Space>
              <Text>
                {m.fromMessages.toLocaleString()} messages would move into{" "}
                {m.intoMessages.toLocaleString()}.
              </Text>
              <Text type={"secondary"} style={{ fontSize: 12 }}>
                Last mail: {m.fromLabel} {lastMail(m.fromLastReceivedTime)} ·{" "}
                {m.intoLabel} {lastMail(m.intoLastReceivedTime)}
              </Text>
            </Space>
          </Card>
        </Col>
      ))}
    </Row>
  );

export default MergeCandidates;
