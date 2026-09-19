import {
  client,
  sendNotification,
  type SendNotificationRequest,
  type SendNotificationResponse,
} from "@ncfritz/olympus-sdk/olympus";
import { BASE_URL } from "./apiBase";

class NotificationsApi {
  constructor() {
    client.setConfig({
      baseURL: BASE_URL,
      throwOnError: true,
    });
  }

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
