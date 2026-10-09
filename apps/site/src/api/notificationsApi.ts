import {
  acknowledgeNotification,
  deleteNotification,
  getUnreadNotificationCount,
  listNotifications,
  listNotificationGroups,
  listNotificationsTypes,
  listNotificationSettings,
  listNotificationsInGroup,
  sendNotification,
  updateNotificationSetting,
  type SendNotificationRequest,
  type UpdateNotificationSettingRequest,
  client,
} from "@ncfritz/olympus-sdk/olympus";

class NotificationsApi {
  constructor() {
    client.setConfig({
      baseURL: "/api/v1",
      throwOnError: true,
    });
  }

  async sendNotification(notification: SendNotificationRequest) {
    return await sendNotification({
      body: notification,
    });
  }

  async getUnreadNotificationsCount() {
    return await getUnreadNotificationCount();
  }

  async listNotifications(count: number = 5) {
    return await listNotifications({
      query: {
        count: count,
      },
    });
  }

  async listNotificationSettings() {
    return await listNotificationSettings();
  }

  async listNotificationsInGroup(groupId: string, page: number, pageSize = 10) {
    return await listNotificationsInGroup({
      path: {
        groupId: groupId,
      },
      query: {
        pageSize: pageSize,
        startPage: page,
        sort: undefined,
        sortBy: undefined,
      },
    });
  }

  async listNotificationGroups(includeNotificationTypes: boolean = false) {
    return await listNotificationGroups({
      query: {
        includeNotificationTypes: includeNotificationTypes,
      },
    });
  }

  async listNotificationTypes() {
    return await listNotificationsTypes();
  }

  async acknowledgeNotification(
    notificationId: string,
    options: { acknowledged: boolean; ttl?: string } = {
      acknowledged: true,
      ttl: "P3D",
    },
  ) {
    return acknowledgeNotification({
      path: { notificationId: notificationId },
      body: {
        acknowledged: options.acknowledged,
        ttl: options.ttl || "P3D",
      },
    });
  }

  async deleteNotification(notificationId: string) {
    return await deleteNotification({
      path: { notificationId: notificationId },
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  async updateNotificationSetting(
    notificationType: string,
    notificationSetting: UpdateNotificationSettingRequest,
  ) {
    return await updateNotificationSetting({
      path: { notificationType: notificationType },
      body: notificationSetting,
    });
  }
}

const notificationsApi = new NotificationsApi();
export default notificationsApi;
