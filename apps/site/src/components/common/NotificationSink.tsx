import { notification, type NotificationArgsProps } from "antd";
import type { IconType } from "antd/es/notification/interface";
import { type ReactNode, useEffect } from "react";
import notificationsApi from "../../api/notificationsApi";
import { subscribe, unsubscribe } from "../../utils/events";
import type {
  NotificationEvent,
  NotificationFormatter, NotificationPayload
} from "../notifications/formatters/interfaces";
import { getFormatterForMeaageType } from "../notifications/formatters/NotificationRegistry";

export const PUBLISH_EVENT = "notifications:publish";
export const REFRESH_EVENT = "notifications:refresh";

const NotificationSink: React.FunctionComponent = () => {
  const [api, contextHolder] = notification.useNotification({
    top: 96,
  });

  useEffect(() => {
    subscribe(PUBLISH_EVENT, onNotificationReceived);

    return () => {
      unsubscribe(PUBLISH_EVENT, onNotificationReceived);
    };
  }, []);

  const onNotificationReceived = async (
    e: CustomEvent<NotificationEvent<NotificationPayload>>,
  ) => {
    let type: IconType = "info";
    let message: string | ReactNode = "Unknown";
    let description: string | ReactNode = "Unknown description";
    let formatter: NotificationFormatter<any> | undefined = undefined;

    // The plain designation is set by the notification agent and designates that the payload will contain the
    // message title and body.  The notification agent may specify different types, which will need to be
    // handled here.  If no type is present in the payload or there is no payload, we treat the notification as
    // a legacy in-app notification and pull the message and title directly from the message detail.  This behavior
    // is based on the initial convention established to publish in-app messages with a data structure containing:
    //
    // 1. type - the type of message; equivalent to the level of agent based notifications.
    // 2. message - the title of the notification; equivalent to the same value in the payload structure of agent
    //    based notifications.
    // 3. description - the body of the message; equivalent to the same value in the payload structure of agent
    //    based notifications.
    if (e.detail.payload?.type === "plain") {
      message =
        e.detail.payload?.value?.title ||
        "Error: The 'plain' type even did not contain a 'value.title' element";
      description =
        e.detail.payload?.value?.message ||
        "Error: The 'plain' type event did not contain a 'value.message' element";
    } else if (e.detail.messageType) {
      formatter = getFormatterForMeaageType(e.detail.messageType);
    }

    if (formatter) {
      [message, description] = formatter.format(e.detail.payload.value);
    } else {
      message = e.detail?.message || message;
      description = e.detail?.description || description;
    }

    // Set the appropriate level if the message contains a type (severity) we know about.
    if (
      ["info", "success", "error", "warning", "loading"].includes(
        e.detail?.type,
      )
    ) {
      type = e.detail.type as IconType;
    }

    const props: NotificationArgsProps = {
      key: e.detail?.eventId,
      message: message,
      description: description,
      closable: e.detail?.closable || false,
      onClose: async () => {
        if (e.detail?.durable && e.detail?.deleteOnClose) {
          try {
            await notificationsApi.deleteNotification(e.detail.notificationId);
          } catch (e) {
            console.log(e.detail);
            console.warn("Unable to delete notification", e);
          }
        }
      },
      duration: e.detail?.visibleDuration || 4.5,
      showProgress: true,
      pauseOnHover: true,
    };

    api[type](props);
  };

  return <>{contextHolder}</>;
};
export default NotificationSink;
