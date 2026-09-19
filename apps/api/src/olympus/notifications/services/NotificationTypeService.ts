import { NotificationTypeWithProtocols } from "@ncfritz/olympus-model";
import { Injectable } from "@nestjs/common";
import { gql, GraphQLClient } from "graphql-request";
import {
  GraphQlFullNotificationType,
  toFullDomainObject,
} from "../converters/NotificationTypeConverter";
import { NOTIFICATION_TYPE_WITH_PROTOCOLS } from "../queries/notificationTypes";

type GraphQlListNotificationTypesResponse = {
  olympus_notification_type: GraphQlFullNotificationType[];
};

/** Olympus notification types in Hasura. */
@Injectable()
export class NotificationTypeService {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  /** Lists every notification type with its supported and default channels. */
  async list(): Promise<NotificationTypeWithProtocols[]> {
    const queryRequest = gql`
      query ListNotificationTypes {
        olympus_notification_type {
          ${NOTIFICATION_TYPE_WITH_PROTOCOLS}
        }
      }
    `;

    const queryResponse =
      await this.graphQLClient.request<GraphQlListNotificationTypesResponse>(
        queryRequest,
      );

    const notificationTypes: NotificationTypeWithProtocols[] = [];

    queryResponse.olympus_notification_type.forEach((entry) => {
      notificationTypes.push(toFullDomainObject(entry));
    });

    return notificationTypes;
  }
}
