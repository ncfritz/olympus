import { BarChartOutlined } from "@ant-design/icons";
import type {
  GetMailStatisticsResponse,
  MailStatisticsRange,
  MailStatisticsScope,
} from "@ncfritz/olympus-sdk/minerva";
import {
  Card,
  Col,
  Empty,
  Flex,
  Row,
  Segmented,
  Space,
  Spin,
  Typography,
} from "antd";
import { DateTime } from "luxon";
import React, { useState } from "react";
import mailApi from "../../../api/mailApi";
import MailBreadcrumbs from "../../../components/minerva/mail/MailBreadcrumbs";
import { MAIL_CHART_COLORS } from "../../../components/minerva/mail/statistics/charts";
import LabelActivityHeatmap from "../../../components/minerva/mail/statistics/LabelActivityHeatmap";
import MailStatisticsStrip from "../../../components/minerva/mail/statistics/MailStatisticsStrip";
import SenderActivityChart from "../../../components/minerva/mail/statistics/SenderActivityChart";
import TopBarChart from "../../../components/minerva/mail/statistics/TopBarChart";
import { useFetch } from "../../../hooks/useFetch";

const { Title, Text } = Typography;

const RANGES: { label: string; value: MailStatisticsRange }[] = [
  { label: "12 months", value: "12m" },
  { label: "3 years", value: "3y" },
  { label: "All time", value: "all" },
];

const SCOPES: { label: string; value: MailStatisticsScope }[] = [
  { label: "All mail", value: "all" },
  { label: "Received", value: "received" },
  { label: "Sent", value: "sent" },
];

const day = (time?: string) =>
  time ? DateTime.fromISO(time).toLocaleString(DateTime.DATE_MED) : "";

/**
 * Mail statistics (docs/plans/email-management phase 2): totals, the
 * busiest senders and labels, and their mail per year, over the range and
 * scope chosen.
 */
const MailStatisticsPage: React.FunctionComponent = () => {
  const [range, setRange] = useState<MailStatisticsRange>("12m");
  const [scope, setScope] = useState<MailStatisticsScope>("all");

  const [statistics, loading] = useFetch<
    { range: MailStatisticsRange; scope: MailStatisticsScope },
    GetMailStatisticsResponse | undefined
  >({
    dataType: "mail statistics",
    params: { range, scope },
    watch: [range, scope],
    fetchFunction: async (p) =>
      (await mailApi.getStatistics(p.range, p.scope)).data,
  });

  const summary = statistics?.summary;
  const empty = !loading && summary !== undefined && summary.messages === 0;

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
      <div
        style={{
          height: "calc(100vh - 92px)",
          overflowX: "hidden",
          overflowY: "auto",
        }}
      >
        <Flex
          justify={"space-between"}
          align={"center"}
          wrap={true}
          gap={12}
          style={{ padding: 16 }}
        >
          <Space align={"baseline"} size={12}>
            <Title level={3} style={{ margin: 0 }}>
              Statistics
            </Title>
            <Text type={"secondary"} style={{ fontSize: 15 }}>
              {summary?.firstReceivedTime
                ? `${day(summary.firstReceivedTime)} – ${day(summary.lastReceivedTime)}`
                : "Your mail at a glance"}
            </Text>
          </Space>
          <Space size={12} wrap={true}>
            <Segmented<MailStatisticsRange>
              options={RANGES}
              value={range}
              onChange={setRange}
            />
            <Segmented<MailStatisticsScope>
              options={SCOPES}
              value={scope}
              onChange={setScope}
            />
          </Space>
        </Flex>
        <MailStatisticsStrip summary={summary} loading={loading} />
        <div style={{ padding: 16 }}>
          {loading && !statistics ? (
            <Flex justify={"center"} style={{ padding: 48 }}>
              <Spin />
            </Flex>
          ) : empty || !statistics ? (
            <Empty
              style={{ padding: 48 }}
              description={"No mail in this range and scope."}
            />
          ) : (
            <Spin spinning={loading}>
              <Row gutter={[16, 16]}>
                <Col xs={24} xl={12}>
                  <Card size={"small"} title={"Top senders"}>
                    <TopBarChart
                      names={statistics.topSenders.map(
                        (s) => s.name ?? s.address,
                      )}
                      messages={statistics.topSenders.map((s) => s.messages)}
                      details={statistics.topSenders.map((s) =>
                        s.name ? s.address : undefined,
                      )}
                    />
                  </Card>
                </Col>
                <Col xs={24} xl={12}>
                  <Card size={"small"} title={"Top labels"}>
                    <TopBarChart
                      names={statistics.topLabels.map((l) => l.name)}
                      messages={statistics.topLabels.map((l) => l.messages)}
                      color={MAIL_CHART_COLORS[1]}
                    />
                  </Card>
                </Col>
                <Col span={24}>
                  <Card
                    size={"small"}
                    title={"Sender activity by year"}
                    extra={
                      <Text type={"secondary"}>The five busiest senders</Text>
                    }
                  >
                    <SenderActivityChart rows={statistics.senderActivity} />
                  </Card>
                </Col>
                <Col span={24}>
                  <Card
                    size={"small"}
                    title={"Label activity by year"}
                    extra={
                      <Text type={"secondary"}>
                        Each label shaded against its busiest year
                      </Text>
                    }
                  >
                    <LabelActivityHeatmap rows={statistics.labelActivity} />
                  </Card>
                </Col>
              </Row>
            </Spin>
          )}
        </div>
      </div>
    </>
  );
};

export default MailStatisticsPage;
