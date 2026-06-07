import { ClockCircleOutlined, CloseCircleFilled } from "@ant-design/icons";
import { Button, Form, InputNumber, Space, Typography } from "antd";
import { MaskedInput } from "antd-mask-input";
import React, { useState } from "react";
import { type SubmitHandler, Controller, useForm } from "react-hook-form";
import { buttonItemLayout, formItemLayout } from "../constants";
import { type UUIDGeneratorProps } from "../interfaces";
import { v1 as uuidv1, v6 as uuidv6 } from "uuid";
import UUIDList from "../UUIDList";

interface FormInput {
  count: number;
  node?: string;
  clockSequence?: number;
  millis?: number;
  nanos?: number;
}

const UUIDV16Form: React.FunctionComponent<UUIDGeneratorProps> = ({
  version,
  getInfo,
}: UUIDGeneratorProps) => {
  const { handleSubmit, control, reset, setValue, watch } = useForm<FormInput>({
    defaultValues: {
      count: 10,
      node: undefined,
      clockSequence: undefined,
      millis: new Date().getTime(),
      nanos: undefined,
    },
    mode: "onChange",
    reValidateMode: "onChange",
  });

  const clockSequenceWatch = watch("clockSequence");

  const onSubmit: SubmitHandler<FormInput> = (data) => {
    const generated: string[] = [];
    const node =
      data.node && data.node.length > 0
        ? Buffer.from(data.node.replaceAll(":", ""), "hex")
        : undefined;

    for (let i = 0; i < data.count; i++) {
      if (version === 1) {
        generated.push(
          uuidv1({
            node: node,
            clockseq: data.clockSequence,
            msecs: data.millis,
            nsecs: data.nanos,
          }) as unknown as string,
        );
      } else {
        generated.push(
          uuidv6({
            node: node,
            clockseq: data.clockSequence,
            msecs: data.millis,
            nsecs: data.nanos,
          }) as unknown as string,
        );
      }
    }

    setValues(generated);
  };

  const [values, setValues] = useState<string[]>([]);

  return (
    <Space size={16} direction={"vertical"} style={{ width: "100%" }}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <Space orientation={"vertical"} size={16} style={{ width: "100%" }}>
          <Space
            direction={"horizontal"}
            style={{ width: "100%", display: "block" }}
          >
            <Controller
              name={"count"}
              control={control}
              rules={{
                required: "Count must be specified",
                min: {
                  value: 1,
                  message: "You must generate at least one UUID",
                },
                max: {
                  value: 500,
                  message: "A maximum of 500 UUIDs can be generated",
                },
              }}
              render={({ field, fieldState }) => (
                <Form.Item
                  {...formItemLayout}
                  label={"UUID"}
                  validateStatus={fieldState.error ? "error" : undefined}
                  help={fieldState.error ? fieldState.error.message : undefined}
                >
                  <InputNumber
                    {...field}
                    min={1}
                    max={500}
                    style={{ width: 324 }}
                  />
                </Form.Item>
              )}
            />
          </Space>
          <Space
            direction={"horizontal"}
            style={{ width: "100%", display: "block" }}
          >
            <Controller
              name={"node"}
              control={control}
              rules={{
                pattern: {
                  value:
                    /^[0-9a-fA-F]{2}:[0-9a-fA-F]{2}:[0-9a-fA-F]{2}:[0-9a-fA-F]{2}:[0-9a-fA-F]{2}:[0-9a-fA-F]{2}$/,
                  message:
                    "Node must be a MAC address - XX:XX:XX:XX:XX, where X is 0-9, a-f, or A-F",
                },
              }}
              render={({ field, fieldState }) => (
                <Form.Item
                  {...formItemLayout}
                  label={"Node (MAC)"}
                  validateStatus={fieldState.error ? "error" : undefined}
                  help={fieldState.error ? fieldState.error.message : undefined}
                >
                  <MaskedInput
                    {...field}
                    mask={"xx:xx:xx:xx:xx:xx"}
                    maskOptions={{
                      lazy: true,
                      blocks: { x: { mask: /^[0-9a-zA-Z]$/ } },
                    }}
                    style={{ width: 200 }}
                    placeholder={"xx:xx:xx:xx:xx:xx"}
                    value={undefined}
                    allowClear={true}
                  />
                </Form.Item>
              )}
            />
          </Space>
          <Space
            direction={"horizontal"}
            style={{ width: "100%", display: "block" }}
          >
            <Controller
              name={"clockSequence"}
              control={control}
              rules={{
                min: {
                  value: 0,
                  message: "Clock sequence cannot be negative",
                },
                max: {
                  value: 0x3fff,
                  message: "Clock sequence cannot be greater than 3FFF",
                },
              }}
              render={({ field, fieldState }) => (
                <Form.Item
                  {...formItemLayout}
                  label={"Clock Sequence"}
                  validateStatus={fieldState.error ? "error" : undefined}
                  help={fieldState.error ? fieldState.error.message : undefined}
                >
                  <Space orientation={"horizontal"} size={16}>
                    <InputNumber
                      {...field}
                      style={{ width: 200 }}
                      min={0}
                      max={0x3fff}
                      placeholder={"0 to 16383"}
                    />
                    {clockSequenceWatch && (
                      <Typography style={{ fontFamily: "monospace" }}>
                        0x{("0000" + clockSequenceWatch.toString(16)).slice(-4)}
                      </Typography>
                    )}
                  </Space>
                </Form.Item>
              )}
            />
          </Space>
          <Space
            direction={"horizontal"}
            style={{ width: "100%", display: "block" }}
          >
            <Controller
              name={"millis"}
              control={control}
              rules={{
                min: {
                  value: 0,
                  message: "Milliseconds cannot be negative",
                },
              }}
              render={({ field, fieldState }) => (
                <Form.Item
                  {...formItemLayout}
                  label={"Milliseconds"}
                  validateStatus={fieldState.error ? "error" : undefined}
                  help={fieldState.error ? fieldState.error.message : undefined}
                >
                  <Space.Compact block={true} direction={"horizontal"}>
                    <InputNumber
                      {...field}
                      style={{ width: 200 }}
                      min={0}
                      placeholder={"0"}
                    />
                    <Button
                      type={"default"}
                      onClick={() => {
                        setValue("millis", new Date().getTime());
                      }}
                    >
                      <ClockCircleOutlined />
                    </Button>
                  </Space.Compact>
                </Form.Item>
              )}
            />
          </Space>
          <Space
            direction={"horizontal"}
            style={{ width: "100%", display: "block" }}
          >
            <Controller
              name={"nanos"}
              control={control}
              rules={{
                min: {
                  value: 0,
                  message: "Nanoseconds cannot be negative",
                },
                max: {
                  value: 10000,
                  message: "Nanoseconds cannot be greater than 10,000",
                },
              }}
              render={({ field, fieldState }) => (
                <Form.Item
                  {...formItemLayout}
                  label={"Nanoseconds"}
                  validateStatus={fieldState.error ? "error" : undefined}
                  help={fieldState.error ? fieldState.error.message : undefined}
                >
                  <InputNumber
                    {...field}
                    style={{ width: 200 }}
                    min={0}
                    max={10000}
                    placeholder={"0"}
                  />
                </Form.Item>
              )}
            />
          </Space>
          <Form.Item {...buttonItemLayout} style={{ width: "100%" }}>
            <Space orientation={"horizontal"} size={8} style={{ width: "100%" }}>
              <Button type={"primary"} htmlType={"submit"}>
                Generate
              </Button>
              {values.length > 0 && (
                <Button
                  type={"primary"}
                  ghost={true}
                  icon={<CloseCircleFilled />}
                  onClick={() => {
                    reset({
                      count: 10,
                      node: "",
                      millis: new Date().getTime(),
                      nanos: undefined,
                    });
                    setValues([]);
                  }}
                >
                  Clear
                </Button>
              )}
            </Space>
          </Form.Item>
        </Space>
      </form>
      <UUIDList getInfo={getInfo} values={values} />
    </Space>
  );
};
export default UUIDV16Form;
