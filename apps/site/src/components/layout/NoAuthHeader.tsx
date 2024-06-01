import { Col, Layout, Row } from "antd";

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
            src={"/header.png"}
            style={{ verticalAlign: "top", height: 64 }}
            alt={"Logo"}
          />
        </Col>
      </Row>
    </Header>
  );
};
export default NoAuthHeader;
