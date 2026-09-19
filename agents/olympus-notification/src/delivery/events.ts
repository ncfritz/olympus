/**
 * The notification messages the API publishes, from the shared contract
 * (@ncfritz/olympus-messages). Handlers use them with the SDK's
 * NotificationContext or a narrower context type.
 */
export type {
  NotificationEvent,
  SmtpNotificationEvent,
  SynoChatNotificationEvent,
  WebSocketNotificationEvent,
} from "@ncfritz/olympus-messages";
