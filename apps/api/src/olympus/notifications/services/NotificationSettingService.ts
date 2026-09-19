import {
  NotificationSetting,
  PartialNotificationSetting,
} from "@ncfritz/olympus-model";
import { Injectable } from "@nestjs/common";
import { gql, GraphQLClient } from "graphql-request";
import moment from "moment";
import {
  GraphQlNotificationSetting,
  toDomainObject as toNotificationSettingDomainObject,
} from "../converters/NotificationSettingConverter";
import {
  GraphQlFullNotificationType,
  toFullDomainObject as toNotificationTypeDomainObject,
} from "../converters/NotificationTypeConverter";
import { NOTIFICATION_SETTING } from "../queries/notificationSettings";
import { NOTIFICATION_TYPE_WITH_PROTOCOLS } from "../queries/notificationTypes";

type GraphQlListNotificationSettingsResponse = {
  olympus_notification_type: GraphQlFullNotificationType[];
  olympus_notification_settings: GraphQlNotificationSetting[];
};

type GraphQlInsertNotificationResponse = {
  insert_olympus_notification_settings_one: GraphQlNotificationSetting;
};

/** A user's per-type notification channel settings in Hasura. */
@Injectable()
export class NotificationSettingService {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  /**
   * The user's settings for every notification type, keyed by type ID; types
   * the user hasn't configured get the type's defaults.
   */
  async list(): Promise<Record<string, NotificationSetting>> {
    const queryRequest = gql`
      query ListNotificationSettings($username: String!) {
        olympus_notification_settings(where: { username: { _eq: $username } }) {
          ${NOTIFICATION_SETTING}
        }
        olympus_notification_type {
          ${NOTIFICATION_TYPE_WITH_PROTOCOLS}
          defaultGroupId
        }
      }
    `;

    const queryResponse =
      await this.graphQLClient.request<GraphQlListNotificationSettingsResponse>(
        queryRequest,
        // TODO: Replace with authenticated username once plumbed in
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

    return notificationSettings;
  }

  /** Creates or replaces the user's setting for a notification type. */
  async update(
    notificationTypeId: string,
    setting: PartialNotificationSetting,
  ): Promise<NotificationSetting> {
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
          ${NOTIFICATION_SETTING}
        }
      }
    `;

    // TODO: Plumb in username when available
    const variables = {
      notificationTypeId: notificationTypeId,
      username: "ncfritz",
      webSocket: setting.webSocketEnabled,
      synoChat: setting.synoChatEnabled,
      synoMail: setting.synoMailEnabled,
      email: setting.emailEnabled,
    };

    const updateResponse =
      await this.graphQLClient.request<GraphQlInsertNotificationResponse>(
        updateRequest,
        variables,
      );

    return toNotificationSettingDomainObject(
      updateResponse.insert_olympus_notification_settings_one,
    );
  }
}
