import { ReloadOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  Col,
  Empty,
  notification,
  Progress,
  Row,
  Space,
  Spin,
  Statistic,
  Steps,
  Timeline,
  Typography,
} from "antd";
import React, { useEffect, useState } from "react";
import workflowApi from "../../../api/workflowApi";
import type { MetadataWorkflow } from "../../../pages/dionysus/jobs/workflow";
import { openNotificationWithIcon } from "../../../utils/notifications";
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

  const fetchMetadataWorkflowSteps = async (id: string, quiet = false) => {
    setWorkflowStepsError(undefined);
    setWorkflowStepsLoading(true);

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

  if (!workflow) {
    return <Empty description={"No Batch Job Found"} />;
  }

  let stepsContent = <></>;

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
      <Steps
        className={"workflowSteps"}
        direction={"vertical"}
        size={"small"}
        progressDot={true}
        current={workflowSteps.length}
        items={workflowSteps.map((step) => {
          return {
            style: { width: "100%" },
            title: (
              <Row gutter={16} style={{ alignItems: "center" }}>
                <Col span={7}>{step.job.type}</Col>
                <Col span={13}>
                  <Progress
                    status={"normal"}
                    percent={
                      (step.job.processedRecords / step.job.totalRecords) * 100
                    }
                    size={"small"}
                    style={{ paddingRight: 30 }}
                    format={(percent) => {
                      return percent
                        ? `${percent.toLocaleString(undefined, {
                            maximumFractionDigits: 1,
                          })}%`
                        : "";
                    }}
                  />
                </Col>
                <Col
                  span={4}
                  style={{ display: "flex", justifyContent: "end" }}
                >
                  {getBatchJobStatusIndicator(step.job.status)}
                </Col>
              </Row>
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
          <Space style={{ width: "100%" }} styles={{ item: { width: "100%" } }}>
            {stepsContent}
          </Space>
        </Col>
      </Row>
    </Space>
  );
};
export default WorkflowDetailsPanel;
