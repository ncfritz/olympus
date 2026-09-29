import { Col, Row } from "antd";
import { Content } from "antd/lib/layout/layout";
import WeatherWidget from "../components/widgets/weather/WeatherWidget";

const IndexPage: React.FunctionComponent = () => {
  return (
    <Content
      style={{
        background: "#fff",
      }}
    >
      <Content
        style={{
          margin: 16,
        }}
      >
        <Row>
          <Col span={14}>Somewhere! Over the rainbow</Col>
          <Col span={10}>
            <WeatherWidget />
          </Col>
        </Row>
      </Content>
    </Content>
  );
};

export default IndexPage;
