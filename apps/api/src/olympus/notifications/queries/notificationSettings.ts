import { NOTIFICATION_TYPE_WITH_PROTOCOLS } from "./notificationTypes";

export const NOTIFICATION_SETTING_CHANNELS = `email
  synoChat
  synoMail
  webSocket`;

export const NOTIFICATION_SETTING = `createdTime
  lastUpdatedTime
  username
  ${NOTIFICATION_SETTING_CHANNELS}
  notificationType {
    ${NOTIFICATION_TYPE_WITH_PROTOCOLS}
  }`;
