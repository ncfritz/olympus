import { Injectable } from "@nestjs/common";
import {
  sendNotification,
  type SendNotificationRequest,
  type SendNotificationResponse,
} from "@ncfritz/olympus-sdk/olympus";

/** Olympus notifications, through the SDK. */
@Injectable()
export class NotificationApi {
  async sendNotification(
    notification: SendNotificationRequest,
  ): Promise<SendNotificationResponse> {
    const response = await sendNotification({
      body: notification,
    });

    return response.data!;
  }
}
