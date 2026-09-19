import { NotificationGroup } from "@ncfritz/olympus-model";
import { Injectable } from "@nestjs/common";
import { gql, GraphQLClient } from "graphql-request";
import {
  GraphQlNotificationGroup,
  toDomainObject,
} from "../converters/NotificationGroupConverter";

type GraphQlListNotificationGroupsResponse = {
  olympus_notification_groups: GraphQlNotificationGroup[];
};

/** Olympus notification groups in Hasura. */
@Injectable()
export class NotificationGroupService {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  /** Lists every group, with its notification types when requested. */
  async list(includeNotificationTypes: boolean): Promise<NotificationGroup[]> {
    const typesClause = includeNotificationTypes
      ? `notificationTypes {
      createdTime
      description
      id
      name
      supportsEmail
      supportsSynoChat
      supportsSynoMail
      supportsWebSocket
    }`
      : "";

    const queryRequest = gql`
      query ListNotificationGroups {
        olympus_notification_groups {
          createdTime
          description
          id
          name
          ${typesClause}
        }
      }
    `;

    const queryResponse =
      await this.graphQLClient.request<GraphQlListNotificationGroupsResponse>(
        queryRequest,
      );

    const notificationGroups: NotificationGroup[] = [];

    queryResponse.olympus_notification_groups.forEach((entry) => {
      notificationGroups.push(toDomainObject(entry));
    });

    return notificationGroups;
  }
}
