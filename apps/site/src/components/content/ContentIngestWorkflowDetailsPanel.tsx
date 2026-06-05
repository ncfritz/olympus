import {
  CheckCircleOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import type { ItemType } from "@rc-component/collapse/lib/interface";
import {
  Alert,
  Button,
  Col,
  Collapse,
  Empty,
  Progress,
  Row,
  Space,
  Spin,
  Typography,
} from "antd";
import { DateTime } from "luxon";
import prettyMilliseconds from "pretty-ms";
import React, { useState } from "react";
import type { ContentIngestionWorkflow } from "@ncfritz/olympus-sdk/dionysus";
import contentApi from "../../api/contentApi";
import { useFetch } from "../../hooks/useFetch";
import Description from "../common/Description";
import RefreshTimer from "../common/RefreshTimer";
import Timestamp from "../data/Timestamp";
import {
  getContentIngestionWorkflowStatusIndicator,
  getContentIngestionWorkflowStepStatusIndicator,
} from "./util";

export interface WorkflowDetailsPanelProps {
  workflowId?: string;
}

const ContentIngestionWorkflowDetailsPanel = ({
  workflowId,
}: WorkflowDetailsPanelProps) => {
  const [activeKeys, setActiveKeys] = useState<string[]>([]);

  const [workflow, workflowLoading, workflowError, fetchWorkflow] = useFetch<
    string,
    ContentIngestionWorkflow | undefined
  >({
    dataType: "content ingestion workflow",
    default: undefined,
    watch: [workflowId],
    params: workflowId as string,
    fetchFunction: async (o) => {
      if (o) {
        return (await contentApi.describeContentIngestionWorkflow(o)).data
          .workflow;
      }

      return undefined;
    },
  });

  const updateActivePanels = (keys: string[]) => {
    setActiveKeys(keys);
  };

  if (!workflow) {
    return <Empty description={"No Workflow Found"} />;
  }

  let stepsContent;

  if (workflowLoading) {
    stepsContent = <Spin size={"large"} />;
  } else if (workflowError) {
    stepsContent = (
      <Alert
        message="Error"
        description="An error occurred while fetching the workflow"
        type="error"
        showIcon
      />
    );
  } else if (workflow.steps.length <= 0) {
    stepsContent = <Empty description={"No workflow steps found"} />;
  } else {
    const stepItems: ItemType[] = [];

    workflow.steps.forEach((step) => {
      let status: "success" | "exception" | "normal" | "active" | undefined;
      let timing;

      if (step.status === "success") {
        status = "success";
      } else if (step.status === "failed") {
        status = "exception";
      }

      if (step.status === "running") {
        const startTime = DateTime.fromISO(
          step.startedTime as unknown as string,
        );
        const now = DateTime.utc();
        const runningMs = now.diff(startTime).milliseconds;
        const timePerPercent = runningMs / step.progress!;
        const remainingEst = Math.ceil((100 - step.progress) * timePerPercent);

        timing = (
          <Space size={8}>
            <ReloadOutlined spin={true} />
            <Typography.Text style={{ fontSize: "11px" }}>
              {remainingEst === Infinity ||
              remainingEst === -Infinity ||
              isNaN(remainingEst)
                ? "∞ Unknown"
                : prettyMilliseconds(remainingEst, { unitCount: 2 })}
            </Typography.Text>
          </Space>
        );
      } else {
        const startTime = DateTime.fromISO(
          step.startedTime as unknown as string,
        );

        if (!step.finishedTime) {
          timing = (
            <Space size={8}>
              <QuestionCircleOutlined />
              <Typography.Text style={{ fontSize: "11px" }}>
                Unknown
              </Typography.Text>
            </Space>
          );
        } else {
          const endTime = DateTime.fromISO(
            step.finishedTime as unknown as string,
          );
          const runtimeMs = endTime.diff(startTime).milliseconds;
          timing = (
            <Space size={8}>
              <CheckCircleOutlined />
              <Typography.Text style={{ fontSize: "11px" }}>
                {isNaN(runtimeMs)
                  ? "Unknown"
                  : prettyMilliseconds(runtimeMs, { unitCount: 2 })}
              </Typography.Text>
            </Space>
          );
        }
      }

      stepItems.push({
        style: { width: "100%" },
        label: (
          <Row gutter={16} style={{ alignItems: "center", marginBottom: 8 }}>
            <Col span={7}>{step.type}</Col>
            <Col span={8}>
              <Progress
                size={"small"}
                percent={Math.abs(step.progress)}
                format={(percent) => {
                  return `${percent?.toFixed(2)}%`;
                }}
                status={status}
              />
            </Col>
            <Col span={5}>{timing}</Col>
            <Col span={4} style={{ display: "flex", justifyContent: "end" }}>
              {getContentIngestionWorkflowStepStatusIndicator(step.status)}
            </Col>
          </Row>
        ),
        children: (
          <Space
            direction={"vertical"}
            style={{
              width: "100%",
              marginLeft: 28,
              marginTop: 0,
              marginBottom: 16,
              paddingLeft: 16,
              borderLeft: "4px solid #ededed",
            }}
          >
            <Row>
              <Col span={6}>
                <Description
                  title={"Created Time"}
                  value={<Timestamp value={step.createdTime} showTime={true} />}
                  valueStyle={{ fontSize: "inherit" }}
                  titleColor={"#666666"}
                  titleFontSize={"13px"}
                />
              </Col>
              <Col span={6}>
                <Description
                  title={"Last Updated Time"}
                  value={
                    <Timestamp value={step.lastUpdatedTime} showTime={true} />
                  }
                  valueStyle={{ fontSize: "inherit" }}
                  titleColor={"#666666"}
                  titleFontSize={"13px"}
                />
              </Col>
              <Col span={6}>
                <Description
                  title={"Started Time"}
                  value={<Timestamp value={step.startedTime} showTime={true} />}
                  valueStyle={{ fontSize: "inherit" }}
                  titleColor={"#666666"}
                  titleFontSize={"13px"}
                />
              </Col>
              <Col span={6}>
                <Description
                  title={"Finished Time"}
                  value={
                    <Timestamp value={step.finishedTime} showTime={true} />
                  }
                  valueStyle={{ fontSize: "inherit" }}
                  titleColor={"#666666"}
                  titleFontSize={"13px"}
                />
              </Col>
            </Row>
          </Space>
        ),
      });
    });

    stepsContent = (
      <Collapse
        ghost={true}
        size={"small"}
        activeKey={activeKeys}
        onChange={updateActivePanels}
        items={stepItems}
      />
    );
  }

  return (
    <Space style={{ width: "100%" }} direction={"vertical"} size={8}>
      <Row>
        <Col span={24}>
          <Typography.Title level={4}>Workflow Details</Typography.Title>
        </Col>
        <Col span={24}>
          <Description
            title={"ID"}
            value={workflow.id}
            valueStyle={{ fontSize: "inherit" }}
            titleColor={"#666666"}
          />
        </Col>
        <Col span={24}>
          <Col span={12}>
            <Description
              title={"status"}
              value={getContentIngestionWorkflowStatusIndicator(
                workflow.status,
              )}
              valueStyle={{ fontSize: "inherit" }}
              titleColor={"#666666"}
            />
          </Col>
        </Col>
        <Col span={24} style={{ marginTop: 24 }}>
          <Typography.Title level={4}>Workflow Timing</Typography.Title>
        </Col>
        <Col span={12}>
          <Description
            title={"Created Time"}
            value={<Timestamp value={workflow.createdTime} showTime={true} />}
            valueStyle={{ fontSize: "inherit" }}
            titleColor={"#666666"}
          />
        </Col>
        <Col span={12}>
          <Description
            title={"Last Updated Time"}
            value={
              <Timestamp value={workflow.lastUpdatedTime} showTime={true} />
            }
            valueStyle={{ fontSize: "inherit" }}
            titleColor={"#666666"}
          />
        </Col>
        <Col span={12}>
          <Description
            title={"Started Time"}
            value={<Timestamp value={workflow.startedTime} showTime={true} />}
            valueStyle={{ fontSize: "inherit" }}
            titleColor={"#666666"}
          />
        </Col>
        <Col span={12}>
          <Description
            title={"Finished Time"}
            value={<Timestamp value={workflow.finishedTime} showTime={true} />}
            valueStyle={{ fontSize: "inherit" }}
            titleColor={"#666666"}
          />
        </Col>
      </Row>
      <Row>
        <Col span={24} style={{ marginTop: 24 }}>
          <Space
            size={0}
            style={{ width: "100%", justifyContent: "space-between" }}
          >
            <Typography.Title level={4}>Workflow Steps</Typography.Title>
            <Button
              type={"text"}
              disabled={workflowLoading}
              icon={<ReloadOutlined />}
              onClick={async () => {
                await fetchWorkflow(false);
              }}
            />
          </Space>
        </Col>
        <Col span={24}>
          <RefreshTimer
            ttlMs={30 * 1000}
            fetchFunction={async () => {
              await fetchWorkflow(true);
            }}
            disabled={
              workflow.status === "success" || workflow.status === "failed"
            }
          />
          <Space
            style={{ width: "100%", marginTop: 8 }}
            styles={{ item: { width: "100%" } }}
          >
            {stepsContent}
          </Space>
        </Col>
      </Row>
    </Space>
  );
};
export default ContentIngestionWorkflowDetailsPanel;
