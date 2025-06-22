import { ApiProperty, OmitType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { Moment } from "moment";
import { PaginatedResults } from "../ModelCommon";

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
  SIPPED = "sipped",
  UNKNOWN = "unknown",
}

export class ValueField {
  value: string;
}

export class NotificationContext extends Object {}

export class WebSocketDestination {
  @ApiProperty({
    enum: WebSocketNotificationLevel,
    default: WebSocketNotificationLevel.INFO,
    description: "The severity of the notification to show in the UX.",
  })
  level?: WebSocketNotificationLevel = WebSocketNotificationLevel.INFO;

  @ApiProperty({
    type: Boolean,
    default: false,
    description:
      "Whether the notification should be persisted in the notification store.",
  })
  durable?: boolean = false;

  @ApiProperty({
    type: Boolean,
    default: false,
    description:
      "When `durable` is set to `true`, this flag determines whether the notification popup is displayed.  When set to" +
      "`true`, the notification will be persisted to the notification store but will not be displayed as a popup in" +
      "the UX.",
  })
  ghost?: boolean = false;

  @ApiProperty({
    type: Boolean,
    default: false,
    description:
      "Determines if the notification popup can be dismissed by the user.",
  })
  closable?: boolean = false;

  @ApiProperty({
    type: Boolean,
    default: false,
    description:
      "When `closeable` is set to `true` AND `durable` is set to `true`, this flag determines if the notification " +
      "should be removed from the notifications store on close.  Setting this to `false` will cause the close action " +
      "to only dismiss the notification popup.",
  })
  deleteOnClose?: boolean = false;

  @ApiProperty({
    type: Number,
    default: 4.5,
    description:
      "The amount of time, in seconds, to display the notification in the UX.",
  })
  visibleDuration?: number = 4.5;

  @ApiProperty({
    type: String,
    description:
      "An optional group name to add the notification to in the notification store.",
  })
  group?: string;

  @ApiProperty({
    type: String,
    description:
      "When `durable` is set to `true` determines how long the notification will remain in the notification store " +
      "before being automatically cleaned up.  Note that the TTL will cause a notification to be deleted from the " +
      "notification store whether it was read by the user or not.  This field should be specified as an ISO 8601 " +
      "duration string - i.e. PT24H or P1D",
  })
  ttl?: string;
}

export class SynoChatDestination {
  @ApiProperty({
    enum: SynoChatDestinationType,
    default: SynoChatDestinationType.CHANNEL,
    description:
      "Determines what type of chat notification is sent.  A Bot will be a direct conversation with an individual." +
      "A Channel will broadcast the message to all members of the channel.",
  })
  destinationType: SynoChatDestinationType = SynoChatDestinationType.CHANNEL;

  @ApiProperty({
    type: Number,
    isArray: true,
    description:
      "The Synology Chat user ID associated with the logged in user.  This is not the username or email used to " +
      "authenticate but is an internal identifier that needs to be determined by looking at network traffic.",
  })
  users?: number[] = [];

  @ApiProperty({
    type: String,
    description:
      "The name of the Bot or Channel to deliver the notification to.",
  })
  destination: string;
}

export class SMTPDestination {
  @ApiProperty({
    enum: SMTPPriority,
    default: SMTPPriority.Normal,
    description: "The priority to mark the message with in the user's inbox.",
  })
  priority?: SMTPPriority = SMTPPriority.Normal;

  @ApiProperty({
    type: String,
    description:
      "The from address for the message.  This can be specified as a single address specification or as an angle " +
      "enclosed address, which contains a display name.  See https://datatracker.ietf.org/doc/html/rfc5322#section-3.4 " +
      "for details.",
  })
  from: string;

  @ApiProperty({
    type: String,
    description:
      "The optional reply to address for the message.  This can be specified as a single address specification or as " +
      "an angle enclosed address, which contains a display name.  See " +
      "https://datatracker.ietf.org/doc/html/rfc5322#section-3.4 for details.",
  })
  @ApiProperty({ type: String })
  replyTo?: string;

  @ApiProperty({
    type: String,
    isArray: true,
    description:
      "The primary recipient addresses for the message.  These can be specified as a single address specification or " +
      "as an angle enclosed address, which contains a display name.  See " +
      "https://datatracker.ietf.org/doc/html/rfc5322#section-3.4 for details.",
  })
  @ApiProperty({ type: String, isArray: true })
  to: ValueField[];

  @ApiProperty({
    type: String,
    isArray: true,
    description:
      "The optional recipients who should be copied on the messages.  These can be specified as a single address " +
      "specification or as an angle enclosed address, which contains a display name.  See " +
      "https://datatracker.ietf.org/doc/html/rfc5322#section-3.4 for details.",
  })
  @ApiProperty({ type: String, isArray: true })
  cc?: ValueField[];

  @ApiProperty({
    type: String,
    isArray: true,
    description:
      "The optional recipients who should be blind copied on the messages.  These can be specified as a single " +
      "address specification or as an angle enclosed address, which contains a display name.  See " +
      "https://datatracker.ietf.org/doc/html/rfc5322#section-3.4 for details.",
  })
  @ApiProperty({ type: String, isArray: true })
  bcc?: ValueField[];
}

export class DeliveryStatus {
  @ApiProperty({
    type: String,
    description:
      "The unique identifier for the notification on a specific delivery channel.",
  })
  eventId: string;

  @ApiProperty({
    enum: DeliveryState,
    description:
      "The status of the delivery to the associated notification channel",
  })
  status: DeliveryState;
}

export class Notification {
  eventId: string;
  notificationId: string;
  eventTime: Moment;
  notificationType: NotificationType;
  level: WebSocketNotificationLevel;
  acknowledged: boolean;
  acknowledgedTime?: Moment;
  notificationGroup?: NotificationGroup;
  expirationTime?: Moment;
  deletionTime?: Moment;
  createdTime: Moment;
  payload: any;
  ttl?: string;
}

export class PartialNotification extends OmitType(Notification, [
  "eventTime",
  "acknowledgedTime",
  "createdTime",
  "notificationType",
]) {
  group?: string;
  notificationType: string;
}

export class NotificationType {
  id: string;
  name: string;
  description?: string;
  defaultGroup?: NotificationGroup;
  createdTime: Moment;
}

export class NotificationTypeWithProtocols extends NotificationType {
  supportsWebSocket: boolean;
  supportsSynoChat: boolean;
  supportsSynoMail: boolean;
  supportsEmail: boolean;
  webSocketDefault: boolean;
  synoChatDefault: boolean;
  synoMailDefault: boolean;
  emailDefault: boolean;
}

export class NotificationSetting {
  notificationType: NotificationTypeWithProtocols;
  webSocketEnabled: boolean;
  synoChatEnabled: boolean;
  synoMailEnabled: boolean;
  emailEnabled: boolean;
  createdTime: Moment;
  lastUpdatedTime?: Moment;
}

export class PartialNotificationSetting extends OmitType(NotificationSetting, [
  "notificationType",
  "createdTime",
  "lastUpdatedTime",
]) {}

export class NotificationGroup {
  id: string;
  name: string;
  description: string;
  createdTime: Moment;
  notificationTypes?: NotificationTypeWithProtocols[];
}

export class NotificationStatistics {
  total: number;
  unread: number;
  [WebSocketNotificationLevel.INFO]: number;
  [WebSocketNotificationLevel.SUCCESS]: number;
  [WebSocketNotificationLevel.WARNING]: number;
  [WebSocketNotificationLevel.ERROR]: number;
}

export class SendNotificationRequest {
  @ApiProperty({
    type: String,
    description: "The type of message to enqueue.",
  })
  type: string;

  @ApiProperty({
    type: String,
    description:
      "An ISO-8601 formatted string indicating when a message should expire and subsequently be dropped from delivery.",
  })
  @Transform(({ value }) => (value ? value.toISOString() : undefined))
  expirationTime?: Moment;

  @ApiProperty({
    type: () => NotificationContext,
    description:
      "A free-form key/value store, which can contain multiple nested levels of data if needed.  The context should " +
      "generally contain fixed/immutable data such as identifiers or other stable data components.  Notifications " +
      "handlers and processors use the context to understand what data to fetch from upstream systems for inclusion in " +
      "notifications.",
  })
  context: NotificationContext;

  @ApiProperty({
    type: () => WebSocketDestination,
    description:
      "When included, will cause the notification to be delivered in Olympus via WebSocket.",
  })
  webSocketDestination?: WebSocketDestination;

  @ApiProperty({
    type: () => SynoChatDestination,
    description:
      "When included, will cause the notification to be delivered via Synology Chat",
  })
  synoChatDestination?: SynoChatDestination;

  @ApiProperty({
    type: () => SMTPDestination,
    description:
      "When included, will cause the notification to be delivered via Synology Email",
  })
  synoMailDestination?: SMTPDestination;

  @ApiProperty({
    type: () => SMTPDestination,
    description:
      "When included, will cause the notification to be delivered via external email",
  })
  @ApiProperty({ type: () => SMTPDestination })
  smtpDestination?: SMTPDestination;
}

export class SendNotificationResponse {
  @ApiProperty({
    type: String,
    description:
      "The ID of the notification.  The notification ID will be stable across all delivery channels.",
  })
  notificationId: string;

  @ApiProperty({
    type: () => DeliveryStatus,
    description: "Status information for delivery to the WebSocket channel",
  })
  webSocketDestination?: DeliveryStatus;

  @ApiProperty({
    type: () => DeliveryStatus,
    description: "Status information for delivery to the Synology Chat channel",
  })
  synoChatDestination?: DeliveryStatus;

  @ApiProperty({
    type: () => DeliveryStatus,
    description:
      "Status information for delivery to the Synology email channel",
  })
  synoMailDestination?: DeliveryStatus;

  @ApiProperty({
    type: () => DeliveryStatus,
    description: "Status information for delivery to the SMTP channel",
  })
  externalMailDestination?: DeliveryStatus;
}

export class AcknowledgeNotificationRequest {
  @ApiProperty({
    type: String,
    description:
      "The ID of the notification.  The notification ID will be stable across all delivery channels.",
  })
  acknowledged?: boolean = false;

  @ApiProperty({
    type: String,
    description:
      "An ISO 8601 duration string - i.e. PT24H or P1D, indicating how long before the acknowledged notification " +
      "should be deleted.  Note: this has no effect if the `acknowledged` parameter is `false`.",
    default: "P3D",
  })
  ttl?: string = "P3D";
}

export class CreateNotificationRequest {
  notification: PartialNotification;
}

export class CreateNotificationResponse {
  notification: Notification;
}

export class AcknowledgeNotificationResponse {
  @ApiProperty({
    type: () => Notification,
    description: "The updated notification",
  })
  notification: Notification;
}

export class ListNotificationsRequest {}

export class ListNotificationsResponse {
  recent: Notification[];
  statistics: Record<string, NotificationStatistics>;
}

export class ListNotificationGroupsRequest {}

export class ListNotificationGroupsResponse {
  groups: NotificationGroup[];
}

export class ListNotificationsInGroupRequest {}

export class ListNotificationsInGroupResponse extends PaginatedResults {
  notifications: Notification[];
}

export class DeleteNotificationResponse {
  notification: Notification;
}

export class GetUnreadNotificationCountResponse {
  unreadCount: number;
}

export class UpdateNotificationSettingRequest {
  notificationSetting: PartialNotificationSetting;
}

export class UpdateNotificationSettingResponse {
  notificationSetting: NotificationSetting;
}

export class LiatNotificationSettingsResponse {
  notificationSettings: Record<string, NotificationSetting>;
}

export class ListNotificationTypesResponse {
  notificationTypes: NotificationTypeWithProtocols[];
}
