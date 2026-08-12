import { CloseCircleFilled } from "@ant-design/icons";
import { Button, Form, InputNumber, Space } from "antd";
import React, { useState } from "react";
import { Controller, type SubmitHandler, useForm } from "react-hook-form";
import { v4 as uuidv4 } from "uuid";
import { buttonItemLayout, formItemLayout } from "../constants";
import { type UUIDGeneratorProps } from "../interfaces";
import UUIDList from "../UUIDList";

interface FormInput {
  count: number;
}

const UUIDV4Form: React.FunctionComponent<UUIDGeneratorProps> = ({
  getInfo,
}: UUIDGeneratorProps) => {
  const { handleSubmit, control, reset } = useForm<FormInput>({
    defaultValues: {
      count: 10,
    },
    mode: "onChange",
    reValidateMode: "onChange",
  });

  const onSubmit: SubmitHandler<FormInput> = (data) => {
    const generated: string[] = [];

    for (let i = 0; i < data.count; i++) {
      generated.push(uuidv4() as unknown as string);
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
                  label={"Count"}
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
          <Form.Item {...buttonItemLayout} style={{ width: "100%" }}>
            <Space
              orientation={"horizontal"}
              size={8}
              style={{ width: "100%" }}
            >
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
export default UUIDV4Form;
