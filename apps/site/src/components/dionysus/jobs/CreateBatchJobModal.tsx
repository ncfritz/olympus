const DynamicReactJson = dynamic(import("react-json-view"), { ssr: false });
import { Button, Form, Input, InputNumber, Modal, Space, Switch } from "antd";
import dynamic from "next/dynamic";
import { Controller, type SubmitHandler, useForm } from "react-hook-form";
import batchJobApi from "../../../api/batchJobApi";
import { publish } from "../../../utils/events";
import { type JobType } from "@ncfritz/olympus-sdk/dionysus";
import { PUBLISH_EVENT } from "../../common/NotificationSink";

interface FormInput {
  type: JobType;
  publish: boolean;
  offset: number;
  limit: boolean;
  maxRecords: number;
}

export interface CreateBatchJobModalProps {
  type: JobType;
  open: boolean;
  postCreate: () => Promise<void>;
  onClose: () => void;
}

const rowProps = {
  labelCol: { span: 6 },
  wrapperCol: { span: 12 },
};

const CreateBatchJobModal: React.FunctionComponent<
  CreateBatchJobModalProps
> = ({ type, open, postCreate, onClose }: CreateBatchJobModalProps) => {
  const {
    handleSubmit,
    control,
    reset,
    watch,
    formState: { isValid, isDirty, isSubmitting },
  } = useForm<FormInput>({
    defaultValues: {
      type: type,
      publish: true,
      offset: 0,
      limit: false,
      maxRecords: 0,
    },
    mode: "onChange",
    reValidateMode: "onChange",
  });
  const limitWatch = watch("limit");

  const onSubmit: SubmitHandler<FormInput> = async (data) => {
    await batchJobApi.createBatchJob(
      data.type,
      data.publish,
      data.offset,
      data.limit ? data.maxRecords : undefined,
    );

    try {
      publish(PUBLISH_EVENT, {
        type: "success",
        message: "Job created",
        description: "Metadata batch job successfully created",
      });

      if (postCreate) {
        await postCreate();
      }

      closeModal();
    } catch (e) {
      publish(PUBLISH_EVENT, {
        type: "error",
        message: "Unable to create job",
        description: "The API call to /v1/jobs/batch failed",
      });
    }
  };

  const closeModal = () => {
    onClose();
    reset();
  };

  return (
    <Modal
      title={"Create Metadata Batch Job"}
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
            name={"type"}
            control={control}
            render={({ field, fieldState }) => (
              <Form.Item
                {...rowProps}
                label={"Batch Job Type"}
                validateStatus={fieldState.error ? "error" : undefined}
                help={fieldState.error ? fieldState.error.message : undefined}
              >
                <Input type={"hidden"} {...field} />
                {field.value}
              </Form.Item>
            )}
          />
          <Controller
            name={"offset"}
            control={control}
            rules={{
              min: {
                value: 0,
                message: "Offset cannot be negative",
              },
            }}
            render={({ field, fieldState }) => (
              <Form.Item
                {...rowProps}
                label={"Skip Records"}
                validateStatus={fieldState.error ? "error" : undefined}
                help={fieldState.error ? fieldState.error.message : undefined}
              >
                <InputNumber {...field} style={{ width: 180 }} />
              </Form.Item>
            )}
          />
          <Controller
            name={"limit"}
            control={control}
            render={({ field, fieldState }) => (
              <Form.Item
                {...rowProps}
                label={"Limit Records Processed"}
                validateStatus={fieldState.error ? "error" : undefined}
                help={fieldState.error ? fieldState.error.message : undefined}
              >
                <Switch {...field} />
              </Form.Item>
            )}
          />
          {limitWatch && (
            <Controller
              name={"maxRecords"}
              control={control}
              rules={{
                min: {
                  value: 1,
                  message: "Maximum cannot be negative or zero",
                },
              }}
              render={({ field, fieldState }) => (
                <Form.Item
                  {...rowProps}
                  label={"Max Records to Process"}
                  validateStatus={fieldState.error ? "error" : undefined}
                  help={fieldState.error ? fieldState.error.message : undefined}
                >
                  <InputNumber {...field} style={{ width: 180 }} />
                </Form.Item>
              )}
            />
          )}
          <Controller
            name={"publish"}
            control={control}
            render={({ field, fieldState }) => (
              <Form.Item {...rowProps} label={"Publish Notification"}>
                <Switch {...field} />
              </Form.Item>
            )}
          />
        </Space>
      </form>
    </Modal>
  );
};
export default CreateBatchJobModal;
