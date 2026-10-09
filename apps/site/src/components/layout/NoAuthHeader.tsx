import { Col, Layout, Row } from "antd";
import { isElectron } from "../../utils/electron";
import NotificationSink from "../common/NotificationSink";

const { Header } = Layout;

const NoAuthHeader: React.FunctionComponent = () => {
  return (
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
          />
        </Col>
      </Row>
      <NotificationSink />
    </Header>
  );
};
export default NoAuthHeader;
