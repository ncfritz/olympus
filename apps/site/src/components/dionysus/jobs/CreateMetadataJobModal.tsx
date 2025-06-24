const DynamicReactJson = dynamic(import("react-json-view"), { ssr: false });
import {
  Button,
  Form,
  Input,
  Modal,
  Select,
  Slider,
  Space,
  Switch,
} from "antd";
import dynamic from "next/dynamic";
import { Controller, type SubmitHandler, useForm } from "react-hook-form";
import metadataApi from "../../../api/metadataApi";
import { publish } from "../../../utils/events";
import { PUBLISH_EVENT } from "../../common/NotificationSink";
import MetadataJobStatusSelect from "./MetadataJobStatusSelect";

interface FormInput {
  type: string;
  status: string;
  id: string;
  publish: boolean;
  bypassCache: boolean;
  ttl: number;
  jitter: number;
  context: Record<any, any>;
}

export interface CreateMetadataJobModalProps {
  open: boolean;
  onClose: () => void;
}

const rowProps = {
  labelCol: { span: 4 },
  wrapperCol: { span: 19 },
};

const CreateMetadataJobModal: React.FunctionComponent<
  CreateMetadataJobModalProps
> = ({ open, onClose }: CreateMetadataJobModalProps) => {
  const {
    handleSubmit,
    control,
    reset,
    formState: { isValid, isDirty, isSubmitting },
  } = useForm<FormInput>({
    defaultValues: {
      type: undefined,
      ttl: 3,
      jitter: 1500,
      status: "queued",
      publish: true,
      bypassCache: true,
    },
    mode: "onChange",
    reValidateMode: "onChange",
  });

  const onSubmit: SubmitHandler<FormInput> = async (data) => {
    console.log("data", data);

    await metadataApi.createMetadataFetchJob(
      data.id,
      data.type,
      data.status,
      data.ttl,
      data.jitter,
      data.publish,
      data.bypassCache,
      data.context,
    );

    try {
      publish(PUBLISH_EVENT, {
        type: "success",
        message: "Job created",
        description: "Metadata fetch job successfully created",
      });

      closeModal();
    } catch (e) {
      publish(PUBLISH_EVENT, {
        type: "error",
        message: "Unable to create job",
        description: "The API call to /v1/jobs/metadata failed",
      });
    }
  };

  const closeModal = () => {
    onClose();
    reset();
  };

  return (
    <Modal
      title={"Create Metadata Fetch Job"}
      onCancel={closeModal}
      open={open}
      width={800}
      footer={() => {
        return (
          <Space
            size={8}
            direction={"horizontal"}
            style={{
              width: "100%",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Button type={"primary"} danger={true} onClick={closeModal}>
              Cancel
            </Button>
            <Space size={8} direction={"horizontal"}>
              <Button
                htmlType={"submit"}
                type={"primary"}
                disabled={!isValid && !isSubmitting}
                onClick={async () => {
                  await handleSubmit(onSubmit)();
                }}
              >
                Create Job
              </Button>
            </Space>
          </Space>
        );
      }}
    >
      <form onSubmit={handleSubmit(onSubmit)}>
        <Space
          size={4}
          direction={"vertical"}
          style={{ width: "100%" }}
          styles={{ item: { width: "100%" } }}
        >
          <Controller
            name={"id"}
            control={control}
            rules={{
              required: true,
            }}
            render={({ field, fieldState }) => (
              <Form.Item
                {...rowProps}
                label={"ID"}
                validateStatus={fieldState.error ? "error" : undefined}
                help={fieldState.error ? fieldState.error.message : undefined}
              >
                <Input {...field} style={{ width: 350 }} />
              </Form.Item>
            )}
          />
          <Controller
            name={"type"}
            control={control}
            rules={{
              required: true,
            }}
            render={({ field, fieldState }) => (
              <Form.Item
                {...rowProps}
                label={"Job Type"}
                validateStatus={fieldState.error ? "error" : undefined}
                help={fieldState.error ? fieldState.error.message : undefined}
              >
                <Select
                  {...field}
                  style={{ width: 350 }}
                  size={"small"}
                  options={[
                    { label: "Languages", value: "languages" },
                    { label: "Countries", value: "countries" },
                    { label: "Genres", value: "genres" },
                    {
                      label: "Certifications",
                      value: "certifications",
                    },
                    {
                      label: "Production Companies",
                      value: "production_companies",
                    },
                    { label: "Keywords", value: "keywords" },
                    { label: "Collections", value: "collections" },
                    { label: "People", value: "people" },
                    { label: "TV Networks", value: "tv_networks" },
                    { label: "TV Episodes", value: "tv_episodes" },
                    { label: "TV Seasons", value: "tv_seasons" },
                    { label: "TV Series", value: "tv_series" },
                    { label: "Movies", value: "movies" },
                  ]}
                />
              </Form.Item>
            )}
          />
          <Controller
            name={"status"}
            control={control}
            rules={{
              required: true,
            }}
            render={({ field, fieldState }) => (
              <Form.Item
                {...rowProps}
                label={"Job Status"}
                validateStatus={fieldState.error ? "error" : undefined}
                help={fieldState.error ? fieldState.error.message : undefined}
              >
                <MetadataJobStatusSelect
                  value={field.value}
                  onChange={field.onChange}
                  style={{ width: 350 }}
                  bordered={true}
                />
              </Form.Item>
            )}
          />
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
                {...rowProps}
                label={"TTL"}
                validateStatus={fieldState.error ? "error" : undefined}
                help={fieldState.error ? fieldState.error.message : undefined}
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
                {...rowProps}
                label={"Jitter"}
                validateStatus={fieldState.error ? "error" : undefined}
                help={fieldState.error ? fieldState.error.message : undefined}
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
            name={"publish"}
            control={control}
            render={({ field, fieldState }) => (
              <Form.Item {...rowProps} label={"Publish"}>
                <Switch {...field} />
              </Form.Item>
            )}
          />
          <Controller
            name={"bypassCache"}
            control={control}
            render={({ field, fieldState }) => (
              <Form.Item {...rowProps} label={"Bypass Cache"}>
                <Switch {...field} />
              </Form.Item>
            )}
          />
          <Controller
            name="context"
            control={control}
            render={({ field, fieldState }) => (
              <Form.Item
                {...rowProps}
                label={"Context"}
                style={{
                  marginBottom: 8,
                }}
              >
                <DynamicReactJson
                  src={field.value}
                  style={{ fontSize: 12 }}
                  onDelete={() => {}}
                  onAdd={() => {}}
                  onEdit={(e) => {
                    field.onChange(e.updated_src);
                  }}
                />
              </Form.Item>
            )}
          />
        </Space>
      </form>
    </Modal>
  );
};
export default CreateMetadataJobModal;
