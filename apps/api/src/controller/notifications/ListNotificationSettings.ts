import {
  LiatNotificationSettingsResponse,
  NotificationSetting,
} from "@ncfritz/olympus-model/dist/notifications";
import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProduces } from "@nestjs/swagger";
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import moment from "moment";
import { toFullDomainObject as toNotificationTypeDomainObject } from "../../convert/notifications/NotificationTypeConverter";
import { toDomainObject as toNotificationSettingDomainObject } from "../../convert/notifications/NotificationSettingConverter";
import { GraphQlNotificationSetting } from "../../convert/notifications/NotificationSettingConverter";
import { GraphQlFullNotificationType } from "../../convert/notifications/NotificationTypeConverter";
import { ApiStandardErrorResponses } from "../../utils/controllerDecorators";

type GraphQlListNotificationSettingsResponse = {
  olympus_notification_type: GraphQlFullNotificationType[];
  olympus_notification_settings: GraphQlNotificationSetting[];
};

@Controller()
export class ListNotificationSettingsController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/v1/notifications/settings")
  @ApiOperation({
    summary: "Lists notification settings for a user",
    description:
      "Lists the notification settings a user has configured.  This API returns notification settings across all" +
      "channels ",
    operationId: "ListNotificationSettings",
    tags: ["Notifications"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    description: "The notification settings were successfully fetched.",
    type: LiatNotificationSettingsResponse,
  })
  @ApiStandardErrorResponses()
  async handle(@Res() response: Response): Promise<void> {
    const queryRequest = gql`
      query ListNotificationSettings($username: String!) {
        olympus_notification_settings(where: { username: { _eq: $username } }) {
          createdTime
          lastUpdatedTime
          username
          webSocket
          synoMail
          synoChat
          email
          notificationType {
            createdTime
            description
            id
            name
            supportsEmail
            supportsSynoChat
            supportsSynoMail
            supportsWebSocket
            webSocketDefault
            synoMailDefault
            synoChatDefault
            emailDefault
            defaultGroup {
              createdTime
              description
              id
              name
            }
          }
        }
        olympus_notification_type {
          webSocketDefault
          synoMailDefault
          synoChatDefault
          emailDefault
          supportsWebSocket
          supportsSynoMail
          supportsSynoChat
          supportsEmail
          name
          id
          description
          defaultGroupId
          createdTime
          defaultGroup {
            createdTime
            description
            id
            name
          }
        }
      }
    `;

    const queryResponse =
      await this.graphQLClient.request<GraphQlListNotificationSettingsResponse>(
        queryRequest,
        { username: "ncfritz" },
      );

    const notificationSettings: Record<string, NotificationSetting> = {};

    queryResponse.olympus_notification_type.forEach((item) => {
      const notificationType = toNotificationTypeDomainObject(item);
      notificationSettings[notificationType.id] = {
        notificationType: notificationType,
        createdTime: moment().utc(),
        webSocketEnabled: notificationType.webSocketDefault,
        synoChatEnabled: notificationType.synoChatDefault,
        synoMailEnabled: notificationType.synoMailDefault,
        emailEnabled: notificationType.emailDefault,
      };
    });

    queryResponse.olympus_notification_settings.forEach((item) => {
      const notificationSetting = toNotificationSettingDomainObject(item);
      notificationSettings[notificationSetting.notificationType.id] =
        notificationSetting;
    });

    const responseBody: LiatNotificationSettingsResponse = {
      notificationSettings: notificationSettings,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
