import {
  createNotification,
  type PartialNotification,
  sendNotification,
  type SendNotificationRequest,
} from "@ncfritz/olympus-sdk/olympus";
import type { OlympusClients } from "../clients";

/** Olympus notifications. */
export class NotificationApi {
  constructor(private readonly clients: OlympusClients) {}

  /** Sends a notification to its channels (WebSocket, email, chat). */
  async sendNotification(notification: SendNotificationRequest) {
    const response = await sendNotification({
      client: this.clients.olympus,
      body: notification,
    });
    return response.data;
  }

  /** Stores a notification (the site's notification list). */
  async createNotification(notification: PartialNotification) {
    const response = await createNotification({
      client: this.clients.olympus,
      body: { notification },
    });
    return response.data.notification;
  }
}
