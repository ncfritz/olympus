import {
  SaveOutlined,
  SendOutlined,
  SyncOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import {
  Button,
  Card,
  Col,
  Empty,
  Form,
  Row,
  Select,
  Slider,
  Space,
  Statistic,
  Typography,
} from "antd";
import { type SubmitHandler, Controller, useForm } from "react-hook-form";
import metadataApi from "../../../api/metadataApi";
import Timestamp from "../../data/Timestamp";
import { getMetadataJobStatusIndicator } from "./utils";
import {
  type MetadataFetchJob,
  type MetadataFetchJobStatus,
} from "@ncfritz/olympus-sdk/dionysus";

interface FormInput {
  ttl: number;
  jitter: number;
  status: MetadataFetchJobStatus;
  republish: boolean;
  bypassCache: boolean;
}

export interface MetadataFetchJobDetailsPanelProps {
  job: MetadataFetchJob;
  close: () => void;
  postUpdate: () => Promise<void>;
}

const MetadataFetchJobDetailsPanel: React.FunctionComponent<
  MetadataFetchJobDetailsPanelProps
> = ({ job, close, postUpdate }: MetadataFetchJobDetailsPanelProps) => {
  if (!job) {
    return <Empty description={"No Metadata Fetch Job Found"} />;
  }

  const {
    handleSubmit,
    control,
    formState: { isValid, isDirty, isSubmitting },
    setValue,
    register,
  } = useForm<FormInput>({
    defaultValues: {
      ttl: job.ttl,
      jitter: job.jitter,
      status: job.status,
      republish: false,
      bypassCache: false,
    },
    mode: "onChange",
    reValidateMode: "onChange",
  });

  const onSubmit: SubmitHandler<FormInput> = async (data) => {
    try {
      await metadataApi.updateMetadataFetchJob(
        job.id,
        job.type,
        {
          status: data.status,
          lastFetchedTime: job.lastFetchedTime,
          ttl: data.ttl,
          jitter: data.jitter,
        },
        data.republish,
        true,
      );

      await postUpdate();
      close();
    } catch (e) {
      console.log("Unable to update the metadata fetch job", e);
    }
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
            styles={{ content: { fontSize: "inherit" } }}
          />
        </Col>
        <Col span={24}>
          <Col span={12}>
            <Statistic
              title={"status"}
              value={job.status}
              formatter={(value: string) => {
                return getMetadataJobStatusIndicator(
                  value as MetadataFetchJobStatus,
                );
              }}
              styles={{ content: { fontSize: "inherit" } }}
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
            styles={{ content: { fontSize: "inherit" } }}
          />
        </Col>
        <Col span={12}>
          <Statistic
            title={"Last Updated Time"}
            value={job.lastUpdatedTime}
            formatter={(value: string) => {
              return <Timestamp value={value} />;
            }}
            styles={{ content: { fontSize: "inherit" } }}
          />
        </Col>
      </Row>
      <Row>
        <Col span={12}>
          <Statistic
            title={"TTL"}
            value={job.ttl}
            styles={{ content: { fontSize: "inherit" } }}
          />
        </Col>
        <Col span={12}>
          <Statistic
            title={"Jitter"}
            value={job.jitter}
            styles={{ content: { fontSize: "inherit" } }}
          />
        </Col>
      </Row>
      <Row>
        <Col span={12}>
          <Statistic
            title={"Last Fetched Time"}
            value={job.lastFetchedTime}
            formatter={(value: string) => {
              return <Timestamp value={value} unknownValue={"Unknown"} />;
            }}
            styles={{ content: { fontSize: "inherit" } }}
          />
        </Col>
        <Col span={12}>
          <Statistic
            title={"Next Fetch Time"}
            value={job.lastFetchedTime}
            formatter={(value: string) => {
              return <Timestamp value={value} unknownValue={"Unknown"} />;
            }}
            styles={{ content: { fontSize: "inherit" } }}
          />
        </Col>
        <Col span={24}>
          <form onSubmit={handleSubmit(onSubmit)}>
            <Card
              title={
                <Space orientation={"horizontal"} size={8}>
                  <WarningOutlined />
                  Danger Zone
                </Space>
              }
              style={{ marginTop: 24, width: "100%" }}
              actions={[
                <Button
                  {...register("republish")}
                  type={"text"}
                  icon={<SaveOutlined />}
                  onClick={() => {
                    setValue("republish", false);
                  }}
                  disabled={!isValid || !isDirty || isSubmitting}
                  loading={isSubmitting}
                  htmlType={"submit"}
                >
                  Update
                </Button>,
                <Button
                  {...register("republish")}
                  type={"text"}
                  icon={<SendOutlined />}
                  onClick={() => {
                    setValue("republish", true);
                  }}
                  disabled={!isValid || !isDirty || isSubmitting}
                  loading={isSubmitting}
                  htmlType={"submit"}
                >
                  Update & Publish
                </Button>,
                <Button
                  {...register("republish")}
                  type={"text"}
                  icon={<SyncOutlined />}
                  onClick={() => {
                    setValue("republish", true);
                  }}
                  disabled={isDirty || isSubmitting}
                  loading={isSubmitting}
                  htmlType={"submit"}
                >
                  Republish
                </Button>,
              ]}
            >
              <Controller
                name={"ttl"}
                control={control}
                rules={{
                  min: {
                    value: 0,
                    message: "TTL cannot be negative",
                  },
                  max: {
                    value: 365,
                    message: "TTL cannot exceed one year",
                  },
                }}
                render={({ field, fieldState }) => (
                  <Form.Item
                    label={"TTL"}
                    validateStatus={fieldState.error ? "error" : undefined}
                    help={
                      fieldState.error ? fieldState.error.message : undefined
                    }
                  >
                    <Slider
                      {...field}
                      min={0}
                      max={365}
                      marks={{
                        0: "0",
                        90: "30",
                        180: "180",
                        270: "270",
                        365: "365",
                      }}
                    />
                  </Form.Item>
                )}
              />
              <Controller
                name={"jitter"}
                control={control}
                rules={{
                  min: {
                    value: 0,
                    message: "Jitter cannot be negative",
                  },
                  max: {
                    value: 5000,
                    message: "Jitter cannot exceed 5000",
                  },
                }}
                render={({ field, fieldState }) => (
                  <Form.Item
                    label={"Jitter"}
                    validateStatus={fieldState.error ? "error" : undefined}
                    help={
                      fieldState.error ? fieldState.error.message : undefined
                    }
                  >
                    <Slider
                      {...field}
                      min={0}
                      max={5000}
                      marks={{
                        0: "0",
                        1000: "1000",
                        2000: "2000",
                        3000: "3000",
                        4000: "4000",
                        5000: "5000",
                      }}
                    />
                  </Form.Item>
                )}
              />
              <Controller
                name={"status"}
                control={control}
                render={({ field, fieldState }) => (
                  <Form.Item
                    label={"Status"}
                    validateStatus={fieldState.error ? "error" : undefined}
                    help={
                      fieldState.error ? fieldState.error.message : undefined
                    }
                  >
                    <Select
                      {...field}
                      style={{ width: 200 }}
                      variant={"borderless"}
                      options={[
                        {
                          value: "fetched",
                          label: getMetadataJobStatusIndicator("fetched", true),
                        },
                        {
                          value: "fetching",
                          label: getMetadataJobStatusIndicator(
                            "fetching",
                            true,
                          ),
                        },
                        {
                          value: "invalidated",
                          label: getMetadataJobStatusIndicator(
                            "invalidated",
                            true,
                          ),
                        },
                        {
                          value: "failed",
                          label: getMetadataJobStatusIndicator("failed", true),
                        },
                        {
                          value: "not_found",
                          label: getMetadataJobStatusIndicator(
                            "not_found",
                            true,
                          ),
                        },
                        {
                          value: "cancelled",
                          label: getMetadataJobStatusIndicator(
                            "cancelled",
                            true,
                          ),
                        },
                        {
                          value: "queued",
                          label: getMetadataJobStatusIndicator("queued", true),
                        },
                      ]}
                    />
                  </Form.Item>
                )}
              />
            </Card>
          </form>
        </Col>
      </Row>
    </Space>
  );
};
export default MetadataFetchJobDetailsPanel;
