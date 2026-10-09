import { EditOutlined, InboxOutlined, SearchOutlined } from "@ant-design/icons";
import { Avatar, Badge, Button, Col, Input, Layout, Row } from "antd";
import { useCallback, useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { useAuth } from "../../auth/AuthProvider";
import { initials } from "../../auth/initials";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import { notificationsSocket } from "../../auth/pageSession";
import type {
  NotificationPushMessage,
  NotificationRefreshMessage,
} from "../../auth/notifications";
import notificationsApi from "../../api/notificationsApi";
import availabilityApi from "../../api/availabilityApi";
import { useAppSelector } from "../../redux/hooks";
import { setUnreadCount } from "../../redux/slices/notificationsSlice";
import { isElectron } from "../../utils/electron";
import { isOnAir } from "../../utils/onair";
import NotificationSink from "../common/NotificationSink";
import AuthSessionTimer from "../content/AuthSessionTimer";
import NotesEditorModal from "../notes/NotesEditorModal";
import OnAirDrawer from "../onair/OnAirDrawer";
import RefreshTimer from "../common/RefreshTimer";
import NotificationsDrawer from "../notifications/NotificationsDrawer";
import SettingsDrawer from "./SettingsDrawer";
import { Events, publish } from "../../utils/events";

const { Header } = Layout;

const AuthHeader: React.FunctionComponent = () => {
  const auth = useAuth();
  const dispatch = useDispatch();
  // The connection belongs to the document, not to this header: `useState`
  // so asking for it is not a side effect of rendering.
  const [socket] = useState(notificationsSocket);

  const unreadNotificationsCount = useAppSelector(
    (state) => state.notifications.unreadCount,
  );

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [onAirOpen, setOnAirOpen] = useState(false);
  const [onAirActive, setOnAirActive] = useState(false);
  const [notesModalOpen, setNotesModalOpen] = useState(false);

  const fetchOnAirStatus = async () => {
    try {
      setOnAirActive(isOnAir(await availabilityApi.current()));
    } catch (e) {
      console.log("Unable to fetch OnAir status", e);
    }
  };

  const fetchUnreadNotificationsCount = async () => {
    try {
      const response = await notificationsApi.getUnreadNotificationsCount();

      if (response.data?.unreadCount) {
        dispatch(setUnreadCount(response.data.unreadCount));
      }
    } catch (e) {
      console.log("Unable to fetch unread notifications count", e);
    }
  };

  // Stable, so the subscription is not torn down and rebuilt on every render.
  const onNotificationPush = useCallback((message: NotificationPushMessage) => {
    if (message && !message.ghost) {
      publish(Events.NOTIFICATIONS_PUBLISH_EVENT, {
        eventId: message.eventId,
        notificationId: message.notificationId,
        messageType: message.messageType,
        type: message.level,
        durable: message.durable,
        closable: message.closable,
        deleteOnClose: message.durable && message.deleteOnClose,
        visibleDuration: message.visibleDuration,
        payload: message.payload,
      });
    }
  }, []);
  const onNotificationRefresh = useCallback(
    (message: NotificationRefreshMessage) => {
      publish(Events.NOTIFICATIONS_REFRESH_EVENT, {
        groupId: message.groupId,
      });
      dispatch(setUnreadCount(message.unreadCount));
    },
    [dispatch],
  );

  useSocketEvent(socket, "notification.push", onNotificationPush);
  useSocketEvent(socket, "notification.refresh", onNotificationRefresh);

  useEffect(() => {
    (async () => {
      await fetchOnAirStatus();
      await fetchUnreadNotificationsCount();
    })();
  }, []);

  return (
    <>
      <div className={"titlebar"} />
      <Header
        style={{
          position: "fixed",
          top: 0,
          zIndex: 100,
          width: "100%",
          paddingInline: "0px 32px",
        }}
      >
        <Row>
          <Col span={8}>
            <img
              src={isElectron() ? "/header_electron.png" : "/header.png"}
              style={{ verticalAlign: "top", height: 64 }}
              alt={"Logo"}
              className={isElectron() ? "electron-logo" : ""}
            />
          </Col>
          <Col
            span={8}
            flex={"auto"}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Input
              variant="borderless"
              placeholder={"Search..."}
              style={{
                width: 600,
                background: "#2c3c4a",
                color: "#9aa4ae",
              }}
              prefix={<SearchOutlined />}
            />
          </Col>
          <Col
            flex={"auto"}
            span={8}
            style={{
              justifyItems: "end",
            }}
          >
            <Row gutter={24}>
              <AuthSessionTimer />
              <Col
                style={{ alignItems: "center", display: "flex", columnGap: 8 }}
              >
                <Button
                  icon={<EditOutlined size={24} />}
                  type={"text"}
                  variant={"filled"}
                  style={{
                    color: "#9aa4ae",
                  }}
                  onClick={() => {
                    setNotesModalOpen(!notesModalOpen);
                  }}
                />
                <Badge
                  count={unreadNotificationsCount}
                  showZero={false}
                  offset={[-12, 4]}
                >
                  <Button
                    type={"text"}
                    variant={"filled"}
                    style={{
                      color: "#9aa4ae",
                      paddingRight: 16,
                    }}
                    onClick={() => {
                      setNotificationsOpen(!notificationsOpen);
                    }}
                  >
                    <InboxOutlined size={24} />
                  </Button>
                </Badge>
                <Button
                  type={"default"}
                  onClick={() => {
                    setOnAirOpen(!onAirOpen);
                  }}
                  style={{
                    background: onAirActive ? "#ff0000" : "transparent",
                    borderWidth: 2,
                    color: "#ffffff",
                    fontWeight: "bold",
                  }}
                >
                  ON AIR
                </Button>
              </Col>
              <Col>
                <Avatar
                  style={{ cursor: "pointer" }}
                  onClick={() => {
                    setSettingsOpen(true);
                  }}
                >
                  {initials(
                    auth.status === "signed-in"
                      ? auth.user.displayName
                      : undefined,
                  )}
                </Avatar>
              </Col>
            </Row>
          </Col>
        </Row>
      </Header>
      <NotesEditorModal
        open={notesModalOpen}
        close={() => {
          setNotesModalOpen(false);
        }}
      />
      <SettingsDrawer
        open={settingsOpen}
        onClose={() => {
          setSettingsOpen(false);
        }}
      />
      <NotificationsDrawer
        open={notificationsOpen}
        onClose={() => {
          setNotificationsOpen(false);
        }}
      />
      <OnAirDrawer
        open={onAirOpen}
        onClose={() => {
          setOnAirOpen(false);
        }}
      />
      <RefreshTimer
        ttlMs={30000}
        showProgress={false}
        fetchFunction={async () => {
          await fetchOnAirStatus();
        }}
      />
      <NotificationSink />
    </>
  );
};
export default AuthHeader;
