import { CloseCircleFilled, ReloadOutlined } from "@ant-design/icons";
import { Button, Form, Input, Select, Space } from "antd";
import React, { useState } from "react";
import { Controller, type SubmitHandler, useForm } from "react-hook-form";
import { v3 as uuidv3, v4 as uuidv4, v5 as uuidv5 } from "uuid";
import {
  buttonItemLayout,
  formItemLayout,
  NAMESPACE_CUSTOM,
  NAMESPACE_DNS,
  NAMESPACE_OID,
  NAMESPACE_URL,
  NAMESPACE_X_500_DN,
} from "../constants";
import { type UUIDGeneratorProps } from "../interfaces";
import UUIDList from "../UUIDList";

const { Option } = Select;

interface FormInput {
  namespace: string;
  value: string;
}

const UUIDV35Form: React.FunctionComponent<UUIDGeneratorProps> = ({
  version,
  getInfo,
}: UUIDGeneratorProps) => {
  const [namespaceType, setNamespaceType] = useState("custom");

  const { handleSubmit, control, reset, setValue, trigger } =
    useForm<FormInput>({
      defaultValues: {
        namespace: "",
        value: "",
      },
      mode: "onChange",
      reValidateMode: "onChange",
    });

  const onSubmit: SubmitHandler<FormInput> = (data) => {
    const generated: string[] = [];

    if (version === 3) {
      generated.push(uuidv3(data.value, data.namespace) as unknown as string);
    } else {
      generated.push(uuidv5(data.value, data.namespace) as unknown as string);
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
              name={"namespace"}
              control={control}
              rules={{
                required: "A value must be specified",
                pattern: {
                  value:
                    /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/,
                  message:
                    "UUID must be in format XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX, where X is 0-9, a-f, or A-F",
                },
              }}
              render={({ field, fieldState }) => (
                <Form.Item
                  {...formItemLayout}
                  label={"Namespace"}
                  validateStatus={fieldState.error ? "error" : undefined}
                  help={fieldState.error ? fieldState.error.message : undefined}
                >
                  <Space.Compact
                    block={true}
                    direction={"horizontal"}
                    style={{ width: 525 }}
                  >
                    <Input
                      {...field}
                      addonBefore={
                        <Select
                          value={namespaceType}
                          style={{ width: 125 }}
                          onChange={async (value) => {
                            setNamespaceType(value);

                            if (value !== NAMESPACE_CUSTOM) {
                              setValue("namespace", value);
                            } else {
                              setValue("namespace", uuidv4());
                            }

                            await trigger("namespace");
                          }}
                        >
                          <Option value={NAMESPACE_DNS}>DNS</Option>
                          <Option value={NAMESPACE_URL}>URL</Option>
                          <Option value={NAMESPACE_OID}>OID</Option>
                          <Option value={NAMESPACE_X_500_DN}>X.500 DN</Option>
                          <Option value={NAMESPACE_CUSTOM}>Custom</Option>
                        </Select>
                      }
                      disabled={namespaceType !== NAMESPACE_CUSTOM}
                      allowClear={namespaceType === NAMESPACE_CUSTOM}
                      placeholder={"00000000-0000-0000-0000-000000000000"}
                      className={
                        namespaceType === NAMESPACE_CUSTOM
                          ? "ncfritz-ant-input-suffixed"
                          : ""
                      }
                    />
                    {namespaceType === NAMESPACE_CUSTOM && (
                      <Button
                        type={"default"}
                        icon={<ReloadOutlined />}
                        onClick={async () => {
                          setValue("namespace", uuidv4());
                          await trigger("namespace");
                        }}
                        style={{
                          height: "100%",
                        }}
                      />
                    )}
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
              name={"value"}
              control={control}
              rules={{
                required: "A value must be specified",
              }}
              render={({ field, fieldState }) => (
                <Form.Item
                  {...formItemLayout}
                  label={"Value"}
                  validateStatus={fieldState.error ? "error" : undefined}
                  help={fieldState.error ? fieldState.error.message : undefined}
                >
                  <Input {...field} allowClear={true} style={{ width: 600 }} />
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
                      namespace: "",
                      value: "",
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
export default UUIDV35Form;
