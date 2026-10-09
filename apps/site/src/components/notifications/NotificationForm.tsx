const DynamicReactJson = dynamic(import("react-json-view"), { ssr: false });
import {
  CheckCircleFilled,
  CloseCircleFilled,
  MinusCircleOutlined,
  SendOutlined,
} from "@ant-design/icons";
import type {
  NotificationContext,
  NotificationTypeWithProtocols,
  SendNotificationRequest,
  SmtpDestinationFormInput,
  SynoChatDestination,
  WebSocketDestination,
} from "@ncfritz/olympus-sdk/olympus";
import {
  Button,
  Checkbox,
  Col,
  Collapse,
  DatePicker,
  Form,
  Row,
  Select,
  Space,
  Typography,
} from "antd";
import dynamic from "next/dynamic";
import { type CSSProperties, useEffect, useState } from "react";
import {
  Controller,
  type ControllerRenderProps,
  useForm,
} from "react-hook-form";
import notificationsApi from "../../api/notificationsApi";
import { Events, publish } from "../../utils/events";
import EmailDestinationForm from "./destination/EmailDestinationForm";
import SynologyChatDestinationForm from "./destination/SynologyChatDestinationForm";
import WebSocketDestinationForm from "./destination/WebSocketDestinationForm";
import { v4 as uuid4 } from "uuid";

const panelStyles: Record<"header" | "body", CSSProperties> = {
  header: {
    alignItems: "center",
    marginBottom: 8,
  },
  body: {
    marginLeft: 28,
    marginBottom: 8,
  },
};

const getIconForStatus = (status: string | undefined) => {
  switch (status) {
    case "success":
      return (
        <Typography.Text style={{ fontSize: 12, color: "#52c41a" }}>
          <CheckCircleFilled />
        </Typography.Text>
      );
    case "error":
      return (
        <Typography.Text style={{ fontSize: 12, color: "#ff4d4f" }}>
          <CloseCircleFilled />
        </Typography.Text>
      );
    default:
      return (
        <Typography.Text style={{ fontSize: 12, color: "#666666" }}>
          <MinusCircleOutlined />
        </Typography.Text>
      );
  }
};

export interface NotificationFormData {
  type: string;
  context: NotificationContext;
  expirationTime: string;
  webSocketDestination?: WebSocketDestination;
  synoChatDestination?: SynoChatDestination;
  synoMailDestination?: SmtpDestinationFormInput;
  smtpDestination?: SmtpDestinationFormInput;
}

const NotificationForm: React.FunctionComponent = () => {
  const [activeDestinations, setActiveDestinations] = useState<string[]>([]);
  const [notificationTypes, setNotificationTypes] = useState<
    NotificationTypeWithProtocols[]
  >([]);
  const [notificationTypesLoading, setNotificationTypesLoading] =
    useState<boolean>(false);
  const [, setNotificationTypesError] = useState<unknown>(undefined);
  const [notificationType, setNotificationType] = useState<
    NotificationTypeWithProtocols | undefined
  >(undefined);

  const fetchNotificationTypes = async () => {
    setNotificationTypesLoading(true);
    setNotificationTypesError(undefined);

    try {
      const listNotificationTypesResponse =
        await notificationsApi.listNotificationTypes();
      setNotificationTypes(
        listNotificationTypesResponse.data!.notificationTypes || [],
      );
      setNotificationType(
        listNotificationTypesResponse.data!.notificationTypes[0],
      );
      setValue(
        "type",
        listNotificationTypesResponse.data!.notificationTypes[0].id,
      );
    } catch (e) {
      setNotificationTypesError(e);
    } finally {
      setNotificationTypesLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await fetchNotificationTypes();
    })();
  }, []);

  useEffect(() => {
    if (notificationType) {
      const newDestinations = activeDestinations.filter((key) => {
        const id = key.substring(key.lastIndexOf("-") + 1);
        const objectKey = `supports${id.charAt(0).toUpperCase()}${id.slice(1)}`;

        if (notificationType) {
          // @ts-expect-error Property keys are know and follow convention
          return notificationType[objectKey];
        } else {
          return false;
        }
      });

      setActiveDestinations(newDestinations!);
    }
  }, [notificationType]);

  const { control, handleSubmit, watch, setValue } =
    useForm<NotificationFormData>({
      defaultValues: {
        type: undefined,
        context: {},
        expirationTime: undefined,
        webSocketDestination: {
          durable: false,
          closable: true,
          deleteOnClose: false,
          visibleDuration: 4.5,
          ghost: false,
          group: undefined,
          ttl: undefined,
          level: "info",
        },
        synoChatDestination: {
          destinationType: "channel",
          destination: "olympus",
          users: [],
        },
        synoMailDestination: {
          priority: "3",
          from: "Olympus <olympus@internal.ncfritz.net>",
          to: [{ value: "Neil Fritz <ncfritz@internal.ncfritz.net>" }],
          cc: [],
          bcc: [],
        },
        smtpDestination: {
          priority: "3",
          from: "Olympus <olympus@ncfritz.net>",
          to: [{ value: "Neil Fritz <ncfritz@ncfritz.net>" }],
          cc: [],
          bcc: [],
        },
      },
      mode: "all",
    });

  const onSubmit = async (data: NotificationFormData) => {
    const notificationRequest: SendNotificationRequest = {
      type: data.type,
      context: data.context,
      expirationTime: data.expirationTime,
    };

    if (activeDestinations.includes("notification-webSocket")) {
      notificationRequest.webSocketDestination = data.webSocketDestination;
    }

    if (activeDestinations.includes("notification-synoChat")) {
      notificationRequest.synoChatDestination = data.synoChatDestination;
    }

    if (activeDestinations.includes("notification-synoMail")) {
      notificationRequest.synoMailDestination = data.synoMailDestination;
    }

    if (activeDestinations.includes("notification-email")) {
      notificationRequest.smtpDestination = data.smtpDestination;
    }

    try {
      const notificationResponse =
        await notificationsApi.sendNotification(notificationRequest);

      const content = (
        <>
          <Row>
            <Col span={7}>Web Socket</Col>
            <Col span={2}>
              {getIconForStatus(
                notificationResponse.data?.webSocketDestination?.status,
              )}
            </Col>
            <Col span={6} />
            <Col span={7}>SynoChat</Col>
            <Col span={2}>
              {getIconForStatus(
                notificationResponse.data?.synoChatDestination?.status,
              )}
            </Col>
          </Row>
          <Row>
            <Col span={7}>Syno Mail</Col>
            <Col span={2}>
              {getIconForStatus(
                notificationResponse.data?.synoMailDestination?.status,
              )}
            </Col>
            <Col span={6} />
            <Col span={7}>Email</Col>
            <Col span={2}>
              {getIconForStatus(
                notificationResponse.data?.externalMailDestination?.status,
              )}
            </Col>
          </Row>
        </>
      );

      const message = {
        type: "success",
        message: "Notification published",
        description: content,
        closable: true,
        visibleDuration: 2,
      };

      publish(Events.NOTIFICATIONS_PUBLISH_EVENT, message);
    } catch (e) {
      console.log(e);
      publish(Events.NOTIFICATIONS_PUBLISH_EVENT, {
        type: "error",
        message: "Unable to send notification",
        description: "The API call to /v1/notifications/publish failed",
      });
    }
  };

  return (
    <Form
      onFinish={handleSubmit(onSubmit)}
      labelCol={{ span: 7 }}
      wrapperCol={{ span: 17 }}
    >
      <Space
        direction={"vertical"}
        style={{
          width: "100%",
          justifyContent: "space-between",
        }}
      >
        <Space
          direction={"vertical"}
          style={{
            padding: 16,
            width: "100%",
          }}
          styles={{
            item: { width: "100%" },
          }}
        >
          <Form.Item
            label={"Notification Type"}
            tooltip={"The type of notification to be sent."}
          >
            <Controller
              name="type"
              control={control}
              render={({
                field,
              }: {
                field: ControllerRenderProps<NotificationFormData, "type">;
              }) => (
                <Select
                  {...field}
                  onSelect={(value) => {
                    setNotificationType(
                      notificationTypes.find((item) => {
                        return item.id === value;
                      }),
                    );
                  }}
                  loading={notificationTypesLoading}
                  options={notificationTypes.map((item) => {
                    return {
                      value: item.id,
                      label: item.name,
                    };
                  })}
                />
              )}
            />
          </Form.Item>
          <Form.Item
            label={"Context:"}
            layout={"vertical"}
            labelCol={{ span: 24 }}
            wrapperCol={{ span: 24 }}
            style={{
              marginBottom: 8,
            }}
            className={"notificationContext"}
            tooltip={
              "Contextual, structured data that will be used in notification processing."
            }
          >
            <Space
              style={{
                border: 1,
                borderStyle: "solid",
                borderColor: "#d9d9d9",
                padding: 8,
                borderRadius: 6,
                width: "100%",
                minHeight: 100,
                display: "flex",
                alignItems: "baseline",
              }}
            >
              <Controller
                name="context"
                control={control}
                render={({
                  field,
                }: {
                  field: ControllerRenderProps<NotificationFormData, "context">;
                }) => (
                  <DynamicReactJson
                    src={JSON.parse(JSON.stringify(field.value))}
                    style={{ fontSize: 12 }}
                    onDelete={() => {}}
                    onAdd={() => {}}
                    onEdit={(e) => {
                      field.onChange(e.updated_src);
                    }}
                  />
                )}
              />
            </Space>
          </Form.Item>
          <Form.Item
            label={"Expiration Time"}
            tooltip={
              "The last possible time a notification will be considered for processing."
            }
          >
            <Controller
              name="expirationTime"
              control={control}
              render={({
                field,
              }: {
                field: ControllerRenderProps<
                  NotificationFormData,
                  "expirationTime"
                >;
              }) => (
                <DatePicker
                  {...field}
                  showTime={{ use12Hours: true }}
                  style={{ width: "100%" }}
                />
              )}
            />
          </Form.Item>
          <Form.Item
            label={"Delivery Options"}
            tooltip={"Configure where the notification will be delivered"}
            labelCol={{ span: 24 }}
          />
          <Collapse
            ghost={true}
            activeKey={activeDestinations}
            expandIcon={(panelProps) => {
              // @ts-expect-error known situation
              const panelKey = panelProps.panelKey as string;
              const id = panelKey.substring(panelKey.lastIndexOf("-") + 1);
              const objectKey = `supports${id.charAt(0).toUpperCase()}${id.slice(1)}`;

              let enabled = false;

              // @ts-expect-error Object keys are known and conforms to standards
              if (notificationType && notificationType[objectKey]) {
                enabled = true;
              }

              return (
                <Checkbox
                  checked={panelProps.isActive}
                  disabled={!enabled || notificationTypesLoading}
                />
              );
            }}
            onChange={(key) => {
              setActiveDestinations(key);
            }}
            items={[
              {
                key: "notification-webSocket",
                label: (
                  <Typography.Title level={5} style={{ marginBottom: 0 }}>
                    WebSocket
                  </Typography.Title>
                ),
                children: (
                  <WebSocketDestinationForm control={control} watch={watch} />
                ),
                styles: panelStyles,
                collapsible: notificationType?.supportsWebSocket
                  ? "header"
                  : "disabled",
              },
              {
                key: "notification-synoChat",
                label: (
                  <Typography.Title level={5} style={{ marginBottom: 0 }}>
                    Synology Chat
                  </Typography.Title>
                ),
                children: <SynologyChatDestinationForm control={control} />,
                styles: panelStyles,
                collapsible: notificationType?.supportsSynoChat
                  ? "header"
                  : "disabled",
              },
              {
                key: "notification-synoMail",
                label: (
                  <Typography.Title level={5} style={{ marginBottom: 0 }}>
                    Synology Mail
                  </Typography.Title>
                ),
                children: (
                  <EmailDestinationForm
                    key={uuid4()}
                    formPathPrefix={"synoMailDestination"}
                    control={control}
                  />
                ),
                styles: panelStyles,
                collapsible: notificationType?.supportsSynoMail
                  ? "header"
                  : "disabled",
              },
              {
                key: "notification-email",
                label: (
                  <Typography.Title level={5} style={{ marginBottom: 0 }}>
                    Google Mail
                  </Typography.Title>
                ),
                children: (
                  <EmailDestinationForm
                    key={uuid4()}
                    formPathPrefix={"smtpDestination"}
                    control={control}
                  />
                ),
                styles: panelStyles,
                collapsible: notificationType?.supportsEmail
                  ? "header"
                  : "disabled",
              },
            ]}
          />
        </Space>
        <Space
          direction={"horizontal"}
          style={{
            padding: 16,
            display: "flex",
            width: "100%",
            justifyContent: "space-between",
          }}
          styles={{
            item: { width: "100%" },
          }}
        >
          <Button
            type={"primary"}
            htmlType={"submit"}
            disabled={status === "saving" || activeDestinations.length <= 0}
            style={{ width: "100%" }}
            icon={<SendOutlined />}
          >
            Send Notification
          </Button>
        </Space>
      </Space>
    </Form>
  );
};
export default NotificationForm;
