import { Col, Row, Space, Statistic, Typography } from "antd";
import { type SubmitHandler, useForm } from "react-hook-form";
import Timestamp from "../../data/Timestamp";
import type { BatchJobRecord } from "../../layout/jobs/BatchJobPanel";
import { getMetadataJobStatusIndicator } from "./utils";

interface FormInput {
  ttl: number;
  jitter: number;
  status: string;
  republish: boolean;
}

export interface BatchJobDetailsPanelProps {
  job: BatchJobRecord;
  close: () => void;
  postUpdate: () => Promise<void>;
}

const BatchJobDetailsPanel: React.FunctionComponent<
  BatchJobDetailsPanelProps
> = ({ job, close, postUpdate }: BatchJobDetailsPanelProps) => {
  if (!job) {
    return <></>;
  }

  const {
    handleSubmit,
    control,
    formState: { isValid, isDirty, isSubmitting },
    setValue,
    register,
  } = useForm<FormInput>({
    mode: "onChange",
    reValidateMode: "onChange",
  });

  const onSubmit: SubmitHandler<FormInput> = async (data) => {
    try {
      await postUpdate();
      close();
    } catch (e) {}
  };

  return (
    <Space style={{ width: "100%" }} direction={"vertical"} size={8}>
      <Row>
        <Col span={24}>
          <Typography.Title level={4}>Job Details</Typography.Title>
        </Col>
        <Col span={24}>
          <Statistic
            title={"ID"}
            value={job.id}
            valueStyle={{ fontSize: "inherit" }}
          />
        </Col>
        <Col span={24}>
          <Col span={12}>
            <Statistic
              title={"status"}
              value={job.status}
              formatter={(value: string) => {
                return getMetadataJobStatusIndicator(value);
              }}
              valueStyle={{ fontSize: "inherit" }}
            />
          </Col>
        </Col>
        <Col span={24} style={{ marginTop: 24 }}>
          <Typography.Title level={4}>Job Timing</Typography.Title>
        </Col>
        <Col span={12}>
          <Statistic
            title={"Created Time"}
            value={job.createdTime}
            formatter={(value: string) => {
              return <Timestamp value={value} />;
            }}
            valueStyle={{ fontSize: "inherit" }}
          />
        </Col>
        <Col span={12}>
          <Statistic
            title={"Last Updated Time"}
            value={job.lastUpdatedTime}
            formatter={(value: string) => {
              return <Timestamp value={value} />;
            }}
            valueStyle={{ fontSize: "inherit" }}
          />
        </Col>
        <Col span={12}>
          <Statistic
            title={"Started Time"}
            value={job.startedTime}
            formatter={(value: string) => {
              return <Timestamp value={value} />;
            }}
            valueStyle={{ fontSize: "inherit" }}
          />
        </Col>
        <Col span={12}>
          <Statistic
            title={"Finished Time"}
            value={job.finishedTime}
            formatter={(value: string) => {
              return <Timestamp value={value} />;
            }}
            valueStyle={{ fontSize: "inherit" }}
          />
        </Col>
        <Col span={24} style={{ marginTop: 24 }}>
          <Typography.Title level={4}>Records</Typography.Title>
        </Col>
        <Col span={12}>
          <Statistic
            title={"Total Records"}
            value={job.totalRecords}
            valueStyle={{ fontSize: "inherit" }}
          />
        </Col>
        <Col span={12}>
          <Statistic
            title={"Processed Records"}
            value={job.processedRecords}
            valueStyle={{ fontSize: "inherit" }}
          />
        </Col>
        <Col span={12}>
          <Statistic
            title={"Duplicate Records"}
            value={job.duplicateRecords}
            valueStyle={{ fontSize: "inherit" }}
          />
        </Col>
        <Col span={12}>
          <Statistic
            title={"New Records"}
            value={job.newRecords}
            valueStyle={{ fontSize: "inherit" }}
          />
        </Col>
        <Col span={12}>
          <Statistic
            title={"Expired Records"}
            value={job.expiredRecords}
            valueStyle={{ fontSize: "inherit" }}
          />
        </Col>
        <Col span={12}>
          <Statistic
            title={"No-op Records"}
            value={job.noOpRecords}
            valueStyle={{ fontSize: "inherit" }}
          />
        </Col>
        <Col span={24}></Col>
      </Row>
    </Space>
  );
};
export default BatchJobDetailsPanel;
