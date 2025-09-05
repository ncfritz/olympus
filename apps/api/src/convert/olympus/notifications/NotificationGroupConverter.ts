import { NotificationGroup } from "@ncfritz/olympus-model";
import moment from "moment/moment";
import { GraphQlFullNotificationType } from "./NotificationTypeConverter";
import { toFullDomainObject } from "./NotificationTypeConverter";

export type GraphQlNotificationGroup = {
  id: string;
  name: string;
  description: string;
  createdTime: string;
  notificationTypes?: GraphQlFullNotificationType[];
};

export const toDomainObject = (
  input: GraphQlNotificationGroup,
): NotificationGroup => {
  const notificationGroup: NotificationGroup = {
    id: input.id,
    name: input.name,
    description: input.description,
    createdTime: moment(input.createdTime),
  };

  if (input.notificationTypes) {
    notificationGroup.notificationTypes = input.notificationTypes.map(
      (entry) => {
        return toFullDomainObject(entry);
      },
    );
  }

  return notificationGroup;
};
