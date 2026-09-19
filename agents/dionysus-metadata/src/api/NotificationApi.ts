import { ExecuteWithMetrics } from "@ncfritz/olympus-nest";
import {
  sendNotification,
  type SendNotificationRequest,
  type SendNotificationResponse,
} from "@ncfritz/olympus-sdk/olympus";
import { Injectable } from "@nestjs/common";

/** Olympus notifications, through the SDK. */
@Injectable()
export class NotificationApi {
  @ExecuteWithMetrics("Olympus.SendNotification")
  async sendNotification(
    notification: SendNotificationRequest,
  ): Promise<SendNotificationResponse> {
    const response = await sendNotification({
      body: notification,
    });

    return response.data!;
  }
}
