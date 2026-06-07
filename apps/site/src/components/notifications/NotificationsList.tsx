import { ClockCircleFilled } from "@ant-design/icons";
import type {
  NotificationGroup,
  Notification,
  NotificationStatistics,
} from "@ncfritz/olympus-sdk/olympus";
import {
  Alert,
  Button,
  Collapse,
  Empty,
  List,
  Space,
  Spin,
  Typography,
} from "antd";
import { type ReactNode, useEffect, useState } from "react";
import notificationsApi from "../../api/notificationsApi";
import { Events, subscribe, unsubscribe } from "../../utils/events";
import NotificationGroupEntryList from "./NotificationGroupEntryList";
import NotificationGroupHeader from "./NotificationGroupHeader";
import NotificationListEntry from "./NotificationListEntry";
import { v4 as uuid } from "uuid";

const NotificationsList: React.FunctionComponent = () => {
  const [activeGroups, setActiveGroups] = useState<string[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationStatistics, setNotificationStatistics] = useState<
    Record<string, NotificationStatistics>
  >({});
  const [notificationGroups, setNotificationGroups] = useState<
    NotificationGroup[]
  >([]);
  const [notificationsLoading, setNotificationsLoading] =
    useState<boolean>(false);
  const [notificationsError, setNotificationsError] =
    useState<unknown>(undefined);

  useEffect(() => {
    subscribe(Events.NOTIFICATIONS_REFRESH_EVENT, onRefreshEvent);

    return () => {
      unsubscribe(Events.NOTIFICATIONS_REFRESH_EVENT, onRefreshEvent);
    };
  }, []);

  const fetchNotificationsList = async (quiet: boolean = false) => {
    if (!quiet) {
      setNotificationsLoading(true);
    }

    setNotificationsError(undefined);

    try {
      const listNotificationsResponse =
        await notificationsApi.listNotifications();
      setNotifications(listNotificationsResponse.data?.recent || []);
      setNotificationStatistics(
        listNotificationsResponse.data?.statistics || {},
      );

      const listNotificationGroupsResponse =
        await notificationsApi.listNotificationGroups();
      setNotificationGroups(listNotificationGroupsResponse.data?.groups || []);
    } catch (e) {
      console.log(e);
      setNotificationsError(e);
    } finally {
      setNotificationsLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await fetchNotificationsList();
    })();
  }, []);

  const onRefreshEvent = () => {
    (async () => {
      await fetchNotificationsList(true);
    })();
  };

  const content: ReactNode[] = [];

  if (notificationsLoading) {
    content.push(
      <Space
        key={uuid()}
        style={{
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          marginTop: 48,
        }}
      >
        <Spin size={"large"} />
      </Space>,
    );
  } else if (notificationsError) {
    content.push(
      <Alert
        style={{ margin: 16 }}
        key={uuid()}
        type={"error"}
        showIcon={true}
        message={"Unable to load notifications"}
        action={
          <Button
            onClick={async () => {
              await fetchNotificationsList();
            }}
          >
            Retry
          </Button>
        }
      />,
    );
  } else if (!notifications || notifications.length === 0) {
    content.push(
      <Empty key={uuid()} description={"No new notifications!"}>
        <Button
          onClick={async () => {
            await fetchNotificationsList();
          }}
        >
          Refresh Notifications
        </Button>
      </Empty>,
    );
  } else {
    content.push(
      <List
        key={uuid()}
        header={
          <Typography.Title level={5} style={{ marginLeft: 16 }}>
            <Space size={8}>
              <ClockCircleFilled />
              Most Recent
            </Space>
          </Typography.Title>
        }
        size={"small"}
        dataSource={notifications}
        renderItem={(item) => {
          return (
            <NotificationListEntry
              notification={item}
              onSuccess={fetchNotificationsList}
              showGroup={true}
            />
          );
        }}
      />,
    );
  }

  if (notificationGroups && notificationGroups.length > 0) {
    content.push(
      <Collapse
        key={uuid()}
        style={{
          marginTop: 32,
        }}
        activeKey={activeGroups}
        onChange={(key) => {
          setActiveGroups(key);
        }}
        ghost={true}
        items={notificationGroups.map((item, index) => {
          const unreadCount = notificationStatistics[item.id]?.unread || 0;

          return {
            key: `notification-grp-${index}`,
            showArrow: false,
            label: (
              <NotificationGroupHeader
                group={item}
                notificationStatistics={notificationStatistics}
                unreadCount={unreadCount}
              />
            ),
            children: <NotificationGroupEntryList groupId={item.id} />,
          };
        })}
      />,
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
export default NotificationsList;
