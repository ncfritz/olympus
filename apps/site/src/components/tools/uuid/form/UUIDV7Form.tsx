import { ClockCircleOutlined, CloseCircleFilled } from "@ant-design/icons";
import { Button, Form, InputNumber, Space, Typography } from "antd";
import React, { useState } from "react";
import { type SubmitHandler, Controller, useForm } from "react-hook-form";
import { buttonItemLayout, formItemLayout } from "../constants";
import { type UUIDGeneratorProps } from "../interfaces";
import { v7 as uuidv7 } from "uuid";
import UUIDList from "../UUIDList";

interface FormInput {
  count: number;
  seq?: number;
  millis?: number;
}

const UUIDV7Form: React.FunctionComponent<UUIDGeneratorProps> = ({
  getInfo,
}: UUIDGeneratorProps) => {
  const { handleSubmit, control, reset, setValue, watch } = useForm<FormInput>({
    defaultValues: {
      count: 10,
      seq: undefined,
      millis: new Date().getTime(),
    },
    mode: "onChange",
    reValidateMode: "onChange",
  });

  const seqWatch = watch("seq");

  const onSubmit: SubmitHandler<FormInput> = (data) => {
    const generated: string[] = [];
    for (let i = 0; i < data.count; i++) {
      generated.push(
        uuidv7({
          seq: data.seq,
          msecs: data.millis,
        }) as unknown as string,
      );
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
              name={"seq"}
              control={control}
              rules={{
                min: {
                  value: 0,
                  message: "Sequence cannot be negative",
                },
                max: {
                  value: 0xffffffff,
                  message: "Ssequence cannot be greater than FFFFFFFF",
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
                      max={0xffffffff}
                      placeholder={"0 to 4294967295"}
                    />
                    {seqWatch && (
                      <Typography style={{ fontFamily: "monospace" }}>
                        0x{("00000000" + seqWatch.toString(16)).slice(-8)}
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
                      seq: undefined,
                      millis: new Date().getTime(),
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
export default UUIDV7Form;
