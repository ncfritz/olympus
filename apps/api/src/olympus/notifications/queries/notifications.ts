import { BASE_NOTIFICATION_GROUP } from "./notificationGroups";
import { BASE_NOTIFICATION_TYPE } from "./notificationTypes";

export const NOTIFICATION = `acknowledged
  acknowledgedTime
  createdTime
  deletionTime
  eventId
  eventTime
  expirationTime
  level
  notificationId
  payload
  ttl
  notificationGroup {
    ${BASE_NOTIFICATION_GROUP}
  }
  notificationType {
    ${BASE_NOTIFICATION_TYPE}
  }`;

export const NOTIFICATION_COUNT = `aggregate {
    count
  }`;
