import {
  NotificationTypeWithProtocols,
  NotificationType,
} from "@ncfritz/olympus-model";
import moment from "moment";
import { GraphQlNotificationGroup } from "./NotificationGroupConverter";
import { toDomainObject as toNotificationGroupDomainObject } from "./NotificationGroupConverter";

export type GraphQlNotificationType = {
  id: string;
  name: string;
  description?: string;
  defaultGroup?: GraphQlNotificationGroup;
  createdTime: string;
};

export type GraphQlFullNotificationType = GraphQlNotificationType & {
  supportsWebSocket: boolean;
  supportsSynoChat: boolean;
  supportsSynoMail: boolean;
  supportsEmail: boolean;
  webSocketDefault: boolean;
  synoChatDefault: boolean;
  synoMailDefault: boolean;
  emailDefault: boolean;
};

export const toDomainObject = (
  input: GraphQlNotificationType,
): NotificationType => {
  const notificationType: NotificationType = {
    id: input.id,
    name: input.name,
    description: input.description,
    createdTime: moment(input.createdTime),
  };

  if (input.defaultGroup) {
    notificationType.defaultGroup = toNotificationGroupDomainObject(
      input.defaultGroup,
    );
  }

  return notificationType;
};

export const toFullDomainObject = (
  input: GraphQlFullNotificationType,
): NotificationTypeWithProtocols => {
  // @ts-expect-error loosely build and then augment with support vars
  const notificationType: NotificationGroupWithProtocols =
    toDomainObject(input);
  notificationType.supportsWebSocket = input.supportsWebSocket;
  notificationType.supportsSynoChat = input.supportsSynoChat;
  notificationType.supportsSynoMail = input.supportsSynoMail;
  notificationType.supportsEmail = input.supportsEmail;
  notificationType.webSocketDefault = input.webSocketDefault;
  notificationType.synoChatDefault = input.synoChatDefault;
  notificationType.synoMailDefault = input.synoMailDefault;
  notificationType.emailDefault = input.emailDefault;

  return notificationType;
};
