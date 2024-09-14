import { EditOutlined } from "@ant-design/icons";
import { Avatar, Button, Col, Layout, Popover, Row } from "antd";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import onairApi from "../../api/onairApi";
import { isElectron } from "../../utils/electron";
import NotificationSink from "../common/NotificationSink";
import NotesEditorModal from "../notes/NotesEditorModal";
import OnAirDrawer from "../onair/OnAirDrawer";
import RefreshTimer from "../common/RefreshTimer";
import SettingsDrawer from "./SettingsDrawer";

const { Header } = Layout;

const AuthHeader: React.FunctionComponent = () => {
  const session = useSession();

  const [settingsOpen, setSettingsOpen] = useState(false);
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
                <Avatar
                  src={session.data?.user?.image}
                  style={{ cursor: "pointer" }}
                  onClick={() => {
                    setSettingsOpen(true);
                  }}
                />
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
