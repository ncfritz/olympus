import {
  CheckCircleOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
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
  Statistic,
  Typography,
} from "antd";
import { DateTime } from "luxon";
import prettyMilliseconds from "pretty-ms";
import type { ItemType } from "rc-collapse/es/interface";
import React, { useState } from "react";
import workflowApi from "../../../api/workflowApi";
import type { Workflow, WorkflowStep } from "@ncfritz/olympus-sdk/dionysus";
import { useFetch } from "../../../hooks/useFetch";
import { JobStatus } from "../../../types/dionysus";
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
    fetchFunction: async (o) => {
      if (o) {
        return (await workflowApi.describeMetadataWorkflow(o)).data.workflow;
      }

      return undefined;
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
  } else {
    const stepItems: ItemType[] = [];

    workflowSteps.forEach((step) => {
      if (!step || !step.job) {
        return;
      }

      const percent =
        step.job.totalRecords && step.job.totalRecords > 0
          ? (step.job.processedRecords! / step.job.totalRecords) * 100
          : 0;

      let status: "normal" | "success" | "exception" = "normal";
      let timing;

      if (step.job.status === JobStatus.SUCCESS) {
        status = "success";
      } else if (
        step.job.status === JobStatus.CANCELLED ||
        step.job.status === JobStatus.FAILED
      ) {
        status = "exception";
      }

      if (step.job.status === JobStatus.STARTED) {
        const startTime = DateTime.fromISO(
          step.job.startedTime as unknown as string,
        );
        const now = DateTime.utc();
        const runningMs = now.diff(startTime).milliseconds;
        const timePerRecord = runningMs / step.job.processedRecords!;
        const remainingEst = Math.ceil(
          (step.job.totalRecords! - step.job.processedRecords!) * timePerRecord,
        );

        console.log(remainingEst);

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
                <Statistic
                  title={"Created Time"}
                  value={step.job.createdTime}
                  formatter={(value: string) => {
                    return <Timestamp value={value} />;
                  }}
                  valueStyle={{ fontSize: "inherit" }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title={"Last Updated Time"}
                  value={step.job.lastUpdatedTime}
                  formatter={(value: string) => {
                    return <Timestamp value={value} />;
                  }}
                  valueStyle={{ fontSize: "inherit" }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title={"Started Time"}
                  value={step.job.startedTime}
                  formatter={(value: string) => {
                    return <Timestamp value={value} />;
                  }}
                  valueStyle={{ fontSize: "inherit" }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title={"Finished Time"}
                  value={step.job.finishedTime}
                  formatter={(value: string) => {
                    return <Timestamp value={value} />;
                  }}
                  valueStyle={{ fontSize: "inherit" }}
                />
              </Col>
            </Row>
            <Row>
              <Col span={6}>
                <Statistic
                  title={"Total Records"}
                  value={step.job.totalRecords}
                  valueStyle={{ fontSize: "inherit" }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title={"Processed Records"}
                  value={step.job.processedRecords}
                  valueStyle={{ fontSize: "inherit" }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title={"Duplicate Records"}
                  value={step.job.duplicateRecords}
                  valueStyle={{ fontSize: "inherit" }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title={"New Records"}
                  value={step.job.newRecords}
                  valueStyle={{ fontSize: "inherit" }}
                />
              </Col>
            </Row>
            <Row>
              <Col span={6}>
                <Statistic
                  title={"Expired Records"}
                  value={step.job.expiredRecords}
                  valueStyle={{ fontSize: "inherit" }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title={"No-Op Records"}
                  value={step.job.noOpRecords}
                  valueStyle={{ fontSize: "inherit" }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title={"Skipped Records"}
                  value={step.job.skippedRecords}
                  valueStyle={{ fontSize: "inherit" }}
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
          <Statistic
            title={"ID"}
            value={workflow.id}
            valueStyle={{ fontSize: "inherit" }}
          />
        </Col>
        <Col span={24}>
          <Col span={12}>
            <Statistic
              title={"status"}
              value={workflow.status}
              formatter={(value: string) => {
                return getBatchJobStatusIndicator(value);
              }}
              valueStyle={{ fontSize: "inherit" }}
            />
          </Col>
        </Col>
        <Col span={24} style={{ marginTop: 24 }}>
          <Typography.Title level={4}>Workflow Timing</Typography.Title>
        </Col>
        <Col span={12}>
          <Statistic
            title={"Created Time"}
            value={workflow.createdTime}
            formatter={(value: string) => {
              return <Timestamp value={value} />;
            }}
            valueStyle={{ fontSize: "inherit" }}
          />
        </Col>
        <Col span={12}>
          <Statistic
            title={"Last Updated Time"}
            value={workflow.lastUpdatedTime}
            formatter={(value: string) => {
              return <Timestamp value={value} />;
            }}
            valueStyle={{ fontSize: "inherit" }}
          />
        </Col>
        <Col span={12}>
          <Statistic
            title={"Started Time"}
            value={workflow.startedTime}
            formatter={(value: string) => {
              return <Timestamp value={value} />;
            }}
            valueStyle={{ fontSize: "inherit" }}
          />
        </Col>
        <Col span={12}>
          <Statistic
            title={"Finished Time"}
            value={workflow.finishedTime}
            formatter={(value: string) => {
              return <Timestamp value={value} />;
            }}
            valueStyle={{ fontSize: "inherit" }}
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
