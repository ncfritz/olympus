import {
  CheckCircleFilled,
  CheckCircleOutlined,
  CloseCircleFilled,
  DeleteOutlined,
  InfoCircleFilled,
  WarningFilled,
} from "@ant-design/icons";
import type { Notification } from "@ncfritz/olympus-sdk/olympus";
import { Badge, Button, List, Space, Tag, Typography } from "antd";
import { DateTime } from "luxon";
import prettyMilliseconds from "pretty-ms";
import { type ReactNode, useState } from "react";
import notificationsApi from "../../api/notificationsApi";
import { Events, publish } from "../../utils/events";
import { getFormatterForMessageType } from "./formatters/NotificationRegistry";

export interface NotificationListEntryProps {
  notification: Notification;
  showGroup: boolean;
  onSuccess: (quiet: boolean) => Promise<void>;
}

const getDecorationForNotificationLevel = (notification: Notification) => {
  if (notification.acknowledged) {
    return { color: "#999999", icon: <CheckCircleFilled /> };
  }

  switch (notification.level) {
    case "success":
      return { color: "#52c41a", icon: <CheckCircleFilled /> };
    case "warning":
      return { color: "#f0ad4e", icon: <WarningFilled /> };
    case "error":
      return { color: "#ff4d4f", icon: <CloseCircleFilled /> };
    default:
      return { color: "#1677ff", icon: <InfoCircleFilled /> };
  }
};

const NotificationListEntry: React.FunctionComponent<
  NotificationListEntryProps
> = ({ notification, showGroup, onSuccess }: NotificationListEntryProps) => {
  const [acknowledging, setAcknowledging] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const acknowledgeNotification = async (
    notificationId: string,
    ack: boolean,
  ) => {
    setAcknowledging(true);
    let success = false;

    try {
      await notificationsApi.acknowledgeNotification(notificationId, {
        acknowledged: ack,
      });
      success = true;
    } catch (e) {
      console.error(`Unable to acknowledge notification ${notificationId}`, e);

      publish(Events.NOTIFICATIONS_PUBLISH_EVENT, {
        type: "error",
        message: "Unable to acknowledge notification",
        description:
          "The notification could not be acknowledged due to an error",
      });
    } finally {
      setAcknowledging(false);

      if (success) {
        await onSuccess(true);
      }
    }
  };

  const deleteNotification = async (notificationId: string) => {
    setDeleting(true);
    let success = false;

    try {
      await notificationsApi.deleteNotification(notificationId);
      success = true;
    } catch (e) {
      console.error(`Unable to delete notification ${notificationId}`, e);

      publish(Events.NOTIFICATIONS_PUBLISH_EVENT, {
        type: "error",
        message: "Unable to delete notification",
        description: "The notification could not be deleted due to an error",
      });
    } finally {
      setDeleting(false);

      if (success) {
        await onSuccess(true);
      }
    }
  };

  const notificationDecoration =
    getDecorationForNotificationLevel(notification);

  const notificationTime = DateTime.fromISO(notification.createdTime);
  const notificationAge =
    -notificationTime.diffNow("milliseconds").milliseconds;
  const formatter = getFormatterForMessageType(
    notification.notificationType.id,
  );

  let title: string | ReactNode = (
    // @ts-expect-error okay
    <Typography.Text>{notification.payload.value.title}</Typography.Text>
  );

  // @ts-expect-error okay
  let message: string | ReactNode = notification.payload.value.message;

  if (formatter) {
    // @ts-expect-error okay
    [title, message] = formatter.format(notification.payload.value);
  }

  return (
    <List.Item
      style={{
        borderLeftWidth: 5,
        borderLeftColor: notificationDecoration.color,
        borderLeftStyle: "solid",
        paddingRight: 0,
      }}
      actions={[
        <Space orientation={"vertical"} size={0} align={"end"}>
          <Typography.Text style={{ fontSize: 11, marginRight: 8 }}>
            {prettyMilliseconds(notificationAge, { hideSeconds: true })}
          </Typography.Text>
          <Space.Compact>
            <Button
              type={"text"}
              icon={
                notification.acknowledged ? (
                  <CheckCircleFilled />
                ) : (
                  <CheckCircleOutlined />
                )
              }
              onClick={async () => {
                await acknowledgeNotification(
                  notification.notificationId,
                  !notification.acknowledged,
                );
              }}
              disabled={deleting || acknowledging}
              loading={acknowledging}
              size={"small"}
            />
            <Button
              icon={<DeleteOutlined />}
              danger={true}
              type={"text"}
              onClick={async () => {
                await deleteNotification(notification.notificationId);
              }}
              disabled={deleting || acknowledging}
              loading={deleting}
              size={"small"}
            />
          </Space.Compact>
        </Space>,
      ]}
    >
      <List.Item.Meta
        avatar={
          <Typography.Text
            style={{
              color: notificationDecoration.color,
              fontSize: 16,
            }}
          >
            {notification.acknowledged ? (
              notificationDecoration.icon
            ) : (
              <Badge dot={true}>{notificationDecoration.icon}</Badge>
            )}
          </Typography.Text>
        }
        title={
          <Space orientation={"horizontal"} size={0}>
            {showGroup && notification.notificationGroup && (
              <Tag bordered={false} color={"blue"}>
                {notification.notificationGroup.name}
              </Tag>
            )}
            {title}
          </Space>
        }
        description={message}
      />
    </List.Item>
  );
};
export default NotificationListEntry;
