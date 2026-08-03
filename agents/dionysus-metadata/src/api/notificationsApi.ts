import {
  client,
  sendNotification,
  type SendNotificationRequest,
  type SendNotificationResponse,
} from "@ncfritz/olympus-sdk/olympus";
import { BASE_URL } from "./apiBase";
import { ExecuteWithMetrics } from "./executeDecorators";

class NotificationsApi {
  constructor() {
    client.setConfig({
      baseURL: BASE_URL,
      throwOnError: true,
    });
  }

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

const notificationsApi = new NotificationsApi();
export default notificationsApi;
