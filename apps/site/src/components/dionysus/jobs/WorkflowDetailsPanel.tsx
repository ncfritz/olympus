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
  notification,
  Progress,
  Row,
  Space,
  Spin,
  Statistic,
  Typography,
} from "antd";
import { DateTime } from "luxon";
import prettyMilliseconds from "pretty-ms";
import React, { useEffect, useState } from "react";
import workflowApi from "../../../api/workflowApi";
import type { MetadataWorkflow } from "../../../pages/dionysus/jobs/workflow";
import { JobStatus } from "../../../types/dionysus";
import { openNotificationWithIcon } from "../../../utils/notifications";
import RefreshTimer from "../../common/RefreshTimer";
import Timestamp from "../../data/Timestamp";
import { getBatchJobStatusIndicator } from "./utils";

export interface WorkflowDetailsPanelProps {
  workflow?: MetadataWorkflow;
}

const WorkflowDetailsPanel = ({ workflow }: WorkflowDetailsPanelProps) => {
  const [api] = notification.useNotification();

  const [workflowSteps, setWorkflowSteps] = useState<any[] | undefined>(
    undefined,
  );
  const [workflowStepsLoading, setWorkflowStepsLoading] = useState(false);
  const [workflowStepsError, setWorkflowStepsError] = useState<any>(undefined);
  const [activeKeys, setActiveKeys] = useState<string[]>([]);

  const fetchMetadataWorkflowSteps = async (id: string, quiet = false) => {
    setWorkflowStepsError(undefined);

    if (!quiet) {
      setWorkflowStepsLoading(true);
    }

    try {
      const listMetadataWorkflowStepsResponse =
        await workflowApi.listMetadataWorkflowSteps(id);
      setWorkflowSteps(listMetadataWorkflowStepsResponse.data.steps);
    } catch (e) {
      setWorkflowStepsError(e);
      openNotificationWithIcon(
        "error",
        "Unable to load certifications list",
        "Poop",
        api,
      );
    } finally {
      setWorkflowStepsLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      if (workflow) {
        await fetchMetadataWorkflowSteps(workflow?.id);
      } else {
        setWorkflowSteps(undefined);
      }
    })();
  }, [workflow]);

  const updateActivePanels = (keys: string[]) => {
    setActiveKeys(keys);
  };

  if (!workflow) {
    return <Empty description={"No Batch Job Found"} />;
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
    stepsContent = (
      <Collapse
        ghost={true}
        size={"small"}
        activeKey={activeKeys}
        onChange={updateActivePanels}
        items={workflowSteps.map((step) => {
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
              (step.job.totalRecords! - step.job.processedRecords!) *
                timePerRecord,
            );

            timing = (
              <Space size={8}>
                <ReloadOutlined spin={true} />
                <Typography.Text style={{ fontSize: "11px" }}>
                  {prettyMilliseconds(remainingEst, { unitCount: 2 })}
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

          return {
            style: { width: "100%" },
            label: (
              <Row
                gutter={16}
                style={{ alignItems: "center", marginBottom: 8 }}
              >
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
                <Col
                  span={4}
                  style={{ display: "flex", justifyContent: "end" }}
                >
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
          };
        })}
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
                await fetchMetadataWorkflowSteps(workflow?.id);
              }}
            />
          </Space>
        </Col>
        <Col span={24}>
          <RefreshTimer
            ttlMs={30 * 1000}
            fetchFunction={async () => {
              await fetchMetadataWorkflowSteps(workflow?.id, true);
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
