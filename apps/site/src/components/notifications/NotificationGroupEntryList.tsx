import { Alert, Button, Empty, List, Pagination, Space, Spin } from "antd";
import { useEffect, useState } from "react";
import notificationsApi from "../../api/notificationsApi";
import { Events, subscribe, unsubscribe } from "../../utils/events";
import NotificationListEntry from "./NotificationListEntry";

export interface NotificationGroupEntryListProps {
  groupId: string;
}

/**
 * A notification as the API returns it, taken from the call: the SDK exports no
 * name for it, and `Notification` is already a DOM type.
 */
type StoredNotification = Awaited<
  ReturnType<typeof notificationsApi.listNotificationsInGroup>
>["data"]["notifications"][number];

const NotificationGroupEntryList: React.FunctionComponent<
  NotificationGroupEntryListProps
> = ({ groupId }: NotificationGroupEntryListProps) => {
  const [page, setPage] = useState(0);
  const [notifications, setNotifications] = useState<StoredNotification[]>([]);
  const [notificationCount, setNotificationCount] = useState(0);
  const [notificationsLoading, setNotificationsLoading] =
    useState<boolean>(false);
  const [notificationsError, setNotificationsError] = useState<any>(undefined);

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
      const listNotificationsInGroupResponse =
        await notificationsApi.listNotificationsInGroup(groupId, page);
      setNotifications(listNotificationsInGroupResponse.data.notifications);
      setNotificationCount(listNotificationsInGroupResponse.data.count);
    } catch (e) {
      setNotificationsError(e);
    } finally {
      setNotificationsLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await fetchNotificationsList();
    })();
  }, [groupId, page]);

  const onRefreshEvent = (e: CustomEvent) => {
    if (e.detail?.groupId === groupId) {
      (async () => {
        await fetchNotificationsList(true);
      })();
    }
  };

  const content: React.ReactNode[] = [];

  if (notificationsLoading) {
    content.push(
      <Space
        style={{
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          marginTop: 16,
          marginBottom: 32,
        }}
      >
        <Spin size={"large"} />
      </Space>,
    );
  } else if (notificationsError) {
    content.push(
      <Alert
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
  } else if (notifications && notifications.length > 0) {
    content.push(
      <List
        size={"small"}
        style={{ marginBottom: notificationCount > 10 ? 0 : 32 }}
        dataSource={notifications}
        renderItem={(item) => {
          return (
            <NotificationListEntry
              notification={item}
              onSuccess={fetchNotificationsList}
              showGroup={false}
            />
          );
        }}
      />,
    );

    if (notificationCount > 10) {
      content.push(
        <Space style={{ width: "100%", justifyContent: "center" }}>
          <Pagination
            pageSize={10}
            current={page + 1}
            total={notificationCount}
            size={"small"}
            style={{ marginBottom: 32 }}
            onChange={(page) => {
              setPage(page - 1);
            }}
          />
        </Space>,
      );
    }
  } else {
    content.push(
      <Empty description={"No notifications!"}>
        <Button
          onClick={async () => {
            await fetchNotificationsList();
          }}
        >
          Refresh Notifications
        </Button>
      </Empty>,
    );
  }

  return content;
};
export default NotificationGroupEntryList;
