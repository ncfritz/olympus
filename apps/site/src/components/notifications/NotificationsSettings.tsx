import { Alert, Button, Empty, Space, Spin, Typography } from "antd";
import { type ReactNode, useEffect, useState } from "react";
import { v4 as uuid } from "uuid";
import notificationsApi from "../../api/notificationsApi";
import RotatedTableHeader from "../layout/RotatedTableHeader";
import NotificationSettingsListEntry from "./NotificationSettingsListEntry";

export interface NotificationSettingsProps {}

const NotificationSettings: React.FunctionComponent<
  NotificationSettingsProps
> = ({}: NotificationSettingsProps) => {
  const [notificationGroups, setNotificationGroups] = useState<any[]>([]);
  const [notificationSettings, setNotificationSettings] =
    useState<Record<string, any>>();
  const [notificationGroupsLoading, setNotificationGroupsLoading] =
    useState<boolean>(false);
  const [notificationGroupsError, setNotificationGroupsError] =
    useState<any>(undefined);

  const fetchNotificationGroupsList = async () => {
    setNotificationGroupsLoading(true);
    setNotificationGroupsError(undefined);

    try {
      const listNotificationGroupsResponse =
        await notificationsApi.listNotificationGroups(true);
      setNotificationGroups(listNotificationGroupsResponse.data.groups);

      const listNotificationSettingsResponse =
        await notificationsApi.listNotificationSettings();
      setNotificationSettings(
        listNotificationSettingsResponse.data.notificationSettings,
      );
    } catch (e) {
      setNotificationGroupsError(e);
    } finally {
      setNotificationGroupsLoading(false);
    }
  };

  const fetchNotificationSettings = async () => {
    try {
      const listNotificationSettingsResponse =
        await notificationsApi.listNotificationSettings();
      setNotificationSettings(
        listNotificationSettingsResponse.data.notificationSettings,
      );
    } catch (e) {}
  };

  useEffect(() => {
    (async () => {
      await fetchNotificationGroupsList();
    })();
  }, []);

  let content;

  if (notificationGroupsLoading) {
    content = (
      <Space
        key={uuid()}
        style={{
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          position: "absolute",
        }}
      >
        <Spin size={"large"} />
      </Space>
    );
  } else if (notificationGroupsError) {
    content = (
      <Alert
        key={uuid()}
        type={"error"}
        showIcon={true}
        message={"Unable to load notification groups/types"}
        action={
          <Button
            onClick={async () => {
              await fetchNotificationGroupsList();
            }}
          >
            Retry
          </Button>
        }
      />
    );
  } else if (notificationGroups && notificationGroups.length > 0) {
    const rows: ReactNode[] = [];

    notificationGroups.forEach((notificationGroup, index) => {
      rows.push(
        <tr>
          <td
            style={{
              paddingLeft: 16,
            }}
          >
            <Typography.Title
              level={5}
              style={{
                marginTop: index > 0 ? 16 : 8,
              }}
            >
              {notificationGroup.name}
            </Typography.Title>
          </td>
        </tr>,
      );

      notificationGroup.notificationTypes.forEach((notificationType: any) => {
        if (
          notificationSettings &&
          notificationType.id in notificationSettings
        ) {
          rows.push(
            <NotificationSettingsListEntry
              key={uuid()}
              notificationType={notificationType}
              initialSettings={notificationSettings[notificationType.id]}
              afterUpdate={async () => {
                await fetchNotificationSettings();
              }}
            />,
          );
        }
      });
    });

    content = (
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th
              style={{
                verticalAlign: "bottom",
                textAlign: "left",
                borderBottom: "1px solid #f0f0f0",
                paddingLeft: 16,
              }}
            >
              Notification
            </th>
            <RotatedTableHeader>All</RotatedTableHeader>
            <RotatedTableHeader>WebSocket</RotatedTableHeader>
            <RotatedTableHeader>Synology Chat</RotatedTableHeader>
            <RotatedTableHeader>Synology Mail</RotatedTableHeader>
            <RotatedTableHeader>Email</RotatedTableHeader>
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
    );
  } else {
    content = (
      <Empty key={uuid()} description={"No notification groups/types found!"}>
        <Button
          onClick={async () => {
            await fetchNotificationGroupsList();
          }}
        >
          Refresh Notifications
        </Button>
      </Empty>
    );
  }

  return (
    <Space
      style={{
        width: "100%",
      }}
      styles={{ item: { width: "100%" } }}
      direction={"vertical"}
    >
      {content}
    </Space>
  );
};
export default NotificationSettings;
