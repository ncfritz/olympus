import {
  Notification,
  NotificationType,
  WebSocketNotificationLevel,
} from "@ncfritz/olympus-model";
import {
  GraphQlNotificationGroup,
  toDomainObject as notificationGroupToDomainObject,
} from "./NotificationGroupConverter";
import moment from "moment/moment";

export type GraphQlNotification = {
  eventId: string;
  notificationId: string;
  eventTime: string;
  notificationType: NotificationType;
  level: WebSocketNotificationLevel;
  acknowledged?: boolean;
  acknowledgedTime?: string;
  expirationTime?: string;
  deletionTime?: string;
  createdTime: string;
  payload?: string;
  notificationGroup?: GraphQlNotificationGroup;
};

export const toDomainObject = (input: GraphQlNotification): Notification => {
  const notification: Notification = {
    eventId: input.eventId,
    notificationId: input.notificationId,
    eventTime: moment(input.eventTime),
    notificationType: input.notificationType,
    level: input.level,
    acknowledged: input.acknowledged || false,
    expirationTime: moment(input.expirationTime),
    deletionTime: input.deletionTime ? moment(input.deletionTime) : undefined,
    createdTime: moment(input.createdTime),
    payload: input.payload
      ? JSON.parse(Buffer.from(input.payload, "base64").toString("utf-8"))
      : {},
  };

  if (input.notificationGroup) {
    notification.notificationGroup = notificationGroupToDomainObject(
      input.notificationGroup,
    );
  }

  return notification;
};
