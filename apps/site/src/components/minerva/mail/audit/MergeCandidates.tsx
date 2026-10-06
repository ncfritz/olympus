import { ArrowRightOutlined, MergeOutlined } from "@ant-design/icons";
import type { MailAuditMerge } from "@ncfritz/olympus-sdk/minerva";
import {
  Button,
  Card,
  Col,
  Empty,
  Flex,
  Row,
  Space,
  Tag,
  Typography,
} from "antd";
import { DateTime } from "luxon";
import React, { useState } from "react";
import { percent } from "../../../../utils/mailAudit";
import MergeLabelsDialog from "../MergeLabelsDialog";

const { Text } = Typography;

const lastMail = (time?: string) =>
  time ? DateTime.fromISO(time).toFormat("LLL yyyy") : "never";

/**
 * Labels the audit proposes as one, each as a card: from → into, why, the
 * senders they share and the mail that would move, and Preview merge,
 * which opens the merge dialog on the pair (phase 4). Any two labels can
 * be merged from Merge labels.
 */
const MergeCandidates: React.FunctionComponent<{
  merges: MailAuditMerge[];
  /** Every user label, for the dialog's choices. */
  labels: string[];
}> = ({ merges, labels }) => {
  const [pair, setPair] = useState<{ from?: string; into?: string }>();
  const dialog = (
    <MergeLabelsDialog
      open={Boolean(pair)}
      onClose={() => setPair(undefined)}
      labels={labels}
      from={pair?.from}
      into={pair?.into}
    />
  );
  const mergeAny = (
    <Flex justify={"flex-end"} style={{ marginBottom: 12 }}>
      <Button icon={<MergeOutlined />} onClick={() => setPair({})}>
        Merge labels…
      </Button>
    </Flex>
  );
  return merges.length === 0 ? (
    <>
      {mergeAny}
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={"No labels look like one."}
      />
      {dialog}
    </>
  ) : (
    <>
      {mergeAny}
      <Row gutter={[12, 12]}>
        {merges.map((m) => (
          <Col
            key={`${m.fromLabel}\u0000${m.intoLabel}`}
            xs={24}
            lg={12}
            xxl={8}
          >
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
                <Button
                  size={"small"}
                  icon={<MergeOutlined />}
                  onClick={() =>
                    setPair({ from: m.fromLabel, into: m.intoLabel })
                  }
                >
                  Preview merge
                </Button>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>
      {dialog}
    </>
  );
};

export default MergeCandidates;
