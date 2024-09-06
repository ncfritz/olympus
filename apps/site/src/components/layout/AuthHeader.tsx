import { EditOutlined, LogoutOutlined, UserOutlined } from "@ant-design/icons";
import {
  Avatar,
  Button,
  Col,
  Layout,
  Popover,
  Row,
  Space,
  Switch,
  Typography,
} from "antd";
import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import onairApi from "../../api/onairApi";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { setCurtain } from "../../redux/slices/blackCurtainSlice";
import { isElectron } from "../../utils/electron";
import NotificationSink from "../common/NotificationSink";
import NotesEditorModal from "../notes/NotesEditorModal";
import OnAirDrawer from "../onair/OnAirDrawer";
import RefreshTimer from "../common/RefreshTimer";

const { Header } = Layout;

const AuthHeader: React.FunctionComponent = () => {
  const dispatch = useAppDispatch();

  const blackCurtainEnabled = useAppSelector(
    (state) => state.blackCurtain.active,
  );

  const [onAirOpen, setOnAirOpen] = useState(false);
  const [onAirActive, setOnAirActive] = useState(false);
  const [notesModalOpen, setNotesModalOpen] = useState(false);

  const fetchOnAirStatus = async () => {
    try {
      const onAirStatusResponse = await onairApi.getStstus();

      setOnAirActive(
        onAirStatusResponse.status !== "free" &&
          onAirStatusResponse.status !== "clear",
      );
    } catch (e) {
      console.log("Unable to fetch OnAir status");
    }
  };

  useEffect(() => {
    (async () => {
      await fetchOnAirStatus();
    })();
  }, []);

  const popoverContent = (
    <Space direction={"vertical"} style={{ width: 300 }}>
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
      <Space
        direction={"horizontal"}
        style={{
          marginLeft: 16,
          display: "flex",
          width: "100%",
          alignContent: "space-between",
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
    </Space>
  );

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
          <Col flex={"none"}>
            <img
              src={isElectron() ? "/header_electron.png" : "/header.png"}
              style={{ verticalAlign: "top", height: 64 }}
              alt={"Logo"}
              className={isElectron() ? "electron-logo" : ""}
            />
          </Col>
          <Col flex={"auto"}></Col>
          <Col>
            <Row gutter={24}>
              <Col style={{ alignItems: "center", display: "flex" }}>
                <Button
                  icon={<EditOutlined size={24} />}
                  ghost={true}
                  type={"default"}
                  onClick={() => {
                    setNotesModalOpen(!notesModalOpen);
                  }}
                />
                <Button
                  type={"link"}
                  onClick={() => {
                    setOnAirOpen(!onAirOpen);
                  }}
                >
                  <img
                    src={
                      onAirActive ? "/onair_active.svg" : "/onair_inactive.svg"
                    }
                    alt={"OnAir"}
                    height={24}
                  />
                </Button>
              </Col>
              <Col>
                <Popover
                  content={popoverContent}
                  trigger={"hover"}
                  placement={"topRight"}
                  showArrow={false}
                >
                  <Avatar icon={<UserOutlined />} />
                </Popover>
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
