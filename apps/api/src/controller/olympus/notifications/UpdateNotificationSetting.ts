import {
  UpdateNotificationSettingRequest,
  UpdateNotificationSettingResponse,
} from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Param, Put, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import {
  GraphQlNotificationSetting,
  toDomainObject,
} from "../../../convert/olympus/notifications/NotificationSettingConverter";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";

type GraphQlInsertNotificationResponse = {
  insert_olympus_notification_settings_one: GraphQlNotificationSetting;
};

@Controller({ version: "1" })
export class UpdateNotificationSettingController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Put("/notifications/settings/:notificationType")
  @ApiOperation({
    summary: "Creates or updates a single notification setting",
    description:
      "Creates or updates a single notification setting for a user.  This API will update the notification settings " +
      "for all notification channels supported by the notification settings.",
    operationId: "UpdateNotificationSetting",
    tags: ["Notifications"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({
    name: "notificationType",
    type: String,
    description: "The notification type to set the channel settings for",
  })
  @ApiBody({
    type: UpdateNotificationSettingRequest,
    required: true,
    description: "Input for the CreateNotification operation",
  })
  @ApiOkResponse({
    type: UpdateNotificationSettingResponse,
    description: "The notification settings were successfully updated.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("notificationType") notificationTypeId: string,
    @Body() request: UpdateNotificationSettingRequest,
    @Res() response: Response,
  ): Promise<void> {
    const updateRequest = gql`
      mutation UpsertNotificationSetting(
        $email: Boolean!
        $synoChat: Boolean!
        $synoMail: Boolean!
        $username: String!
        $webSocket: Boolean!
        $notificationTypeId: String!
      ) {
        insert_olympus_notification_settings_one(
          object: {
            email: $email
            synoMail: $synoMail
            synoChat: $synoChat
            webSocket: $webSocket
            username: $username
            notificationTypeId: $notificationTypeId
          }
          on_conflict: {
            constraint: notification_settings_pkey
            update_columns: [webSocket, synoChat, synoMail, email]
          }
        ) {
          createdTime
          email
          lastUpdatedTime
          notificationType {
            createdTime
            defaultGroup {
              createdTime
              description
              id
              name
            }
            description
            emailDefault
            id
            name
            supportsEmail
            supportsSynoChat
            supportsSynoMail
            supportsWebSocket
            synoChatDefault
            synoMailDefault
            webSocketDefault
          }
          synoChat
          synoMail
          username
          webSocket
        }
      }
    `;

    // TODO: Plumb in username when available
    const variables = {
      notificationTypeId: notificationTypeId,
      username: "ncfritz",
      webSocket: request.notificationSetting.webSocketEnabled,
      synoChat: request.notificationSetting.synoChatEnabled,
      synoMail: request.notificationSetting.synoMailEnabled,
      email: request.notificationSetting.emailEnabled,
    };

    const updateResponse =
      await this.graphQLClient.request<GraphQlInsertNotificationResponse>(
        updateRequest,
        variables,
      );

    const responseBody: UpdateNotificationSettingResponse = {
      notificationSetting: toDomainObject(
        updateResponse.insert_olympus_notification_settings_one,
      ),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
