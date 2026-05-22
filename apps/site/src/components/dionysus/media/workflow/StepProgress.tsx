import type {
  MediaAssetDownload,
  MediaAssetWorkflowStep,
  MediaAssetWorkflowSubStep,
} from "@ncfritz/olympus-sdk/dionysus";
import { Col, Progress, Row, Space, Typography } from "antd";
import { DateTime } from "luxon";
import prettyMilliseconds from "pretty-ms";
import Timestamp from "../../../data/Timestamp";
import { getDownloadProgressLabel } from "../utils";

export interface StepProgressProps {
  title?: string;
  showTiming?: boolean;
  width?: number;
  step:
    | MediaAssetWorkflowStep
    | MediaAssetWorkflowSubStep
    | MediaAssetDownload
    | undefined;
}

const StepProgress: React.FunctionComponent<StepProgressProps> = ({
  title,
  showTiming = true,
  width = 950,
  step,
}: StepProgressProps) => {
  let elapsedTime = "Unknown";
  let remainingTime = "Unknown";
  let startedTime: DateTime | undefined = undefined;
  let finishedTime: DateTime | undefined = undefined;
  const progressStatus = getDownloadProgressLabel(step?.status || "pending");

  if (step) {
    if (step.finishedTime) {
      startedTime = DateTime.fromISO(step.startedTime!);
      finishedTime = DateTime.fromISO(step.finishedTime);

      elapsedTime = prettyMilliseconds(
        Math.abs(finishedTime.diff(startedTime, "milliseconds").milliseconds),
      );
      remainingTime = prettyMilliseconds(0);
    } else if (step.startedTime) {
      startedTime = DateTime.fromISO(step.startedTime);
      const elapsedMs = Math.abs(
        startedTime.diffNow("milliseconds").milliseconds,
      );
      const remainingMs = ((100 - step.progress) / step.progress) * elapsedMs;
      elapsedTime = prettyMilliseconds(elapsedMs);
      remainingTime = prettyMilliseconds(
        remainingMs === Infinity ? 0 : remainingMs,
      );
    }
  }

  return (
    <Space direction={"vertical"} size={0} style={{ width: "100%" }}>
      {title && (
        <Typography.Text style={{ fontSize: "16px", fontWeight: "bold" }}>
          {title}
        </Typography.Text>
      )}
      <Progress
        style={{ width: width, marginBottom: 8 }}
        percent={step?.progress}
        status={progressStatus}
        format={(value) => `${value?.toFixed(2)}%`}
      />
      {showTiming && (
        <Row gutter={4}>
          <Col span={2} style={{ textAlign: "right" }}>
            <Typography.Text style={{ fontSize: "12px" }} strong={true}>
              Started:
            </Typography.Text>
          </Col>
          <Col span={5}>
            <Timestamp
              value={step?.startedTime}
              showTime={true}
              direction={"horizontal"}
            />
          </Col>
          <Col span={2} style={{ textAlign: "right" }}>
            <Typography.Text style={{ fontSize: "12px" }} strong={true}>
              Finished:
            </Typography.Text>
          </Col>
          <Col span={5}>
            <Timestamp
              value={step?.finishedTime}
              showTime={true}
              direction={"horizontal"}
            />
          </Col>
          <Col span={4} offset={3} style={{ textAlign: "right" }}>
            <Typography.Text style={{ fontSize: "12px" }} strong={true}>
              Remaining:
            </Typography.Text>
          </Col>
          <Col span={2}>{remainingTime}</Col>
          <Col span={2} style={{ textAlign: "right" }}>
            <Typography.Text style={{ fontSize: "12px" }} strong={true}>
              Created:
            </Typography.Text>
          </Col>
          <Col span={5}>
            <Timestamp
              value={step?.createdTime}
              showTime={true}
              direction={"horizontal"}
            />
          </Col>
          <Col span={2} style={{ textAlign: "right" }}>
            <Typography.Text style={{ fontSize: "12px" }} strong={true}>
              Updated:
            </Typography.Text>
          </Col>
          <Col span={5}>
            <Timestamp
              value={step?.lastUpdatedTime}
              showTime={true}
              direction={"horizontal"}
            />
          </Col>
          <Col span={4} offset={3} style={{ textAlign: "right" }}>
            <Typography.Text style={{ fontSize: "12px" }} strong={true}>
              Elapsed:
            </Typography.Text>
          </Col>
          <Col span={2}>{elapsedTime}</Col>
        </Row>
      )}
    </Space>
  );
};
export default StepProgress;
