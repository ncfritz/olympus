import {
  createNotification,
  type PartialNotification,
} from "@ncfritz/olympus-sdk/olympus";
import { Injectable } from "@nestjs/common";

/** Olympus notifications, through the SDK. */
@Injectable()
export class NotificationApi {
  /** Stores a notification (shown in the site's notification list). */
  async createNotification(notification: PartialNotification) {
    const response = await createNotification({ body: { notification } });
    return response.data!.notification;
  }
}
