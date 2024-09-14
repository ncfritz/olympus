import { LogoutOutlined } from "@ant-design/icons";
import { Avatar, Button, Space, Statistic, Switch, Typography } from "antd";
import { DateTime } from "luxon";
import { signOut, useSession } from "next-auth/react";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { setCurtain } from "../../redux/slices/blackCurtainSlice";

export interface SettingsPanelProps {}

const SettingsPanel: React.FunctionComponent<
  SettingsPanelProps
> = ({}: SettingsPanelProps) => {
  const dispatch = useAppDispatch();
  const session = useSession();

  const blackCurtainEnabled = useAppSelector(
    (state) => state.blackCurtain.active,
  );

  const expirationTime = DateTime.fromISO(
    session.data?.expires || DateTime.now().toISO(),
  ).toMillis();

  return (
    <Space direction={"vertical"} style={{ padding: 16, width: "100%" }}>
      <Space
        direction={"horizontal"}
        style={{ width: "100%", alignItems: "baseline" }}
      >
        <Avatar size={96} src={session.data?.user?.image} shape={"square"} />
        <Space
          direction={"vertical"}
          size={0}
          style={{ width: "100%", alignItems: "flex-start" }}
        >
          <Typography.Title
            level={4}
            style={{ marginBottom: 4, lineHeight: 1 }}
          >
            {session.data?.user?.name}
          </Typography.Title>
          <Typography.Title
            level={5}
            style={{ fontWeight: 400, lineHeight: 1 }}
          >
            {session.data?.user?.email}
          </Typography.Title>
          <Statistic.Countdown
            title="Expiration"
            value={expirationTime}
            format="DD [days], HH [hours] mm:ss"
            valueStyle={{ fontSize: 18 }}
          />
        </Space>
      </Space>
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
          checked={!blackCurtainEnabled}
          onClick={() => {
            dispatch(setCurtain(!blackCurtainEnabled));
          }}
        />
      </Space>
      <Button
        icon={<LogoutOutlined />}
        block={true}
        type={"text"}
        style={{
          textAlign: "left",
        }}
        onClick={() => {
          signOut();
        }}
      >
        Log Out
      </Button>
    </Space>
  );
};
export default SettingsPanel;
