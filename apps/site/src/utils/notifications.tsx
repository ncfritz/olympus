import type { NotificationInstance } from "antd/lib/notification/interface";
import type { ReactNode } from "react";

export type NotificationType = "success" | "info" | "warning" | "error";

export const openNotificationWithIcon = (
  type: NotificationType,
  message: string,
  content: ReactNode,
  api: NotificationInstance,
) => {
  api[type]({
    message: message,
    description: content,
  });
};