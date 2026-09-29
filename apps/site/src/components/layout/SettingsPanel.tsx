import { LogoutOutlined } from "@ant-design/icons";
import {
  Avatar,
  Button,
  Flex,
  Space,
  Statistic,
  Switch,
  Typography,
} from "antd";
import { useEffect, useState } from "react";
import authApi from "../../api/authApi";
import { useAuth } from "../../auth/AuthProvider";
import { initials } from "../../auth/initials";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { setCurtain } from "../../redux/slices/blackCurtainSlice";

const SettingsPanel: React.FunctionComponent = () => {
  const dispatch = useAppDispatch();
  const auth = useAuth();
  const user = auth.status === "signed-in" ? auth.user : undefined;

  const blackCurtainEnabled = useAppSelector(
    (state) => state.blackCurtain.active,
  );

  /**
   * When this browser's session ends, which is the refresh token's expiry and
   * not the access token's ten minutes. Nothing in the page knows it -- the
   * refresh token is a cookie no script can read -- so it is asked for. The
   * countdown NextAuth fed from `session.expires` had the same meaning.
   */
  const [expiresAt, setExpiresAt] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (user === undefined) return;
    let current = true;
    void (async () => {
      try {
        const sessions = (await authApi.listSessions()).data.sessions;
        const mine = sessions.find((session) => session.current);
        if (current && mine !== undefined) {
          setExpiresAt(new Date(mine.expiresTime).getTime());
        }
      } catch {
        // Worth a blank countdown and nothing more: the panel's job is the
        // switch and the sign-out button.
      }
    })();
    return () => {
      current = false;
    };
  }, [user]);

  return (
    <Flex vertical={true} style={{ height: "100%" }}>
      <Space
        direction={"horizontal"}
        style={{
          width: "100%",
          alignItems: "flex-start",
          padding: 16,
          borderBottom: "1px solid #efefef",
        }}
      >
        <Avatar size={96} shape={"square"}>
          {initials(user?.displayName)}
        </Avatar>
        <Space
          direction={"vertical"}
          size={0}
          style={{ width: "100%", alignItems: "flex-start" }}
        >
          <Typography.Title
            level={4}
            style={{ marginBottom: 4, lineHeight: 1 }}
          >
            {user?.displayName}
          </Typography.Title>
          <Typography.Title
            level={5}
            style={{ fontWeight: 400, lineHeight: 1 }}
          >
            {user?.email}
          </Typography.Title>
          {expiresAt !== undefined && (
            <Statistic.Countdown
              title="Expiration"
              value={expiresAt}
              format="DD [days], HH [hours] mm:ss"
              valueStyle={{ fontSize: 18 }}
            />
          )}
        </Space>
      </Space>
      <Flex
        vertical={true}
        style={{ height: "100%", justifyContent: "space-between" }}
      >
        <Space
          direction={"horizontal"}
          style={{
            padding: 16,
            display: "flex",
            width: "100%",
            justifyContent: "space-between",
          }}
        >
          <Typography.Text>Black curtain</Typography.Text>
          <Switch
            size={"default"}
            checked={blackCurtainEnabled}
            onClick={() => {
              dispatch(setCurtain(!blackCurtainEnabled));
            }}
          />
        </Space>
        <Space
          direction={"horizontal"}
          style={{
            padding: 16,
            display: "flex",
            width: "100%",
            justifyContent: "space-between",
          }}
          styles={{
            item: { width: "100%" },
          }}
        >
          <Button
            icon={<LogoutOutlined />}
            block={true}
            danger={true}
            type={"primary"}
            onClick={() => {
              void auth.signOut();
            }}
          >
            Log Out
          </Button>
        </Space>
      </Flex>
    </Flex>
  );
};
export default SettingsPanel;
