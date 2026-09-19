import { BASE_NOTIFICATION_GROUP } from "./notificationGroups";

export const BASE_NOTIFICATION_TYPE = `createdTime
  defaultGroupId
  description
  id
  name`;

export const NOTIFICATION_TYPE_PROTOCOLS = `supportsEmail
  supportsSynoChat
  supportsSynoMail
  supportsWebSocket
  emailDefault
  synoChatDefault
  synoMailDefault
  webSocketDefault`;

export const NOTIFICATION_TYPE_WITH_PROTOCOLS = `createdTime
  description
  id
  name
  ${NOTIFICATION_TYPE_PROTOCOLS}
  defaultGroup {
    ${BASE_NOTIFICATION_GROUP}
  }`;
