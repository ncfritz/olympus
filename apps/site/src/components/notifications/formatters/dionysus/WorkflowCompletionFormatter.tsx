import { Button, Space, Typography } from "antd";
import type { CSSProperties, ReactNode } from "react";
import {
  type DionysusWorkflowPayload,
  NotificationFormatter,
} from "../interfaces";

const valueStyle: CSSProperties = {
  fontFamily: "monospace",
  fontSize: "12px",
};

export class WorkflowCompletionFormatter
  implements NotificationFormatter<DionysusWorkflowPayload>
{
  format(
    payload: DionysusWorkflowPayload,
  ): [string | ReactNode, string | ReactNode] {
    const title = (
      <Typography.Text>A metadata workflow has completed</Typography.Text>
    );

    const message = (
      <Space direction={"vertical"} size={8} style={{ width: "100%" }}>
        <Typography.Text>
          Dionysus metadata workflow{" "}
          <Typography.Text style={valueStyle}>
            {payload.workflowId}
          </Typography.Text>{" "}
          has {payload.status === "success" ? "completed" : "failed"}
        </Typography.Text>
        <Button
          size={"small"}
          block={true}
          href={`/dionysus/jobs/workflow?id=${payload.workflowId}`}
        >
          Go to Workflow
        </Button>
      </Space>
    );

    return [title, message];
  }
}
