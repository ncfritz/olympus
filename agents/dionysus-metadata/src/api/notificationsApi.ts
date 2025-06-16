import axios from "axios";
import type {
  SendNotificationRequest,
  SendNotificationResponse,
} from "@ncfritz/olympus-model/dist/notifications";
import { BASE_URL } from "./apiBase";

const sendNotification = async (
  notification: SendNotificationRequest,
): Promise<SendNotificationResponse> => {
  const sendNotificationsResponse = await axios.post<
    SendNotificationRequest,
    SendNotificationResponse
  >(`${BASE_URL}/v1/notifications/publish`, notification, {
    validateStatus: (status) => {
      return status === 202 || status === 306;
    },
  });

  return sendNotificationsResponse;
};

const notificationsApi = {
  sendNotification: sendNotification,
};

export default notificationsApi;
