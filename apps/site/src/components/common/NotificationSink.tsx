import { notification, NotificationArgsProps } from "antd";
import type { IconType } from "antd/es/notification/interface";
import { useEffect } from "react";
import { subscribe, unsubscribe } from "../../utils/events";

export const PUBLISH_EVENT = "notifications:publish";

const NotificationSink: React.FunctionComponent = () => {
  const [api, contextHolder] = notification.useNotification();

  useEffect(() => {
    subscribe(PUBLISH_EVENT, onNotificationReceived);

    return () => {
      unsubscribe(PUBLISH_EVENT, onNotificationReceived);
    };
  }, []);

  const onNotificationReceived = (e: CustomEvent) => {
    let type: IconType = "info";

    if (
      ["info", "success", "error", "warning", "loading"].includes(
        e.detail?.type,
      )
    ) {
      type = e.detail.type;
    }

    const props: NotificationArgsProps = {
      message: e.detail?.message || "Unknown",
      description: e.detail?.description || "Unknown description",
    };

    api[type](props);
  };

  return <>{contextHolder}</>;
};
export default NotificationSink;
