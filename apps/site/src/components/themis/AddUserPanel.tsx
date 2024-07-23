import { Button, DatePicker, Form, Input, Space } from "antd";
import dayjs from "dayjs";
import React from "react";
import { Controller, type SubmitHandler, useForm } from "react-hook-form";
import themisApi from "../../api/themisApi";
import type { BasicUserInfo } from "../../types/themis";
import Badge from "./Badge";

export interface AddUserPanelProps {
  close: () => void;
  afterAdd: () => Promise<void>;
}

const NEW_USER: BasicUserInfo = {
  username: "",
  givenName: "",
  surname: "",
  hireDate: "",
};

const AddUserPanel: React.FunctionComponent<AddUserPanelProps> = ({
  close,
  afterAdd,
}) => {
  const { handleSubmit, control, reset, watch } = useForm<BasicUserInfo>({
    defaultValues: NEW_USER,
    mode: "onChange",
    reValidateMode: "onChange",
  });

  const onSubmit: SubmitHandler<BasicUserInfo> = async (data) => {
    await themisApi.createUser(data);
    await afterAdd();
    reset(NEW_USER);
    close();
  };
  const usernameWatch = watch("username");
  const givenNameWatch = watch("givenName");
  const surnameWatch = watch("surname");

  return (
    <Space direction={"vertical"} style={{ width: "100%" }}>
      <Space
        size={8}
        direction={"vertical"}
        style={{ width: "100%", alignItems: "center", marginBottom: 32 }}
      >
        <Badge
          username={usernameWatch}
          name={`${givenNameWatch} ${surnameWatch}`}
          tenure={1}
        />
      </Space>
      <Form layout="vertical">
        <Space direction={"vertical"} size={8} style={{ width: "100%" }}>
          <Space
            direction={"horizontal"}
            size={8}
            style={{ width: "100%" }}
            styles={{ item: { width: "100%" } }}
          >
            <Controller
              name={"username"}
              control={control}
              rules={{ required: true }}
              render={({ field, fieldState }) => (
                <Form.Item
                  label="Username"
                  validateStatus={fieldState.error ? "error" : undefined}
                  help={fieldState.error ? fieldState.error.message : undefined}
                >
                  <Input
                    {...field}
                    placeholder="Username"
                    allowClear={true}
                    data-1p-ignore={true}
                  />
                </Form.Item>
              )}
            />
            <Controller
              name={"hireDate"}
              control={control}
              rules={{ required: true }}
              render={({ field, fieldState }) => (
                <Form.Item
                  label="Last Hire Date"
                  validateStatus={fieldState.error ? "error" : undefined}
                  help={fieldState.error ? fieldState.error.message : undefined}
                >
                  <DatePicker
                    value={field.value ? dayjs(field.value) : undefined}
                    onChange={(_, dateString) => {
                      field.onChange(dateString); // No need of a state
                    }}
                    style={{ width: "100%" }}
                  />
                </Form.Item>
              )}
            />
          </Space>
          <Space
            direction={"horizontal"}
            size={8}
            style={{ width: "100%" }}
            styles={{ item: { width: "100%" } }}
          >
            <Controller
              name={"givenName"}
              control={control}
              rules={{ required: true }}
              render={({ field, fieldState }) => (
                <Form.Item
                  label="First Name"
                  validateStatus={fieldState.error ? "error" : undefined}
                  help={fieldState.error ? fieldState.error.message : undefined}
                >
                  <Input
                    {...field}
                    placeholder="First"
                    allowClear={true}
                    data-1p-ignore={true}
                  />
                </Form.Item>
              )}
            />
            <Controller
              name={"surname"}
              control={control}
              rules={{ required: true }}
              render={({ field, fieldState }) => (
                <Form.Item
                  label="Last Name"
                  validateStatus={fieldState.error ? "error" : undefined}
                  help={fieldState.error ? fieldState.error.message : undefined}
                >
                  <Input
                    {...field}
                    placeholder="Last"
                    allowClear={true}
                    data-1p-ignore={true}
                  />
                </Form.Item>
              )}
            />
          </Space>
          <Space
            size={8}
            direction={"horizontal"}
            style={{ width: "100%", justifyContent: "end", marginTop: 8 }}
          >
            <Button
              type={"primary"}
              onClick={() => {
                handleSubmit(onSubmit)();
              }}
            >
              Save
            </Button>
            <Button
              type={"primary"}
              danger={true}
              onClick={() => {
                reset(NEW_USER);
                close();
              }}
            >
              Cancel
            </Button>
          </Space>
        </Space>
      </Form>
    </Space>
  );
};
export default AddUserPanel;
