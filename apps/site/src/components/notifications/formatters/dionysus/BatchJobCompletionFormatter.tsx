import { Col, Row, Statistic, Typography } from "antd";
import type { CSSProperties, ReactNode } from "react";
import {
  type DionysiusBatchJobPayload,
  NotificationFormatter,
} from "../interfaces";

const valueStyle: CSSProperties = {
  fontFamily: "monospace",
  fontSize: "12px",
};

export class BatchJobCompletionFormatter implements NotificationFormatter<DionysiusBatchJobPayload> {
  format(
    payload: DionysiusBatchJobPayload,
  ): [string | ReactNode, string | ReactNode] {
    const title = (
      <Typography.Text>
        A <Typography.Text italic={true}>{payload.jobType}</Typography.Text> job
        has completed
      </Typography.Text>
    );

    const message = (
      <>
        <Row>
          <Col span={8}>
            <Statistic title={"Total"} value={payload.recordCounts.total} />
          </Col>
        </Row>
        <Row>
          <Col span={8}>
            <Statistic
              title={"Processed"}
              value={payload.recordCounts.processed}
              valueStyle={valueStyle}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title={"New"}
              value={payload.recordCounts.new}
              valueStyle={valueStyle}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title={"Expired"}
              value={payload.recordCounts.expired}
              valueStyle={valueStyle}
            />
          </Col>
        </Row>
        <Row>
          <Col span={8}>
            <Statistic
              title={"Duplicate"}
              value={payload.recordCounts.duplicate}
              valueStyle={valueStyle}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title={"Skipped"}
              value={payload.recordCounts.skipped}
              valueStyle={valueStyle}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title={"No-op"}
              value={payload.recordCounts.noop}
              valueStyle={valueStyle}
            />
          </Col>
        </Row>
      </>
    );

    return [title, message];
  }
}
