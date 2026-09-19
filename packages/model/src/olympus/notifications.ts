import { ApiTimestamp } from "../decorators";
import {
  ApiExtraModels,
  ApiProperty,
  getSchemaPath,
  OmitType,
} from "@nestjs/swagger";
import type { Moment } from "moment";
import { PaginatedResults } from "../common";

export enum WebSocketNotificationLevel {
  SUCCESS = "success",
  INFO = "info",
  WARNING = "warning",
  ERROR = "error",
}

export enum SynoChatDestinationType {
  BOT = "bot",
  CHANNEL = "channel",
}

export enum SMTPPriority {
  Highest = "1",
  High = "2",
  Normal = "3",
  Low = "4",
  Lowest = "5",
}

export enum DeliveryState {
  SUCCESS = "success",
  FAILURE = "failure",
  SKIPPED = "skipped",
  UNKNOWN = "unknown",
}

export class EmailValueField {
  @ApiProperty({
    type: String,
    required: true,
    description:
      "The email address.  This can be specified as a single address specification or as an angle " +
      "enclosed address, which contains a display name.  See https://datatracker.ietf.org/doc/html/rfc5322#section-3.4 " +
      "for details.",
  })
  value: string;
}

export class NotificationContext extends Object {}
export class NotificationPayload extends Object {}

export class WebSocketDestination {
  @ApiProperty({
    enum: () => WebSocketNotificationLevel,
    enumName: "WebSocketNotificationLevel",
    enumSchema: { description: "The severity level of a notification" },
    required: false,
    default: WebSocketNotificationLevel.INFO,
    description: "The severity of the notification to show in the UX.",
  })
  level?: WebSocketNotificationLevel = WebSocketNotificationLevel.INFO;

  @ApiProperty({
    type: Boolean,
    required: false,
    default: false,
    description:
      "Whether the notification should be persisted in the notification store.",
  })
  durable?: boolean = false;

  @ApiProperty({
    type: Boolean,
    required: false,
    default: false,
    description:
      "When `durable` is set to `true`, this flag determines whether the notification popup is displayed.  When set to" +
      "`true`, the notification will be persisted to the notification store but will not be displayed as a popup in" +
      "the UX.",
  })
  ghost?: boolean = false;

  @ApiProperty({
    type: Boolean,
    required: false,
    default: false,
    description:
      "Determines if the notification popup can be dismissed by the user.",
  })
  closable?: boolean = false;

  @ApiProperty({
    type: Boolean,
    required: false,
    default: false,
    description:
      "When `closeable` is set to `true` AND `durable` is set to `true`, this flag determines if the notification " +
      "should be removed from the notifications store on close.  Setting this to `false` will cause the close action " +
      "to only dismiss the notification popup.",
  })
  deleteOnClose?: boolean = false;

  @ApiProperty({
    type: Number,
    required: false,
    default: 4.5,
    description:
      "The amount of time, in seconds, to display the notification in the UX.",
  })
  visibleDuration?: number = 4.5;

  @ApiProperty({
    type: String,
    required: false,
    description:
      "An optional group name to add the notification to in the notification store.",
  })
  group?: string;

  @ApiProperty({
    type: String,
    required: false,
    description:
      "When `durable` is set to `true` determines how long the notification will remain in the notification store " +
      "before being automatically cleaned up.  Note that the TTL will cause a notification to be deleted from the " +
      "notification store whether it was read by the user or not.  This field should be specified as an ISO-8601 " +
      "duration string - i.e. PT24H or P1D",
  })
  ttl?: string;
}

export class SynoChatDestination {
  @ApiProperty({
    enum: () => SynoChatDestinationType,
    enumName: "SynoChatDestinationType",
    required: true,
    default: SynoChatDestinationType.CHANNEL,
    description:
      "Determines what type of chat notification is sent.  A Bot will be a direct conversation with an individual." +
      "A Channel will broadcast the message to all members of the channel.",
  })
  destinationType: SynoChatDestinationType = SynoChatDestinationType.CHANNEL;

  @ApiProperty({
    type: Number,
    required: false,
    isArray: true,
    default: [],
    description:
      "The Synology Chat user ID associated with the logged in user.  This is not the username or email used to " +
      "authenticate but is an internal identifier that needs to be determined by looking at network traffic.",
  })
  users?: number[] = [];

  @ApiProperty({
    type: String,
    required: true,
    description:
      "The name of the Bot or Channel to deliver the notification to.",
  })
  destination: string;
}

class BaseSMTPDestination {
  @ApiProperty({
    enum: () => SMTPPriority,
    enumName: "SMTPPriority",
    required: false,
    default: SMTPPriority.Normal,
    description: "The priority to mark the message with in the user's inbox.",
  })
  priority?: SMTPPriority = SMTPPriority.Normal;

  @ApiProperty({
    type: String,
    required: true,
    description:
      "The from address for the message.  This can be specified as a single address specification or as an angle " +
      "enclosed address, which contains a display name.  See https://datatracker.ietf.org/doc/html/rfc5322#section-3.4 " +
      "for details.",
  })
  from: string;

  @ApiProperty({
    type: String,
    required: false,
    description:
      "The optional reply to address for the message.  This can be specified as a single address specification or as " +
      "an angle enclosed address, which contains a display name.  See " +
      "https://datatracker.ietf.org/doc/html/rfc5322#section-3.4 for details.",
  })
  replyTo?: string;
}

export class SMTPDestination extends BaseSMTPDestination {
  @ApiProperty({
    type: String,
    required: true,
    isArray: true,
    description:
      "The primary recipient addresses for the message.  These can be specified as a single address specification or " +
      "as an angle enclosed address, which contains a display name.  See " +
      "https://datatracker.ietf.org/doc/html/rfc5322#section-3.4 for details.",
  })
  to: string[];

  @ApiProperty({
    type: String,
    required: false,
    isArray: true,
    description:
      "The optional recipients who should be copied on the messages.  These can be specified as a single address " +
      "specification or as an angle enclosed address, which contains a display name.  See " +
      "https://datatracker.ietf.org/doc/html/rfc5322#section-3.4 for details.",
  })
  cc?: string[];

  @ApiProperty({
    required: false,
    type: String,
    isArray: true,
    description:
      "The optional recipients who should be blind copied on the messages.  These can be specified as a single " +
      "address specification or as an angle enclosed address, which contains a display name.  See " +
      "https://datatracker.ietf.org/doc/html/rfc5322#section-3.4 for details.",
  })
  bcc?: string[];
}

export class SMTPDestinationFormInput extends BaseSMTPDestination {
  @ApiProperty({
    type: () => EmailValueField,
    required: true,
    isArray: true,
    description:
      "See `SMTPDestination` for details.  This variation of the class is tailored for form input, which requires " +
      "a wrapper with a `value` field.",
  })
  to: EmailValueField[];

  @ApiProperty({
    type: () => EmailValueField,
    required: false,
    isArray: true,
    description:
      "See `SMTPDestination` for details.  This variation of the class is tailored for form input, which requires " +
      "a wrapper with a `value` field.",
  })
  cc?: EmailValueField[];

  @ApiProperty({
    type: () => EmailValueField,
    required: false,
    isArray: true,
    description:
      "See `SMTPDestination` for details.  This variation of the class is tailored for form input, which requires " +
      "a wrapper with a `value` field.",
  })
  bcc?: EmailValueField[];
}

export class DeliveryStatus {
  @ApiProperty({
    type: String,
    required: true,
    description:
      "The unique identifier for the notification on a specific delivery channel",
  })
  eventId: string;

  @ApiProperty({
    enum: () => DeliveryState,
    required: true,
    enumName: "DeliveryState",
    description:
      "The status of the delivery to the associated notification channel",
  })
  status: DeliveryState;
}

export class Notification {
  @ApiProperty({
    type: String,
    required: true,
    description: "The unique ID for the notification event",
  })
  eventId: string;

  @ApiProperty({
    type: String,
    required: true,
    description:
      "The unique ID for the notification.  This ID is stable across notification channels",
  })
  notificationId: string;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the event occurred",
  })
  eventTime: Moment;

  @ApiProperty({
    type: () => NotificationType,
    required: true,
    description: "The notification type definition for the notification.",
  })
  notificationType: NotificationType;

  @ApiProperty({
    enum: () => WebSocketNotificationLevel,
    required: true,
    enumName: "WebSocketNotificationLevel",
    enumSchema: { description: "The severity level of a notification" },
    description: "The severity level for the notification.",
  })
  level: WebSocketNotificationLevel;

  @ApiProperty({
    type: Boolean,
    required: true,
    description:
      "Indicated whether the notification has been acknowledged by a user",
  })
  acknowledged: boolean;

  @ApiTimestamp({
    required: false,
    description:
      "If the notification has been acknowledged, the timestamp when it was acknowledged",
  })
  acknowledgedTime?: Moment;

  @ApiProperty({
    type: () => NotificationGroup,
    required: false,
    description: "The group the notification belongs to.",
  })
  notificationGroup?: NotificationGroup;

  @ApiTimestamp({
    required: false,
    description:
      "An ISO-8601 formatted string indicating when the notification will expire.",
  })
  expirationTime?: Moment;

  @ApiTimestamp({
    required: false,
    description:
      "An ISO-8601 formatted string indicating when the notification will be eligible for deletion.",
  })
  deletionTime?: Moment;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the notification was created.",
  })
  createdTime: Moment;

  @ApiProperty({
    type: () => NotificationPayload,
    required: true,
    description:
      "The payload for the notification.  This contains all information needed to render a notification.",
  })
  payload: NotificationPayload;

  @ApiProperty({
    type: String,
    required: false,
    description:
      "An ISO-8601 duration string - i.e. PT24H or P1D indicating when the notification will expire.",
  })
  ttl?: string;
}

export class PartialNotification extends OmitType(Notification, [
  "eventTime",
  "acknowledgedTime",
  "createdTime",
  "notificationType",
]) {
  @ApiProperty({
    type: String,
    required: false,
    description:
      "The Id of the notification group the notification should belong to.",
  })
  group?: string;

  @ApiProperty({
    type: String,
    required: true,
    description:
      "The notification type ID indicating what type of notification is being created.",
  })
  notificationType: string;
}

export class NotificationType {
  @ApiProperty({
    type: String,
    required: true,
    description: "The unique ID of the notification type.",
  })
  id: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The display name for the notification type",
  })
  name: string;

  @ApiProperty({
    type: String,
    required: false,
    description:
      "A description of the notification type.  This may indicate what the notification is used for or give " +
      "additional information about the system that published such notifications.",
  })
  description?: string;

  @ApiProperty({
    type: () => NotificationGroup,
    required: false,
    description:
      "The group that notifications of this type should belong to.  This grouping will be used when no group is " +
      "supplied when creating a notification.  If the default group is undefined, the system default will be used.",
  })
  defaultGroup?: NotificationGroup;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the notification type was created.",
  })
  createdTime: Moment;
}

export class NotificationTypeWithProtocols extends NotificationType {
  @ApiProperty({
    type: Boolean,
    required: true,
    description:
      "Indicates if the notification type can be delivered via WebSocket.",
  })
  supportsWebSocket: boolean;

  @ApiProperty({
    type: Boolean,
    required: true,
    description:
      "Indicates if the notification type can be delivered via Synology Chat.",
  })
  supportsSynoChat: boolean;

  @ApiProperty({
    type: Boolean,
    required: true,
    description:
      "Indicates if the notification type can be delivered via Synology Mail.",
  })
  supportsSynoMail: boolean;

  @ApiProperty({
    type: Boolean,
    required: true,
    description:
      "Indicates if the notification type can be delivered via SMTP (i.e. Gmail).",
  })
  supportsEmail: boolean;

  @ApiProperty({
    type: Boolean,
    required: true,
    description:
      "Indicates whether WebSocket notifications will be enabled by default.  This value will have no effect " +
      "if `supportsWebSocket` is `false`.  Any user configured settings will override this.",
  })
  webSocketDefault: boolean;

  @ApiProperty({
    type: Boolean,
    required: true,
    description:
      "Indicates whether Synology Chat notifications will be enabled by default.  This value will have no effect " +
      "if `supportsSynoChat` is `false`.  Any user configured settings will override this.",
  })
  synoChatDefault: boolean;

  @ApiProperty({
    type: Boolean,
    required: true,
    description:
      "Indicates whether Synology Mail notifications will be enabled by default.  This value will have no effect " +
      "if `supportsSynoMail` is `false`.  Any user configured settings will override this.",
  })
  synoMailDefault: boolean;

  @ApiProperty({
    type: Boolean,
    required: true,
    description:
      "Indicates whether SMTP notifications will be enabled by default.  This value will have no effect " +
      "if `supportsEmail` is `false`.  Any user configured settings will override this.",
  })
  emailDefault: boolean;
}

export class NotificationSetting {
  @ApiProperty({
    type: () => NotificationTypeWithProtocols,
    required: true,
    description:
      "The default settings for the notification type this setting overrides.",
  })
  notificationType: NotificationTypeWithProtocols;

  @ApiProperty({
    type: Boolean,
    required: true,
    description:
      "Indicates if the user wishes to receive WebSocket notifications for this notification type.",
  })
  webSocketEnabled: boolean;

  @ApiProperty({
    type: Boolean,
    required: true,
    description:
      "Indicates if the user wishes to receive Synology Chat notifications for this notification type.",
  })
  synoChatEnabled: boolean;

  @ApiProperty({
    type: Boolean,
    required: true,
    description:
      "Indicates if the user wishes to receive Synology Mail notifications for this notification type.",
  })
  synoMailEnabled: boolean;

  @ApiProperty({
    type: Boolean,
    required: true,
    description:
      "Indicates if the user wishes to receive SMTP notifications for this notification type.",
  })
  emailEnabled: boolean;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the notification setting was created.",
  })
  createdTime: Moment;

  @ApiTimestamp({
    required: false,
    description:
      "An ISO-8601 formatted string indicating when the notification setting was last updated.",
  })
  lastUpdatedTime?: Moment;
}

export class PartialNotificationSetting extends OmitType(NotificationSetting, [
  "notificationType",
  "createdTime",
  "lastUpdatedTime",
]) {}

export class NotificationGroup {
  @ApiProperty({
    type: String,
    required: true,
    description: "The unique ID associated with the notification group.",
  })
  id: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The display name for the notification group.",
  })
  name: string;

  @ApiProperty({
    type: String,
    required: true,
    description:
      "A description indicating the purpose for the notification group.",
  })
  description: string;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the notification group was created.",
  })
  createdTime: Moment;

  @ApiProperty({
    type: () => NotificationTypeWithProtocols,
    required: false,
    isArray: true,
    description:
      "The set of notification types associated with the notification group.",
  })
  notificationTypes?: NotificationTypeWithProtocols[];
}

export class NotificationStatistics {
  @ApiProperty({
    type: Number,
    required: true,
    description:
      "The total number of notifications, regardless of read status.",
  })
  total: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The total number of notifications that are unread.",
  })
  unread: number;

  @ApiProperty({
    type: Number,
    required: true,
    description:
      "The total number of notifications that are at an informational level.",
  })
  [WebSocketNotificationLevel.INFO]: number;

  @ApiProperty({
    type: Number,
    required: true,
    description:
      "The total number of notifications that are at an success level.",
  })
  [WebSocketNotificationLevel.SUCCESS]: number;

  @ApiProperty({
    type: Number,
    required: true,
    description:
      "The total number of notifications that are at an warning level.",
  })
  [WebSocketNotificationLevel.WARNING]: number;

  @ApiProperty({
    type: Number,
    required: true,
    description:
      "The total number of notifications that are at an error level.",
  })
  [WebSocketNotificationLevel.ERROR]: number;
}

export class SendNotificationRequest {
  @ApiProperty({
    type: String,
    required: true,
    description: "The type of message to enqueue.",
  })
  type: string;

  @ApiTimestamp({
    required: false,
    description:
      "An ISO-8601 formatted string indicating when a message should expire and subsequently be dropped from delivery.",
  })
  expirationTime?: Moment;

  @ApiProperty({
    type: () => NotificationContext,
    required: false,
    default: {},
    description:
      "A free-form key/value store, which can contain multiple nested levels of data if needed.  The context should " +
      "generally contain fixed/immutable data such as identifiers or other stable data components.  Notifications " +
      "handlers and processors use the context to understand what data to fetch from upstream systems for inclusion in " +
      "notifications.",
  })
  context?: NotificationContext;

  @ApiProperty({
    type: () => WebSocketDestination,
    required: false,
    description:
      "When included, will cause the notification to be delivered in Olympus via WebSocket.",
  })
  webSocketDestination?: WebSocketDestination;

  @ApiProperty({
    type: () => SynoChatDestination,
    required: false,
    description:
      "When included, will cause the notification to be delivered via Synology Chat",
  })
  synoChatDestination?: SynoChatDestination;

  @ApiProperty({
    type: () => SMTPDestinationFormInput,
    required: false,
    description:
      "When included, will cause the notification to be delivered via Synology Email",
  })
  synoMailDestination?: SMTPDestinationFormInput;

  @ApiProperty({
    type: () => SMTPDestinationFormInput,
    required: false,
    description:
      "When included, will cause the notification to be delivered via external email",
  })
  smtpDestination?: SMTPDestinationFormInput;
}

export class SendNotificationResponse {
  @ApiProperty({
    type: String,
    required: true,
    description:
      "The ID of the notification.  The notification ID will be stable across all delivery channels.",
  })
  notificationId: string;

  @ApiProperty({
    type: () => DeliveryStatus,
    required: false,
    description: "Status information for delivery to the WebSocket channel",
  })
  webSocketDestination?: DeliveryStatus;

  @ApiProperty({
    type: () => DeliveryStatus,
    required: false,
    description: "Status information for delivery to the Synology Chat channel",
  })
  synoChatDestination?: DeliveryStatus;

  @ApiProperty({
    type: () => DeliveryStatus,
    required: false,
    description:
      "Status information for delivery to the Synology email channel",
  })
  synoMailDestination?: DeliveryStatus;

  @ApiProperty({
    type: () => DeliveryStatus,
    required: false,
    description: "Status information for delivery to the SMTP channel",
  })
  externalMailDestination?: DeliveryStatus;
}

export class AcknowledgeNotificationRequest {
  @ApiProperty({
    type: Boolean,
    required: false,
    default: false,
    description:
      "The ID of the notification.  The notification ID will be stable across all delivery channels.",
  })
  acknowledged?: boolean = false;

  @ApiProperty({
    type: String,
    required: false,
    description:
      "An ISO-8601 duration string - i.e. PT24H or P1D, indicating how long before the acknowledged notification " +
      "should be deleted.  Note: this has no effect if the `acknowledged` parameter is `false`.",
    default: "P3D",
  })
  ttl?: string = "P3D";
}

export class CreateNotificationRequest {
  @ApiProperty({
    type: () => PartialNotification,
    required: true,
    description: "The details of the notification to create.",
  })
  notification: PartialNotification;
}

export class CreateNotificationResponse {
  @ApiProperty({
    type: () => Notification,
    required: true,
    description: "The full notification as it was created.",
  })
  notification: Notification;
}

export class AcknowledgeNotificationResponse {
  @ApiProperty({
    type: () => Notification,
    required: true,
    description: "The updated notification",
  })
  notification: Notification;
}

export class ListNotificationsRequest {}

@ApiExtraModels(NotificationStatistics)
export class ListNotificationsResponse {
  @ApiProperty({
    type: () => Notification,
    required: true,
    isArray: true,
    description:
      "A list of recent notifications.  These may belong to any notification group.",
  })
  recent: Notification[];

  @ApiProperty({
    type: Object,
    required: true,
    additionalProperties: {
      $ref: getSchemaPath(NotificationStatistics),
    },
    description: "A map of notification group IDs to statistics for the group.",
  })
  statistics: Record<string, NotificationStatistics>;
}

export class ListNotificationGroupsRequest {}

export class ListNotificationGroupsResponse {
  @ApiProperty({
    type: () => NotificationGroup,
    required: true,
    isArray: true,
    description: "A list of notification groups.",
  })
  groups: NotificationGroup[];
}

export class ListNotificationsInGroupRequest {}

export class ListNotificationsInGroupResponse extends PaginatedResults {
  @ApiProperty({
    type: () => Notification,
    required: true,
    isArray: true,
    description: "A list of notifications present in the notification group.",
  })
  notifications: Notification[];
}

export class DeleteNotificationResponse {
  @ApiProperty({
    type: () => Notification,
    required: true,
    description: "The notification that was removed.",
  })
  notification: Notification;
}

export class GetUnreadNotificationCountResponse {
  @ApiProperty({
    type: Number,
    required: true,
    description:
      "The number of notifications that are currently marked as unread.",
  })
  unreadCount: number;
}

export class UpdateNotificationSettingRequest {
  @ApiProperty({
    type: () => PartialNotificationSetting,
    required: true,
    description: "The notification setting to update.",
  })
  notificationSetting: PartialNotificationSetting;
}

export class UpdateNotificationSettingResponse {
  @ApiProperty({
    type: () => NotificationSetting,
    required: true,
    description: "The notification setting with updates applied.",
  })
  notificationSetting: NotificationSetting;
}

@ApiExtraModels(NotificationSetting)
export class LiatNotificationSettingsResponse {
  @ApiProperty({
    type: Object,
    required: true,
    additionalProperties: {
      $ref: getSchemaPath(NotificationSetting),
    },
    description: "The notification settings for the user.",
  })
  notificationSettings: Record<string, NotificationSetting>;
}

export class ListNotificationTypesResponse {
  @ApiProperty({
    type: () => NotificationTypeWithProtocols,
    required: true,
    isArray: true,
    description: "The set of all notification types supported.",
  })
  notificationTypes: NotificationTypeWithProtocols[];
}
