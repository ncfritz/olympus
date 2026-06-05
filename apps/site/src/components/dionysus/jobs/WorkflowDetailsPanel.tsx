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
import workflowApi from "../../../api/workflowApi";
import type { Workflow, WorkflowStep } from "@ncfritz/olympus-sdk/dionysus";
import { useFetch } from "../../../hooks/useFetch";
import Description from "../../common/Description";
import RefreshTimer from "../../common/RefreshTimer";
import Timestamp from "../../data/Timestamp";
import { getBatchJobStatusIndicator } from "./utils";

export interface WorkflowDetailsPanelProps {
  workflowId?: string;
}

const WorkflowDetailsPanel = ({ workflowId }: WorkflowDetailsPanelProps) => {
  const [activeKeys, setActiveKeys] = useState<string[]>([]);

  const [workflow, workflowLoading, workflowError] = useFetch<
    string,
    Workflow | undefined
  >({
    dataType: "metadata workflow",
    default: undefined,
    watch: [workflowId],
    params: workflowId as string,
    validateOptions: (o) => o !== undefined,
    fetchFunction: async (o) => {
      return (await workflowApi.describeMetadataWorkflow(o)).data.workflow;
    },
  });

  const [
    workflowSteps,
    workflowStepsLoading,
    workflowStepsError,
    fetchWorkflowSteps,
  ] = useFetch<Workflow | undefined, WorkflowStep[] | undefined>({
    dataType: "metadata workflow steps",
    default: undefined,
    watch: [workflow],
    params: workflow,
    fetchFunction: async (o) => {
      if (o) {
        return (await workflowApi.listMetadataWorkflowSteps(o.id)).data.steps;
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

  if (workflowStepsLoading) {
    stepsContent = <Spin size={"large"} />;
  } else if (workflowStepsError) {
    stepsContent = (
      <Alert
        message="Error"
        description="An error occurred while fetching workflow steps"
        type="error"
        showIcon
      />
    );
  } else if (!workflowSteps || workflowSteps.length <= 0) {
    stepsContent = <Empty description={"No workflow steps found"} />;
  } else {2
    const stepItems: ItemType[] = [];

    workflowSteps.forEach((step) => {
      if (!step || !step.job) {
        return;
      }

      const percent =
        step.job.totalRecords && step.job.totalRecords > 0
          ? (step.job.processedRecords! / step.job.totalRecords) * 100
          : 0;

      let status: "success" | "exception" | "normal" | "active" | undefined;
      let timing;

      if (step.job.status === "success") {
        status = "success";
      } else if (
        step.job.status === "cancelled" ||
        step.job.status === "failed"
      ) {
        status = "exception";
      }

      if (step.job.status === "started") {
        const startTime = DateTime.fromISO(
          step.job.startedTime as unknown as string,
        );
        const now = DateTime.utc();
        const runningMs = now.diff(startTime).milliseconds;
        const timePerRecord = runningMs / step.job.processedRecords!;
        const remainingEst = Math.ceil(
          (step.job.totalRecords! - step.job.processedRecords!) * timePerRecord,
        );

        timing = (
          <Space size={8}>
            <ReloadOutlined spin={true} />
            <Typography.Text style={{ fontSize: "11px" }}>
              {remainingEst === Infinity
                ? "∞ Unknown"
                : prettyMilliseconds(remainingEst, { unitCount: 2 })}
            </Typography.Text>
          </Space>
        );
      } else {
        const startTime = DateTime.fromISO(
          step.job.startedTime as unknown as string,
        );

        if (!step.job.finishedTime) {
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
            step.job.finishedTime as unknown as string,
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
            <Col span={6}>{step.job.type}</Col>
            <Col span={9}>
              <Progress
                size={"small"}
                percent={Math.abs(percent)}
                format={(percent) => {
                  return `${percent?.toFixed(2)}%`;
                }}
                status={status}
              />
            </Col>
            <Col span={5}>{timing}</Col>
            <Col span={4} style={{ display: "flex", justifyContent: "end" }}>
              {getBatchJobStatusIndicator(step.job.status)}
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
                  value={
                    <Timestamp value={step.job.createdTime} showTime={true} />
                  }
                  valueStyle={{ fontSize: "inherit" }}
                  titleColor={"#666666"}
                  titleFontSize={"13px"}
                />
              </Col>
              <Col span={6}>
                <Description
                  title={"Last Updated Time"}
                  value={
                    <Timestamp
                      value={step.job.lastUpdatedTime}
                      showTime={true}
                    />
                  }
                  valueStyle={{ fontSize: "inherit" }}
                  titleColor={"#666666"}
                  titleFontSize={"13px"}
                />
              </Col>
              <Col span={6}>
                <Description
                  title={"Started Time"}
                  value={
                    <Timestamp value={step.job.startedTime} showTime={true} />
                  }
                  valueStyle={{ fontSize: "inherit" }}
                  titleColor={"#666666"}
                  titleFontSize={"13px"}
                />
              </Col>
              <Col span={6}>
                <Description
                  title={"Finished Time"}
                  value={
                    <Timestamp value={step.job.finishedTime} showTime={true} />
                  }
                  valueStyle={{ fontSize: "inherit" }}
                  titleColor={"#666666"}
                  titleFontSize={"13px"}
                />
              </Col>
            </Row>
            <Row>
              <Col span={6}>
                <Description
                  title={"Total Records"}
                  value={step.job.totalRecords?.toLocaleString()}
                  valueStyle={{ fontFamily: "monospace" }}
                  titleColor={"#666666"}
                  titleFontSize={"13px"}
                />
              </Col>
              <Col span={6}>
                <Description
                  title={"Processed Records"}
                  value={step.job.processedRecords?.toLocaleString()}
                  valueStyle={{ fontFamily: "monospace" }}
                  titleColor={"#666666"}
                  titleFontSize={"13px"}
                />
              </Col>
              <Col span={6}>
                <Description
                  title={"Duplicate Records"}
                  value={step.job.duplicateRecords?.toLocaleString()}
                  valueStyle={{ fontFamily: "monospace" }}
                  titleColor={"#666666"}
                  titleFontSize={"13px"}
                />
              </Col>
              <Col span={6}>
                <Description
                  title={"New Records"}
                  value={step.job.newRecords?.toLocaleString()}
                  valueStyle={{ fontFamily: "monospace" }}
                  titleColor={"#666666"}
                  titleFontSize={"13px"}
                />
              </Col>
            </Row>
            <Row>
              <Col span={6}>
                <Description
                  title={"Expired Records"}
                  value={step.job.expiredRecords?.toLocaleString()}
                  valueStyle={{ fontFamily: "monospace" }}
                  titleColor={"#666666"}
                  titleFontSize={"13px"}
                />
              </Col>
              <Col span={6}>
                <Description
                  title={"No-Op Records"}
                  value={step.job.noOpRecords?.toLocaleString()}
                  valueStyle={{ fontFamily: "monospace" }}
                  titleColor={"#666666"}
                  titleFontSize={"13px"}
                />
              </Col>
              <Col span={6}>
                <Description
                  title={"Skipped Records"}
                  value={step.job.skippedRecords?.toLocaleString()}
                  valueStyle={{ fontFamily: "monospace" }}
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
              value={getBatchJobStatusIndicator(workflow.status)}
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
              disabled={workflowStepsLoading}
              icon={<ReloadOutlined />}
              onClick={async () => {
                await fetchWorkflowSteps(false);
              }}
            />
          </Space>
        </Col>
        <Col span={24}>
          <RefreshTimer
            ttlMs={30 * 1000}
            fetchFunction={async () => {
              await fetchWorkflowSteps(true);
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
export default WorkflowDetailsPanel;
