import { NotificationSetting } from "@ncfritz/olympus-model";
import moment from "moment";
import { toFullDomainObject as toNotificationTypeDomainObject } from "./NotificationTypeConverter";
import { GraphQlFullNotificationType } from "./NotificationTypeConverter";

export type GraphQlNotificationSetting = {
  createdTime: string;
  lastUpdatedTime?: string;
  username: string;
  notificationType: GraphQlFullNotificationType;
  webSocket: boolean;
  synoMail: boolean;
  synoChat: boolean;
  email: boolean;
};

export const toDomainObject = (
  input: GraphQlNotificationSetting,
): NotificationSetting => {
  return {
    createdTime: moment(input.createdTime),
    lastUpdatedTime: input.lastUpdatedTime
      ? moment(input.lastUpdatedTime)
      : undefined,
    notificationType: toNotificationTypeDomainObject(input.notificationType),
    webSocketEnabled: input.webSocket,
    synoMailEnabled: input.synoMail,
    synoChatEnabled: input.synoChat,
    emailEnabled: input.email,
  };
};
