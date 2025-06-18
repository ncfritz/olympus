import axios from "axios";

const sendNotification = async (notification: any): Promise<any> => {
  try {
    const sendNotificationsResponse = await axios.post(
      `/api/v1/notifications/publish`,
      notification,
      {
        validateStatus: (status) => {
          return status === 202 || status === 306;
        },
      },
    );

    return sendNotificationsResponse;
  } catch (e) {
    throw e;
  }
};

const getUnreadNotificationsCount = async (): Promise<any> => {
  try {
    const getUnreadNotificationsCountResponse = await axios.get(
      `/api/v1/notifications/unreadCount`,
      {
        validateStatus: (status) => {
          return status === 200;
        },
      },
    );

    return getUnreadNotificationsCountResponse;
  } catch (e) {
    throw e;
  }
};

const listNotifications = async (count: number = 5): Promise<any> => {
  try {
    const listNotificationsResponse = await axios.get(
      `/api/v1/notifications?count=${count}`,
      {
        validateStatus: (status) => {
          return status === 200;
        },
      },
    );

    return listNotificationsResponse;
  } catch (e) {
    throw e;
  }
};

const listNotificationSettings = async (): Promise<any> => {
  try {
    const listNotificationSettingsResponse = await axios.get(
      `/api/v1/notifications/settings`,
      {
        validateStatus: (status) => {
          return status === 200;
        },
      },
    );

    return listNotificationSettingsResponse;
  } catch (e) {
    throw e;
  }
};

const listNotificationsInGroup = async (
  groupId: string,
  page: number,
  pageSize = 10,
): Promise<any> => {
  try {
    const listNotificationsInGroupResponse = await axios.get(
      `/api/v1/notifications/group/${groupId}/notifications?pageSize=${pageSize}&startPage=${page}&sortBy=createdTime&sort=desc`,
      {
        validateStatus: (status) => {
          return status === 200;
        },
      },
    );

    return listNotificationsInGroupResponse;
  } catch (e) {
    throw e;
  }
};

const listNotificationGroups = async (
  includeNotificationTypes: boolean = false,
): Promise<any> => {
  try {
    const listNotificationGroupsResponse = await axios.get(
      `/api/v1/notifications/groups?includeNotificationTypes=${includeNotificationTypes}`,
      {
        validateStatus: (status) => {
          return status === 200;
        },
      },
    );

    return listNotificationGroupsResponse;
  } catch (e) {
    throw e;
  }
};

const listNotificationTypes = async (): Promise<any> => {
  try {
    const listNotificatioTypesResponse = await axios.get(
      `/api/v1/notifications/types`,
      {
        validateStatus: (status) => {
          return status === 200;
        },
      },
    );

    return listNotificatioTypesResponse;
  } catch (e) {
    throw e;
  }
};

const acknowledgeNotification = async (
  notificationId: string,
  options: { acknowledged: boolean; ttl?: string } = {
    acknowledged: true,
    ttl: "P3D",
  },
): Promise<any> => {
  try {
    const acknowledgeNotificationResponse = await axios.put(
      `/api/v1/notification/${notificationId}/acknowledge`,
      options,
      {
        validateStatus: (status) => {
          return status === 200;
        },
      },
    );

    return acknowledgeNotificationResponse;
  } catch (e) {
    throw e;
  }
};

const deleteNotification = async (notificationId: string): Promise<any> => {
  try {
    const listNotificzationsResponse = await axios.delete(
      `/api/v1/notification/${notificationId}`,
      {
        validateStatus: (status) => {
          return status === 204;
        },
      },
    );

    return listNotificzationsResponse;
  } catch (e) {
    throw e;
  }
};

const updateNotificationSetting = async (
  notificationTypeId: string,
  notificationSetting: any,
): Promise<any> => {
  try {
    const updateNotificationSettingResponse = await axios.put(
      `/api/v1/notifications/settings/${notificationTypeId}`,
      notificationSetting,
      {
        validateStatus: (status) => {
          return status === 200;
        },
      },
    );

    return updateNotificationSettingResponse;
  } catch (e) {
    throw e;
  }
};

const notificationsApi = {
  acknowledgeNotification: acknowledgeNotification,
  getUnreadNotificationsCount: getUnreadNotificationsCount,
  sendNotification: sendNotification,
  deleteNotification: deleteNotification,
  listNotifications: listNotifications,
  listNotificationsInGroup: listNotificationsInGroup,
  listNotificationGroups: listNotificationGroups,
  listNotificationSettings: listNotificationSettings,
  listNotificationTypes: listNotificationTypes,
  updateNotificationSetting: updateNotificationSetting,
};

export default notificationsApi;
