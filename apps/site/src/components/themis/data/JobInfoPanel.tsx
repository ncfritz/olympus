import {
  Button,
  Checkbox,
  Col,
  Empty,
  Form,
  Input,
  Result,
  Row,
  Select,
  Space,
  Spin,
  Typography,
} from "antd";
import React, { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import themisApi from "../../../api/themisApi";
import type { DataSummaryResponse } from "../../../pages/api/themis/user/[username]/data/dataSummary";
import type { JobInfo } from "../../../types/themis";
import { publish } from "../../../utils/events";
import { PUBLISH_EVENT } from "../../common/NotificationSink";
import ImportJobInfoModal from "../form/ImportJobInfoModal";
import type { UserDataTabPanelProps } from "./UserDataTabGroup";

export interface JobInfoPanelProps extends UserDataTabPanelProps {
  dataSummary?: DataSummaryResponse;
}

const JobInfoPanel: React.FunctionComponent<JobInfoPanelProps> = ({
  username,
  year,
  afterSave,
  dataSummary,
}) => {
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [info, setInfo] = useState<JobInfo | undefined>(undefined);
  const [infoLoading, setInfoLoading] = useState(false);
  const [infoError, setInfoError] = useState(false);

  const { handleSubmit, control, reset, watch } = useForm<JobInfo>({
    defaultValues: info,
    mode: "onChange",
    reValidateMode: "onChange",
  });

  const pivotWatch = watch("isInPivot");

  const onSubmit = async (data: JobInfo) => {
    try {
      await themisApi.upsertJobInfo(username, year, data);

      publish(PUBLISH_EVENT, {
        type: "success",
        message: "Job info saved",
        description: "The job info has been successfully saved",
      });

      await afterSave();
    } catch (e) {
      publish(PUBLISH_EVENT, {
        type: "error",
        message: "Failed to save job info",
        description: "Unable to save job info due to a server error",
      });
    }
  };

  const loadJobInfo = async (quiet: boolean = false) => {
    if (!quiet) {
      setInfoLoading(true);
    }

    setInfoError(false);

    try {
      const response = await themisApi.getJobInfo(username, year);
      setInfo(response.jobInfo);
      reset(response.jobInfo);
    } catch (e) {
      setInfoError(true);
    } finally {
      setInfoLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await loadJobInfo(false);
    })();
  }, [username, year]);

  let content;

  if (infoLoading) {
    content = (
      <Space
        style={{
          width: "100%",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Spin size={"small"} />
      </Space>
    );
  } else if (infoError) {
    content = (
      <Result
        status={"error"}
        subTitle={"Unable to retrieve job info, please verify the user exists"}
      />
    );
  } else if (!info) {
    content = <Empty />;
  } else {
    content = (
      <form onSubmit={handleSubmit(onSubmit)}>
        <Row
          gutter={8}
          style={{ display: "flex", alignItems: "center", marginBottom: 8 }}
        >
          <Col span={2}>
            <Typography.Text
              strong={true}
              style={{ display: "flex", justifyContent: "end" }}
            >
              Employee ID:
            </Typography.Text>
          </Col>
          <Col span={4}>
            <Controller
              name={"employeeId"}
              control={control}
              rules={{ required: true }}
              render={({ field, fieldState }) => (
                <Form.Item
                  validateStatus={fieldState.error ? "error" : undefined}
                  help={fieldState.error ? fieldState.error.message : undefined}
                >
                  <Input
                    {...field}
                    placeholder="Employee ID"
                    allowClear={true}
                    data-1p-ignore={true}
                  />
                </Form.Item>
              )}
            />
          </Col>
          <Col span={3}>
            <Typography.Text
              strong={true}
              style={{ display: "flex", justifyContent: "end" }}
            >
              Department ID:
            </Typography.Text>
          </Col>
          <Col span={4}>
            <Controller
              name={"departmentId"}
              control={control}
              rules={{ required: true }}
              render={({ field, fieldState }) => (
                <Form.Item
                  validateStatus={fieldState.error ? "error" : undefined}
                  help={fieldState.error ? fieldState.error.message : undefined}
                >
                  <Input
                    {...field}
                    placeholder="Department ID"
                    allowClear={true}
                    data-1p-ignore={true}
                  />
                </Form.Item>
              )}
            />
          </Col>
          <Col span={3}>
            <Typography.Text
              strong={true}
              style={{ display: "flex", justifyContent: "end" }}
            >
              Manager:
            </Typography.Text>
          </Col>
          <Col span={1} style={{ alignContent: "center" }}>
            <Controller
              name={"isManager"}
              control={control}
              render={({ field }) => <Checkbox {...field} />}
            />
          </Col>
        </Row>
        <Row
          gutter={8}
          style={{ display: "flex", alignItems: "center", marginBottom: 8 }}
        >
          <Col span={2}>
            <Typography.Text
              strong={true}
              style={{ display: "flex", justifyContent: "end" }}
            >
              Title:
            </Typography.Text>
          </Col>
          <Col span={4}>
            <Controller
              name={"title"}
              control={control}
              rules={{ required: true }}
              render={({ field, fieldState }) => (
                <Form.Item
                  validateStatus={fieldState.error ? "error" : undefined}
                  help={fieldState.error ? fieldState.error.message : undefined}
                >
                  <Input
                    {...field}
                    placeholder="Title"
                    allowClear={true}
                    data-1p-ignore={true}
                  />
                </Form.Item>
              )}
            />
          </Col>
          <Col span={3}>
            <Typography.Text
              strong={true}
              style={{ display: "flex", justifyContent: "end" }}
            >
              Department Name:
            </Typography.Text>
          </Col>
          <Col span={4}>
            <Controller
              name={"departmentName"}
              control={control}
              rules={{ required: true }}
              render={({ field, fieldState }) => (
                <Form.Item
                  validateStatus={fieldState.error ? "error" : undefined}
                  help={fieldState.error ? fieldState.error.message : undefined}
                >
                  <Input
                    {...field}
                    placeholder="Department Name"
                    allowClear={true}
                    data-1p-ignore={true}
                  />
                </Form.Item>
              )}
            />
          </Col>
          <Col span={3}>
            <Typography.Text
              strong={true}
              style={{ display: "flex", justifyContent: "end" }}
            >
              Performance Coaching:
            </Typography.Text>
          </Col>
          <Col span={1} style={{ alignContent: "center" }}>
            <Controller
              name={"isUnderPerformanceCoaching"}
              control={control}
              render={({ field }) => (
                <Checkbox {...field} checked={field.value} />
              )}
            />
          </Col>
        </Row>
        <Row
          gutter={8}
          style={{ display: "flex", alignItems: "center", marginBottom: 8 }}
        >
          <Col span={2}>
            <Typography.Text
              strong={true}
              style={{ display: "flex", justifyContent: "end" }}
            >
              Job Title:
            </Typography.Text>
          </Col>
          <Col span={4}>
            <Controller
              name={"jobTitle"}
              control={control}
              rules={{ required: true }}
              render={({ field, fieldState }) => (
                <Form.Item
                  validateStatus={fieldState.error ? "error" : undefined}
                  help={fieldState.error ? fieldState.error.message : undefined}
                >
                  <Input
                    {...field}
                    placeholder="Job Title"
                    allowClear={true}
                    data-1p-ignore={true}
                  />
                </Form.Item>
              )}
            />
          </Col>
          <Col span={3}>
            <Typography.Text
              strong={true}
              style={{ display: "flex", justifyContent: "end" }}
            >
              Promotion Year:
            </Typography.Text>
          </Col>
          <Col span={4}>
            <Controller
              name={"promotionYear"}
              control={control}
              render={({ field, fieldState }) => (
                <Form.Item
                  validateStatus={fieldState.error ? "error" : undefined}
                  help={fieldState.error ? fieldState.error.message : undefined}
                >
                  <Select
                    {...field}
                    value={field.value}
                    style={{ width: "100%" }}
                    options={[
                      { value: null, label: "None" },
                      ...[1, 2, 3, 4].map((value, index) => {
                        return {
                          value: `${parseInt(year) + index}`,
                          label: `${parseInt(year) + index}`,
                        };
                      }),
                    ]}
                  />
                </Form.Item>
              )}
            />
          </Col>
          <Col span={3}>
            <Typography.Text
              strong={true}
              style={{ display: "flex", justifyContent: "end" }}
            >
              In Pivot:
            </Typography.Text>
          </Col>
          <Col span={1} style={{ alignContent: "center" }}>
            <Controller
              name={"isInPivot"}
              control={control}
              render={({ field }) => (
                <Checkbox {...field} checked={field.value} />
              )}
            />
          </Col>
        </Row>
        <Row
          gutter={8}
          style={{ display: "flex", alignItems: "center", marginBottom: 8 }}
        >
          <Col span={2}>
            <Typography.Text
              strong={true}
              style={{ display: "flex", justifyContent: "end" }}
            >
              Level:
            </Typography.Text>
          </Col>
          <Col span={4}>
            <Controller
              name={"level"}
              control={control}
              rules={{ required: true }}
              render={({ field, fieldState }) => (
                <Form.Item
                  validateStatus={fieldState.error ? "error" : undefined}
                  help={fieldState.error ? fieldState.error.message : undefined}
                >
                  <Select
                    {...field}
                    value={field.value}
                    style={{ width: "100%" }}
                    options={[
                      { value: -1, label: "Unknown" },
                      { value: 3, label: "L3" },
                      { value: 4, label: "L4" },
                      { value: 5, label: "L5" },
                      { value: 6, label: "L6" },
                      { value: 7, label: "L7" },
                      { value: 8, label: "L8" },
                    ]}
                  />
                </Form.Item>
              )}
            />
          </Col>
          <Col span={3}>
            <Typography.Text
              strong={true}
              style={{ display: "flex", justifyContent: "end" }}
            >
              Promotion Quarter:
            </Typography.Text>
          </Col>
          <Col span={4}>
            <Controller
              name={"promotionQuarter"}
              control={control}
              render={({ field, fieldState }) => (
                <Form.Item
                  validateStatus={fieldState.error ? "error" : undefined}
                  help={fieldState.error ? fieldState.error.message : undefined}
                >
                  <Select
                    {...field}
                    value={field.value}
                    style={{ width: "100%" }}
                    options={[
                      { value: null, label: "None" },
                      { value: "Q1", label: "Q1" },
                      { value: "Q2", label: "Q2" },
                      { value: "Q3", label: "Q3" },
                      { value: "Q4", label: "Q4" },
                    ]}
                  />
                </Form.Item>
              )}
            />
          </Col>
          {pivotWatch && (
            <Col span={3}>
              <Typography.Text
                strong={true}
                style={{ display: "flex", justifyContent: "end" }}
              >
                Notified of Pivot:
              </Typography.Text>
            </Col>
          )}
          {pivotWatch && (
            <Col span={1} style={{ alignContent: "center" }}>
              <Controller
                name={"isNotifiedOfPivot"}
                control={control}
                render={({ field }) => (
                  <Checkbox {...field} checked={field.value} />
                )}
              />
            </Col>
          )}
        </Row>
        <Row>
          <Col span={6} offset={2}>
            <Button
              type={"primary"}
              htmlType={"submit"}
              style={{ marginRight: 8 }}
            >
              Save
            </Button>
            <Button
              type={"default"}
              style={{ marginRight: 8 }}
              disabled={!dataSummary}
              onClick={() => {
                setImportModalOpen(true);
              }}
            >
              Import
            </Button>
          </Col>
        </Row>
        <ImportJobInfoModal
          isOpen={importModalOpen}
          username={username}
          dataSummary={dataSummary}
          importFunction={async (info) => {
            reset(info);
          }}
          onClose={() => {
            setImportModalOpen(false);
          }}
        />
      </form>
    );
  }

  return <>{content}</>;
};
export default JobInfoPanel;
