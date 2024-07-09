import {
  Avatar,
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Form,
  Input,
  Result,
  Row,
  Space,
  Spin,
  Typography,
} from "antd";
import dayjs from "dayjs";
import React, { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import themisApi from "../../../api/themisApi";
import type { BaseBasicUserInfo } from "../../../types/themis";
import { publish } from "../../../utils/events";
import { PUBLISH_EVENT } from "../../common/NotificationSink";

export interface BasicUserInfoPanelProps {
  username: string;
}

const BasicUserInfoPanel: React.FunctionComponent<BasicUserInfoPanelProps> = ({
  username,
}) => {
  const [info, setInfo] = useState<BaseBasicUserInfo | undefined>(undefined);
  const [infoLoading, setInfoLoading] = useState(false);
  const [infoError, setInfoError] = useState(false);

  const { handleSubmit, control, reset } = useForm<BaseBasicUserInfo>({
    defaultValues: info,
    mode: "onChange",
    reValidateMode: "onChange",
  });

  const onSubmit = async (data: BaseBasicUserInfo) => {
    try {
      await themisApi.updateUser(username, data);

      publish(PUBLISH_EVENT, {
        type: "success",
        message: "User info saved",
        description: "The user info has been successfully saved",
      });
    } catch (e) {
      publish(PUBLISH_EVENT, {
        type: "error",
        message: "Failed to save user info",
        description: "Unable to save user info due to a server error",
      });
    }
  };

  const loadUserInfo = async (quiet: boolean = false) => {
    if (!quiet) {
      setInfoLoading(true);
    }

    setInfoError(false);

    try {
      const response = await themisApi.getBasicUserInfo(username);
      setInfo(response.basicInfo);
      reset(response.basicInfo);
    } catch (e) {
      setInfoError(true);
    } finally {
      setInfoLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await loadUserInfo(false);
    })();
  }, [username]);

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
        subTitle={
          "Unable to retrieve basic user info, please verify the user exists"
        }
      />
    );
  } else if (!info) {
    content = <Empty />;
  } else {
    content = (
      <form onSubmit={handleSubmit(onSubmit)}>
        <Row
          gutter={32}
          style={{ display: "flex", alignItems: "center", marginBottom: 8 }}
        >
          <Col span={1}>
            <Avatar
              size={120}
              shape={"square"}
              src={`https://cdn.ncfritz.net/amzn/avatar/${username}.jpg`}
            />
          </Col>
          <Col span={18}>
            <Row
              gutter={8}
              style={{ display: "flex", alignItems: "center", marginBottom: 8 }}
            >
              <Col span={4}>
                <Typography.Text
                  strong={true}
                  style={{ display: "flex", justifyContent: "end" }}
                >
                  Username:
                </Typography.Text>
              </Col>
              <Col span={4}>
                <Typography.Text>{username}</Typography.Text>
              </Col>
            </Row>
            <Row
              gutter={8}
              style={{ display: "flex", alignItems: "center", marginBottom: 8 }}
            >
              <Col span={4}>
                <Typography.Text
                  strong={true}
                  style={{ display: "flex", justifyContent: "end" }}
                >
                  First Name:
                </Typography.Text>
              </Col>
              <Col span={6}>
                <Controller
                  name={"givenName"}
                  control={control}
                  rules={{ required: true }}
                  render={({ field, fieldState }) => (
                    <Form.Item
                      validateStatus={fieldState.error ? "error" : undefined}
                      help={
                        fieldState.error ? fieldState.error.message : undefined
                      }
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
              </Col>
            </Row>
            <Row
              gutter={8}
              style={{ display: "flex", alignItems: "center", marginBottom: 8 }}
            >
              <Col span={4}>
                <Typography.Text
                  strong={true}
                  style={{ display: "flex", justifyContent: "end" }}
                >
                  First Name:
                </Typography.Text>
              </Col>
              <Col span={6}>
                <Controller
                  name={"surname"}
                  control={control}
                  rules={{ required: true }}
                  render={({ field, fieldState }) => (
                    <Form.Item
                      validateStatus={fieldState.error ? "error" : undefined}
                      help={
                        fieldState.error ? fieldState.error.message : undefined
                      }
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
              </Col>
            </Row>
            <Row
              gutter={8}
              style={{ display: "flex", alignItems: "center", marginBottom: 8 }}
            >
              <Col span={4}>
                <Typography.Text
                  strong={true}
                  style={{ display: "flex", justifyContent: "end" }}
                >
                  Last hire date:
                </Typography.Text>
              </Col>
              <Col span={6}>
                <Controller
                  name={"hireDate"}
                  control={control}
                  rules={{ required: true }}
                  render={({ field, fieldState }) => (
                    <Form.Item
                      validateStatus={fieldState.error ? "error" : undefined}
                      help={
                        fieldState.error ? fieldState.error.message : undefined
                      }
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
              </Col>
            </Row>
            <Row>
              <Col span={6} offset={4}>
                <Button
                  type={"primary"}
                  htmlType={"submit"}
                  style={{ marginRight: 8 }}
                >
                  Save
                </Button>
              </Col>
            </Row>
          </Col>
        </Row>
      </form>
    );
  }

  return (
    <Card
      style={{ width: "100%" }}
      title={"Basic User Info"}
      size={"small"}
      bordered={false}
    >
      {content}
    </Card>
  );
};
export default BasicUserInfoPanel;
